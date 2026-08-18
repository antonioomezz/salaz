'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { iceServers } from '@/lib/rtc';
import { getSocket } from '@/lib/socket';
import { micConstraints, type AudioSettings } from '@/lib/audioSettings';
import { createMixer, type Mixer } from '@/lib/mixer';
import {
  applyContentHint,
  displayConstraints,
  preferScreenCodecs,
  tuneScreenSender,
} from '@/lib/screenQuality';

type Peer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  micSender: RTCRtpSender | null;
  screenVideoSender: RTCRtpSender | null;
  screenAudioSender: RTCRtpSender | null;
  /** candidatos que chegaram antes da descrição remota; aplicados depois */
  pendingCandidates: RTCIceCandidateInit[];
};

/** streams recebidas de um participante, já separadas por finalidade */
export type PeerStreams = { mic?: MediaStream; screen?: MediaStream };

type Params = {
  myId: string | null;
  /** ids dos outros usuários que estão no MESMO canal de voz que eu */
  peerIds: string[];
  settings: AudioSettings;
};

/**
 * Malha (mesh) WebRTC: cada participante abre uma conexão direta com cada um
 * dos outros. Aguenta bem até ~6-8 pessoas, suficiente para o MVP. Se um dia
 * precisar de SFU, só este arquivo muda.
 */
export function useVoice({ myId, peerIds, settings }: Params) {
  const peers = useRef(new Map<string, Peer>());

  /** track crua do getUserMedia — é ela que morre quando o Windows reinicia o áudio */
  const rawMic = useRef<MediaStreamTrack | null>(null);
  /** o que realmente enviamos (igual à crua, ou passada por um ganho) */
  const outgoingMic = useRef<MediaStreamTrack | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [micLive, setMicLive] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [screenHasAudio, setScreenHasAudio] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, PeerStreams>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [inputLevel, setInputLevel] = useState(0);

  const inVoice = voiceChannel !== null;

  // configurações mais recentes, sem re-registrar callbacks a cada mudança
  const cfg = useRef(settings);
  useEffect(() => {
    cfg.current = settings;
  });

  // ---------------------------------------------------------- áudio auxiliar
  const audioCtx = useRef<AudioContext | null>(null);
  const analysers = useRef(
    new Map<
      string,
      { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; src: MediaStreamAudioSourceNode }
    >()
  );
  const mixer = useRef<Mixer | null>(null);
  /** há um arquivo de música tocando na chamada agora */
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const precisaMixer = useRef(false);

  const ctx = useCallback(() => {
    audioCtx.current ||= new AudioContext();
    if (audioCtx.current.state === 'suspended') void audioCtx.current.resume();
    return audioCtx.current;
  }, []);

  const watchLevel = useCallback(
    (key: string, stream: MediaStream) => {
      try {
        if (!stream.getAudioTracks().length) return;
        analysers.current.get(key)?.src.disconnect();
        const audio = ctx();
        const src = audio.createMediaStreamSource(stream);
        const analyser = audio.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analysers.current.set(key, {
          analyser,
          src,
          data: new Uint8Array(analyser.frequencyBinCount),
        });
      } catch {
        /* sem WebAudio o indicador de fala apenas não aparece */
      }
    },
    [ctx]
  );

  const unwatchLevel = useCallback((key: string) => {
    analysers.current.get(key)?.src.disconnect();
    analysers.current.delete(key);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!analysers.current.size) return;
      const next: Record<string, boolean> = {};
      let mine = 0;
      for (const [key, { analyser, data }] of analysers.current) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        const level = Math.sqrt(sum / data.length);
        next[key] = level > 12;
        if (key === myId) mine = level;
      }
      setInputLevel(Math.min(100, Math.round((mine / 60) * 100)));
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) if (!!prev[k] !== !!next[k]) return next;
        return prev;
      });
    }, 120);
    return () => clearInterval(timer);
  }, [myId]);

  // ------------------------------------------------------- pipeline do mic
  /**
   * Monta a track que sai daqui. Sem ganho alterado e sem música tocando,
   * devolve a track CRUA — nenhum WebAudio no caminho crítico do microfone.
   */
  const buildOutgoing = useCallback(
    (raw: MediaStreamTrack, volume: number): MediaStreamTrack => {
      mixer.current?.destroy();
      mixer.current = null;

      if (volume === 100 && !precisaMixer.current) return raw;

      const m = createMixer(ctx(), raw, {
        micVolume: volume,
        musicVolume: cfg.current.musicVolume,
      });
      if (!m) return raw;
      mixer.current = m;
      return m.track;
    },
    [ctx]
  );

  /** Aplica codec, bitrate e preferência de degradação no envio de tela. */
  const afinarEnvioDeTela = useCallback((pc: RTCPeerConnection, sender: RTCRtpSender) => {
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    if (transceiver) preferScreenCodecs(transceiver);
    void tuneScreenSender(sender, cfg.current.screenPreset);
  }, []);

  const pushMicToPeers = useCallback((track: MediaStreamTrack) => {
    for (const peer of peers.current.values()) {
      // replaceTrack não exige renegociação: troca transparente para o outro lado
      if (peer.micSender) void peer.micSender.replaceTrack(track).catch(() => {});
      else if (micStream.current) peer.micSender = peer.pc.addTrack(track, micStream.current);
    }
  }, []);

  /** Captura o microfone e prepara a track de saída. */
  const acquireMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints(cfg.current));
    const raw = stream.getAudioTracks()[0];
    if (!raw) throw new Error('sem track de áudio');

    rawMic.current?.stop();
    rawMic.current = raw;
    micStream.current = stream;

    const out = buildOutgoing(raw, cfg.current.inputVolume);
    outgoingMic.current = out;
    if (myId) watchLevel(myId, new MediaStream([raw]));
    return out;
  }, [buildOutgoing, myId, watchLevel]);

  /**
   * Vigia a saúde do microfone. No Windows, abrir a captura de tela pode
   * reiniciar o subsistema de áudio e matar a track — sem isto o usuário fica
   * mudo para sempre e sem nenhum aviso.
   */
  const recovering = useRef(false);
  const recoverMic = useCallback(async () => {
    if (recovering.current || !micStream.current) return;
    recovering.current = true;
    setMicLive(false);
    try {
      const wasEnabled = outgoingMic.current?.enabled ?? true;
      const track = await acquireMic();
      track.enabled = wasEnabled;
      if (rawMic.current) rawMic.current.enabled = wasEnabled;
      pushMicToPeers(track);
      setMicLive(true);
      setError(null);
    } catch {
      setError('O microfone parou de responder e não consegui reconectar. Abra as configurações e escolha o dispositivo na mão.');
    } finally {
      recovering.current = false;
    }
  }, [acquireMic, pushMicToPeers]);

  const recoverRef = useRef(recoverMic);
  useEffect(() => {
    recoverRef.current = recoverMic;
  });

  // liga os detectores de morte/mudez na track crua atual
  useEffect(() => {
    if (!inVoice) return;
    let stop = false;

    const check = () => {
      const raw = rawMic.current;
      if (stop || !raw) return;
      if (raw.readyState === 'ended') {
        void recoverRef.current();
      } else {
        // 'muted' = o SO tirou o áudio da gente (outro app tomou o device)
        setMicLive(!raw.muted);
        if (raw.muted) void recoverRef.current();
      }
    };

    const timer = setInterval(check, 1500);
    const onDeviceChange = () => {
      if (rawMic.current?.readyState === 'ended') void recoverRef.current();
    };
    navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      stop = true;
      clearInterval(timer);
      navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [inVoice]);

  // ---------------------------------------------------------------- peers
  const dropPeer = useCallback(
    (id: string) => {
      const peer = peers.current.get(id);
      if (peer) {
        peer.pc.onnegotiationneeded = null;
        peer.pc.onicecandidate = null;
        peer.pc.ontrack = null;
        peer.pc.close();
        peers.current.delete(id);
      }
      unwatchLevel(id);
      setRemoteStreams((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
    },
    [unwatchLevel]
  );

  const createPeer = useCallback(
    (id: string) => {
      if (!myId || peers.current.has(id)) return;
      const socket = getSocket();

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const peer: Peer = {
        pc,
        // "perfect negotiation": um dos lados cede quando as ofertas colidem
        polite: myId < id,
        makingOffer: false,
        ignoreOffer: false,
        micSender: null,
        screenVideoSender: null,
        screenAudioSender: null,
        pendingCandidates: [],
      };
      peers.current.set(id, peer);

      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          socket.emit('signal', { to: id, data: { description: pc.localDescription } });
        } catch (err) {
          console.error('negociação falhou', err);
        } finally {
          peer.makingOffer = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('signal', { to: id, data: { candidate } });
      };

      pc.ontrack = ({ streams }) => {
        const stream = streams[0];
        if (!stream) return;
        setRemoteStreams((prev) => {
          const mine: PeerStreams = { ...(prev[id] ?? {}) };
          if (stream.getVideoTracks().length > 0) {
            mine.screen = stream;
          } else if (!mine.mic || mine.mic.id === stream.id) {
            // primeira stream só de áudio = microfone
            mine.mic = stream;
          } else {
            // segunda stream de áudio = som da tela compartilhada
            mine.screen = stream;
          }
          return { ...prev, [id]: mine };
        });
        if (stream.getVideoTracks().length === 0) watchLevel(id, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') pc.restartIce();
      };

      // tracks entram depois dos handlers para a renegociação ser capturada
      if (outgoingMic.current && micStream.current) {
        peer.micSender = pc.addTrack(outgoingMic.current, micStream.current);
      }
      // vídeo antes do áudio: assim o outro lado já classifica a stream como tela
      const screen = screenStream.current;
      if (screen) {
        const video = screen.getVideoTracks()[0];
        if (video) {
          peer.screenVideoSender = pc.addTrack(video, screen);
          afinarEnvioDeTela(pc, peer.screenVideoSender);
        }
        const audio = screen.getAudioTracks()[0];
        if (audio) peer.screenAudioSender = pc.addTrack(audio, screen);
      }
    },
    [myId, watchLevel, afinarEnvioDeTela]
  );

  // reconcilia a malha sempre que a lista do canal de voz muda
  useEffect(() => {
    if (!inVoice) return;
    const wanted = new Set(peerIds);
    for (const id of wanted) createPeer(id);
    for (const id of [...peers.current.keys()]) if (!wanted.has(id)) dropPeer(id);
  }, [peerIds, inVoice, createPeer, dropPeer]);

  // ---------------------------------------------------------- sinalização
  useEffect(() => {
    const socket = getSocket();

    const onSignal = async ({
      from,
      data,
    }: {
      from: string;
      data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    }) => {
      const peer = peers.current.get(from);
      if (!peer) return;
      const { pc } = peer;

      try {
        if (data.description) {
          const collision =
            data.description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;

          await pc.setRemoteDescription(data.description);

          // agora que existe descrição remota, aplica o que ficou na fila
          const queued = peer.pendingCandidates.splice(0);
          for (const candidate of queued) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }

          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('signal', { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          // candidato pode chegar antes da oferta/resposta: guarda para depois,
          // senão a conexão fica presa em "new" e ninguém se ouve
          if (!pc.remoteDescription) {
            peer.pendingCandidates.push(data.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!peer.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error('sinalização', err);
      }
    };

    socket.on('signal', onSignal);
    return () => {
      socket.off('signal', onSignal);
    };
  }, []);

  // ---------------------------------------------------------------- ações
  const joinVoice = useCallback(
    async (channelId: string) => {
      const socket = getSocket();
      setError(null);
      setConnecting(true);
      try {
        if (!micStream.current) await acquireMic();
        if (rawMic.current) rawMic.current.enabled = true;
        if (outgoingMic.current) outgoingMic.current.enabled = true;
        setMicOn(true);
        setMicLive(true);
        setVoiceChannel(channelId);
        socket.emit('voice:join', { channelId });
        socket.emit('state', { muted: false, sharing: false });
      } catch {
        setError('Não consegui acessar o microfone. Libere a permissão no navegador e tente de novo.');
      } finally {
        setConnecting(false);
      }
    },
    [acquireMic]
  );

  const stopScreen = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setLocalScreen(null);
    setScreenHasAudio(false);
    for (const peer of peers.current.values()) {
      void peer.screenVideoSender?.replaceTrack(null).catch(() => {});
      void peer.screenAudioSender?.replaceTrack(null).catch(() => {});
    }
    getSocket().emit('state', { sharing: false });
  }, []);

  const leaveVoice = useCallback(() => {
    stopScreen();
    for (const id of [...peers.current.keys()]) dropPeer(id);
    micStream.current?.getTracks().forEach((t) => t.stop());
    mixer.current?.destroy();
    mixer.current = null;
    precisaMixer.current = false;
    setPlayingFile(null);
    micStream.current = null;
    rawMic.current = null;
    outgoingMic.current = null;
    if (myId) unwatchLevel(myId);
    setVoiceChannel(null);
    setDeafened(false);
    setInputLevel(0);
    getSocket().emit('voice:leave');
  }, [myId, dropPeer, stopScreen, unwatchLevel]);

  const setMicEnabled = useCallback((on: boolean) => {
    if (rawMic.current) rawMic.current.enabled = on;
    if (outgoingMic.current) outgoingMic.current.enabled = on;
    setMicOn(on);
    getSocket().emit('state', { muted: !on });
  }, []);

  const toggleMic = useCallback(() => {
    if (!rawMic.current) return;
    setMicEnabled(!rawMic.current.enabled);
  }, [setMicEnabled]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    setDeafened(next);
    if (next) {
      if (rawMic.current) rawMic.current.enabled = false;
      if (outgoingMic.current) outgoingMic.current.enabled = false;
      setMicOn(false);
      getSocket().emit('state', { deafened: true, muted: true });
    } else {
      getSocket().emit('state', { deafened: false });
    }
  }, [deafened]);

  const startScreen = useCallback(async () => {
    const socket = getSocket();
    try {
      const preset = cfg.current.screenPreset;
      const stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints(preset));
      screenStream.current = stream;
      setLocalScreen(stream);

      const video = stream.getVideoTracks()[0];
      const audio = stream.getAudioTracks()[0];
      setScreenHasAudio(!!audio);
      if (video) applyContentHint(video, preset);

      // botão nativo "parar compartilhamento" do navegador
      video?.addEventListener('ended', () => stopScreen());

      for (const peer of peers.current.values()) {
        if (video) {
          if (peer.screenVideoSender) void peer.screenVideoSender.replaceTrack(video).catch(() => {});
          else peer.screenVideoSender = peer.pc.addTrack(video, stream);
          afinarEnvioDeTela(peer.pc, peer.screenVideoSender);
        }
        if (audio) {
          if (peer.screenAudioSender) void peer.screenAudioSender.replaceTrack(audio).catch(() => {});
          else peer.screenAudioSender = peer.pc.addTrack(audio, stream);
        }
      }
      socket.emit('state', { sharing: true });

      // capturar a tela pode derrubar o microfone no Windows: confere logo depois
      setTimeout(() => {
        const raw = rawMic.current;
        if (raw && (raw.readyState === 'ended' || raw.muted)) void recoverRef.current();
      }, 800);
    } catch {
      /* usuário fechou o seletor de tela */
    }
  }, [stopScreen, afinarEnvioDeTela]);

  /**
   * Toca um arquivo de áudio DENTRO da chamada: ele entra no mixer e sai junto
   * com a sua voz, então todo mundo ouve. É o que o player do YouTube não pode
   * fazer, porque o áudio do iframe é de outra origem e não pode ser capturado.
   */
  const playFileInCall = useCallback(
    async (file: File) => {
      if (!rawMic.current) {
        setError('Entre em um canal de voz antes de tocar um arquivo.');
        return;
      }
      try {
        precisaMixer.current = true;
        // remonta a saída já com o mixer no caminho
        const track = buildOutgoing(rawMic.current, cfg.current.inputVolume);
        track.enabled = rawMic.current.enabled;
        outgoingMic.current = track;
        pushMicToPeers(track);

        const url = URL.createObjectURL(file);
        const el = mixer.current?.playFile(url);
        el?.addEventListener('ended', () => setPlayingFile(null));
        setPlayingFile(file.name);
      } catch {
        setError('Não consegui tocar esse arquivo.');
      }
    },
    [buildOutgoing, pushMicToPeers]
  );

  const stopFileInCall = useCallback(() => {
    mixer.current?.stopFile();
    setPlayingFile(null);
    precisaMixer.current = false;

    // volta para a track crua se nada mais exigir o mixer
    if (rawMic.current && cfg.current.inputVolume === 100) {
      const track = buildOutgoing(rawMic.current, 100);
      track.enabled = rawMic.current.enabled;
      outgoingMic.current = track;
      pushMicToPeers(track);
    }
  }, [buildOutgoing, pushMicToPeers]);

  /** Aplica mudanças de configuração sem derrubar a chamada. */
  const applySettings = useCallback(
    async (next: AudioSettings, previous: AudioSettings) => {
      cfg.current = next;
      if (!micStream.current) return;

      const precisaRecapturar =
        next.inputDeviceId !== previous.inputDeviceId ||
        next.echoCancellation !== previous.echoCancellation ||
        next.noiseSuppression !== previous.noiseSuppression ||
        next.autoGainControl !== previous.autoGainControl;

      try {
        if (precisaRecapturar) {
          const wasEnabled = rawMic.current?.enabled ?? true;
          const track = await acquireMic();
          track.enabled = wasEnabled;
          if (rawMic.current) rawMic.current.enabled = wasEnabled;
          pushMicToPeers(track);
          setMicLive(true);
        } else if (next.musicVolume !== previous.musicVolume && mixer.current) {
          mixer.current.setMusicGain(next.musicVolume);
        } else if (next.inputVolume !== previous.inputVolume && rawMic.current) {
          if (mixer.current && next.inputVolume !== 100) {
            // mixer já montado: só move o fader do microfone
            mixer.current.setMicGain(next.inputVolume);
          } else {
            const wasEnabled = rawMic.current.enabled;
            const track = buildOutgoing(rawMic.current, next.inputVolume);
            track.enabled = wasEnabled;
            outgoingMic.current = track;
            pushMicToPeers(track);
          }
        }
      } catch {
        setError('Não consegui aplicar as configurações de áudio nesse dispositivo.');
      }
    },
    [acquireMic, buildOutgoing, pushMicToPeers]
  );

  // encerra tudo ao desmontar
  useEffect(
    () => () => {
      for (const peer of peers.current.values()) peer.pc.close();
      peers.current.clear();
      micStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        void audioCtx.current.close().catch(() => {});
      }
    },
    []
  );

  return {
    inVoice,
    voiceChannel,
    micOn,
    micLive,
    deafened,
    playingFile,
    playFileInCall,
    stopFileInCall,
    connecting,
    error,
    localScreen,
    screenHasAudio,
    remoteStreams,
    speaking,
    inputLevel,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    startScreen,
    stopScreen,
    applySettings,
    clearError: () => setError(null),
  };
}
