'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { iceServers } from '@/lib/rtc';
import { getSocket } from '@/lib/socket';
import { micConstraints, type AudioSettings } from '@/lib/audioSettings';
import { createMixer, type Mixer } from '@/lib/mixer';
import {
  applyContentHint,
  displayConstraints,
  displaySurfaceOf,
  pushFrameRate,
  preferScreenCodecs,
  tuneScreenSender,
} from '@/lib/screenQuality';

type Peer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  micSender: RTCRtpSender | null;
  camSender: RTCRtpSender | null;
  screenVideoSender: RTCRtpSender | null;
  screenAudioSender: RTCRtpSender | null;
  /** candidatos ainda sem descrição remota compatível; aplicados depois */
  pendingCandidates: RTCIceCandidateInit[];
  /**
   * Sinalização é tratada uma de cada vez. Sem isso um candidato chega no meio
   * do await de uma descrição, é aplicado contra a negociação antiga e o
   * navegador o descarta com "Error processing ICE" — metade dos candidatos
   * sumia assim, e quando sumia a metade errada a conexão não fechava.
   */
  fila: Promise<void>;
  remoteKinds: Record<string, string>;
  isSettingRemoteAnswer: boolean;
};

/**
 * Streams recebidas de um participante. A de áudio puro é sempre o microfone;
 * as de vídeo podem ser câmera ou tela, e quem separa é o RoomClient usando os
 * ids que o dono anuncia pelo servidor (o track remoto não carrega essa info).
 */
export type PeerStreams = { mic?: MediaStream; videos: MediaStream[] };

/** o que está realmente saindo na transmissão de tela, medido do encoder */
export type ScreenStats = {
  width: number;
  height: number;
  /** quadros por segundo que estão SAINDO (depois do encoder) */
  fps: number;
  /** quadros por segundo que a CAPTURA está entregando */
  captureFps: number;
  kbps: number;
};

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
  const camStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [micLive, setMicLive] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [localCam, setLocalCam] = useState<MediaStream | null>(null);
  const [screenStats, setScreenStats] = useState<ScreenStats | null>(null);
  /** explica o que aconteceu com o áudio da última transmissão iniciada */
  const [screenAudioInfo, setScreenAudioInfo] = useState<string | null>(null);
  const [screenHasAudio, setScreenHasAudio] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, PeerStreams>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [inputLevel, setInputLevel] = useState(0);

  const inVoice = voiceChannel !== null;
  const sessionEpoch = useRef(0);
  const screenEpoch = useRef(0);
  const cameraEpoch = useRef(0);
  const joining = useRef(false);
  const capturing = useRef(false);
  const cameraPending = useRef(false);
  const [screenStarting, setScreenStarting] = useState(false);
  const captureAbort = useRef<AbortController | null>(null);
  const micBeforeDeafen = useRef(true);
  const earlySignals = useRef(new Map<string, Array<{ description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; streams?: Record<string, string> }>>());
  const signalHandler = useRef<(packet: {from: string; data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; streams?: Record<string, string> }}) => void>(() => {});
  const streamKinds = () => {
    const kinds: Record<string, string> = {};
    if (micStream.current) kinds[micStream.current.id] = 'mic';
    if (camStream.current) kinds[camStream.current.id] = 'cam';
    if (screenStream.current) kinds[screenStream.current.id] = 'screen';
    return kinds;
  };

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
  /** estado da porta de ruído, fora do React para não re-renderizar a cada 120ms */
  const portaAbertaAte = useRef(0);
  const portaEstaAberta = useRef(true);
  const micLigadoRef = useRef(true);

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
        /*
         * A suavização padrão do WebAudio é 0.8: o nível medido leva segundos
         * para cair depois que o som para. Isso deixa a porta de ruído aberta
         * muito além do necessário, justamente durante as batidas de teclado
         * que ela deveria cortar.
         */
        analyser.smoothingTimeConstant = 0.3;
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
      const nivel = Math.min(100, Math.round((mine / 60) * 100));
      setInputLevel(nivel);

      /*
       * Porta de ruído: teclado e chiado passam pela supressão do navegador,
       * que é boa para som contínuo e fraca para batidas curtas. Aqui o
       * microfone só abre quando o nível passa do limiar, e fica aberto por
       * mais um instante para não cortar o fim das palavras.
       */
      if (cfg.current.noiseGate && mixer.current && micLigadoRef.current) {
        const falando = nivel >= cfg.current.noiseGateThreshold;
        if (falando) portaAbertaAte.current = Date.now() + 400;
        const aberta = Date.now() < portaAbertaAte.current;
        if (aberta !== portaEstaAberta.current) {
          portaEstaAberta.current = aberta;
          mixer.current.setMicGain(aberta ? cfg.current.inputVolume : 0);
        }
      }
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

      if (volume === 100 && !precisaMixer.current && !cfg.current.noiseGate) return raw;

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
    const preset = cfg.current.screenPreset;
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    if (transceiver) preferScreenCodecs(transceiver, preset);
    void tuneScreenSender(sender, preset, peers.current.size, cfg.current.screenFps);
  }, []);

  /**
   * Reajusta o teto de banda quando entra ou sai gente: numa malha P2P cada
   * espectador a mais é uma cópia a mais saindo do seu upload.
   */
  const reajustarBandaDaTela = useCallback(() => {
    const preset = cfg.current.screenPreset;
    const quantos = peers.current.size;
    for (const peer of peers.current.values()) {
      if (peer.screenVideoSender) {
        void tuneScreenSender(peer.screenVideoSender, preset, quantos, cfg.current.screenFps);
      }
    }
  }, []);

  /**
   * Troca o codec da transmissão de tela.
   *
   * setCodecPreferences só vale numa negociação nova, e reaproveitar o sender
   * com replaceTrack não gera negociação nenhuma — o codec ficaria preso no que
   * foi escolhido da primeira vez. Por isso removemos e recriamos a track: é o
   * que garante que o preset realmente troque AV1 por VP9/H264.
   */
  const recriarEnvioDeTela = useCallback((seguro = false) => {
    const stream = screenStream.current;
    const video = stream?.getVideoTracks()[0];
    if (!stream || !video) return;

    const preset = cfg.current.screenPreset;
    const quantos = peers.current.size;

    for (const peer of peers.current.values()) {
      try {
        if (peer.screenVideoSender) peer.pc.removeTrack(peer.screenVideoSender);
        peer.screenVideoSender = peer.pc.addTrack(video, stream);
        const transceiver = peer.pc
          .getTransceivers()
          .find((t) => t.sender === peer.screenVideoSender);
        if (transceiver) preferScreenCodecs(transceiver, preset, seguro);
        void tuneScreenSender(peer.screenVideoSender, preset, quantos, cfg.current.screenFps);
      } catch {
        /* se falhar, a transmissão segue no codec anterior */
      }
    }
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
    const epoch = sessionEpoch.current;
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints(cfg.current));
    if (epoch !== sessionEpoch.current) { stream.getTracks().forEach(t => t.stop()); throw new Error('Chamada encerrada'); }
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

  /**
   * Mede o que o encoder está de fato enviando. Sem isso é impossível saber se
   * a transmissão caiu de resolução ou de fps — e o palpite costuma errar.
   */
  useEffect(() => {
    if (!localScreen) return;
    let anterior: { bytes: number; frames: number; ts: number } | null = null;

    const timer = setInterval(async () => {
      const sender = [...peers.current.values()].find((p) => p.screenVideoSender)?.screenVideoSender;
      if (!sender) return;
      try {
        const stats = await sender.getStats();
        stats.forEach((s) => {
          if (s.type !== 'outbound-rtp' || s.kind !== 'video') return;
          const bytes = s.bytesSent ?? 0;
          const frames = s.framesSent ?? 0;
          const ts = s.timestamp ?? 0;

          let kbps = 0;
          let fps = s.framesPerSecond ?? 0;
          if (anterior && ts > anterior.ts) {
            const dt = (ts - anterior.ts) / 1000;
            kbps = Math.round(((bytes - anterior.bytes) * 8) / dt / 1000);
            if (!fps) fps = Math.round((frames - anterior.frames) / dt);
          }
          anterior = { bytes, frames, ts };

          const capturado = screenStream.current?.getVideoTracks()[0]?.getSettings().frameRate ?? 0;
          setScreenStats({
            width: s.frameWidth ?? 0,
            height: s.frameHeight ?? 0,
            fps: Math.round(fps),
            captureFps: Math.round(capturado),
            kbps,
          });
        });
      } catch {
        /* sem estatísticas neste navegador */
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [localScreen]);

  /**
   * Vigia a codificação da tela. Se o codificador não produzir quadro nenhum,
   * o outro lado vê tela PRETA enquanto quem transmite continua vendo tudo
   * certo — a prévia local não passa pelo codificador. Nesse caso trocamos
   * para H264, que tem encoder de hardware em praticamente toda máquina.
   */
  const jaCaiuParaSeguro = useRef(false);
  const recriarRef = useRef<(seguro?: boolean) => void>(() => {});

  useEffect(() => {
    if (!localScreen) {
      jaCaiuParaSeguro.current = false;
      return;
    }
    let paradoDesde = 0;

    const timer = setInterval(async () => {
      const sender = [...peers.current.values()].find((p) => p.screenVideoSender)?.screenVideoSender;
      if (!sender) return;
      try {
        const stats = await sender.getStats();
        let frames = 0;
        stats.forEach((st) => {
          if (st.type === 'outbound-rtp' && st.kind === 'video') frames = st.framesSent ?? 0;
        });

        const parado = frames === 0; // Tela estática pode parar de gerar quadros sem ser falha.

        if (!parado) {
          paradoDesde = 0;
          return;
        }
        if (!paradoDesde) {
          paradoDesde = Date.now();
          return;
        }
        if (Date.now() - paradoDesde > 7000 && !jaCaiuParaSeguro.current) {
          jaCaiuParaSeguro.current = true;
          setScreenAudioInfo(
            'A transmissão não estava sendo codificada e apareceria preta para os outros. Troquei para um codec mais compatível (H264) automaticamente.'
          );
          recriarRef.current(true);
          paradoDesde = 0;
        }
      } catch {
        /* sem estatísticas: não há o que vigiar */
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [localScreen]);

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
        remoteKinds: {},
        isSettingRemoteAnswer: false,
        micSender: null,
        camSender: null,
        screenVideoSender: null,
        screenAudioSender: null,
        pendingCandidates: [],
        fila: Promise.resolve(),
      };
      peers.current.set(id, peer);

      /*
       * Entra na mesma fila dos sinais que chegam. Fora dela, criar a oferta
       * local corria junto com a oferta do outro lado e a conexão terminava
       * com descrições de negociações diferentes — ficava em "new" para
       * sempre, sem áudio nem imagem.
       */
      pc.onnegotiationneeded = () => {
        peer.fila = peer.fila.then(async () => {
          // se enquanto esperávamos a vez já entramos em outra negociação,
          // não há oferta a fazer: quem chegou primeiro manda
          if (pc.signalingState !== 'stable') return;
          try {
            peer.makingOffer = true;
            await pc.setLocalDescription();
            socket.emit('signal', { to: id, data: { description: pc.localDescription, streams: streamKinds() } });
          } catch (err) {
            console.error('negociação falhou', err);
          } finally {
            peer.makingOffer = false;
          }
        });
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('signal', { to: id, data: { candidate } });
      };

      pc.ontrack = ({ streams, track }) => {
        const stream = streams[0];
        if (!stream) return;
        // Conservar o tipo mesmo quando a próxima descrição remove esta tela.
        let kind = peer.remoteKinds[stream.id];
        const update = () => {
          if (peers.current.get(id) !== peer) return;
          kind ||= peer.remoteKinds[stream.id];
          const isMic = kind === 'mic' || (!kind && stream.getVideoTracks().length === 0 && stream.getAudioTracks().some(t => t.readyState === 'live'));
          setRemoteStreams(prev => {
            const before = prev[id];
            const videos = (before?.videos ?? []).filter(v => v.id !== stream.id && v.getTracks().some(t => t.readyState === 'live'));
            if (!isMic && stream.getTracks().some(t => t.readyState === 'live')) videos.push(stream);
            return { ...prev, [id]: { mic: isMic ? stream : before?.mic, videos } };
          });
          if (isMic) watchLevel(id, stream);
        };
        track.addEventListener('unmute', update);
        stream.addEventListener('addtrack', update);
        stream.addEventListener('removetrack', update);
        update();
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') pc.restartIce();
        if (pc.connectionState === 'connected' && peer.screenVideoSender) {
          afinarEnvioDeTela(pc, peer.screenVideoSender);
        }
      };

      const pending = earlySignals.current.get(id);
      earlySignals.current.delete(id);
      if (pending) queueMicrotask(() => pending.forEach(data => signalHandler.current({from:id, data})));

      // tracks entram depois dos handlers para a renegociação ser capturada
      if (outgoingMic.current && micStream.current) {
        peer.micSender = pc.addTrack(outgoingMic.current, micStream.current);
      }
      // vídeo antes do áudio: assim o outro lado já classifica a stream como tela
      const cam = camStream.current;
      if (cam) {
        const video = cam.getVideoTracks()[0];
        if (video) peer.camSender = pc.addTrack(video, cam);
      }

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

  useEffect(() => {
    recriarRef.current = recriarEnvioDeTela;
  });

  // reconcilia a malha sempre que a lista do canal de voz muda
  useEffect(() => {
    if (!inVoice) return;
    const wanted = new Set(peerIds);
    for (const id of wanted) createPeer(id);
    for (const id of [...peers.current.keys()]) if (!wanted.has(id)) dropPeer(id);
    if (screenStream.current) reajustarBandaDaTela();
  }, [peerIds, inVoice, createPeer, dropPeer, reajustarBandaDaTela]);

  // ---------------------------------------------------------- sinalização
  useEffect(() => {
    const socket = getSocket();

    type Sinal = {
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      streams?: Record<string, string>;
    };

    const processar = async (peer: Peer, from: string, data: Sinal) => {
      const { pc } = peer;

      try {
        if (data.description) {
          const collision =
            data.description.type === 'offer' && (peer.makingOffer || (pc.signalingState !== 'stable' && !peer.isSettingRemoteAnswer));
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;

          if (data.streams) peer.remoteKinds = data.streams;
          peer.isSettingRemoteAnswer = data.description.type === 'answer';
          try { await pc.setRemoteDescription(data.description); }
          finally { peer.isSettingRemoteAnswer = false; }

          // agora que existe descrição remota, aplica o que ficou na fila
          const queued = peer.pendingCandidates.splice(0);
          for (const candidate of queued) {
            // o que ainda não servir volta para a fila: descartar aqui foi
            // exatamente o que deixava a conexão presa em "new"
            await pc.addIceCandidate(candidate).catch(() => {
              if (peer.pendingCandidates.length < 100) peer.pendingCandidates.push(candidate);
            });
          }

          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('signal', { to: from, data: { description: pc.localDescription, streams: streamKinds() } });
          }
          if (peer.screenVideoSender) {
            void tuneScreenSender(peer.screenVideoSender, cfg.current.screenPreset, peers.current.size, cfg.current.screenFps);
          }
        } else if (data.candidate) {
          if (peer.ignoreOffer) return;
          // candidato pode chegar antes da oferta/resposta: guarda para depois,
          // senão a conexão fica presa em "new" e ninguém se ouve
          if (!pc.remoteDescription) {
            if (peer.pendingCandidates.length < 100) peer.pendingCandidates.push(data.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            // pode ser de uma renegociação que ainda não aplicamos: guarda em
            // vez de descartar, e tenta de novo na próxima descrição remota
            if (peer.pendingCandidates.length < 100) peer.pendingCandidates.push(data.candidate);
            if (!peer.ignoreOffer) console.warn('candidato adiado', err);
          }
        }
      } catch (err) {
        console.error('sinalização', err);
      }
    };

    /*
     * Cada participante tem sua própria fila: os sinais dele são tratados um
     * de cada vez. Antes o handler era async e várias entregas corriam juntas,
     * então um candidato podia ser aplicado no meio da troca de descrição e
     * era descartado pelo navegador.
     */
    const onSignal = ({ from, data }: { from: string; data: Sinal }) => {
      const peer = peers.current.get(from);
      if (!peer) {
        const queue = earlySignals.current.get(from) ?? [];
        if (earlySignals.current.size < 16 && queue.length < 100) { queue.push(data); earlySignals.current.set(from, queue); }
        return;
      }
      peer.fila = peer.fila.then(() => processar(peer, from, data));
    };

    signalHandler.current = onSignal;
    socket.on('signal', onSignal);
    return () => {
      socket.off('signal', onSignal);
    };
  }, []);

  // ---------------------------------------------------------------- ações
  const joinVoice = useCallback(
    async (channelId: string) => {
      const socket = getSocket();
      if (joining.current || !socket.connected) return;
      joining.current = true;
      const epoch = sessionEpoch.current;
      setError(null);
      setConnecting(true);
      try {
        if (!micStream.current) await acquireMic();
        if (epoch !== sessionEpoch.current) return;
        if (rawMic.current) rawMic.current.enabled = true;
        if (outgoingMic.current) outgoingMic.current.enabled = true;
        setMicOn(true);
        setDeafened(false);
        setMicLive(true);
        setVoiceChannel(channelId);
        socket.emit('voice:join', { channelId });
        socket.emit('state', { muted: false, deafened: false, sharing: !!screenStream.current, camOn: !!camStream.current, screenStreamId: screenStream.current?.id ?? null, camStreamId: camStream.current?.id ?? null });
      } catch {
        setError('Não consegui acessar o microfone. Libere a permissão no navegador e tente de novo.');
      } finally {
        joining.current = false;
        setConnecting(false);
      }
    },
    [acquireMic]
  );

  const stopScreen = useCallback(() => {
    screenEpoch.current++;
    captureAbort.current?.abort();
    captureAbort.current = null;
    setScreenStats(null);
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setLocalScreen(null);
    setScreenHasAudio(false);
    setScreenAudioInfo(null);
    for (const peer of peers.current.values()) {
      if (peer.screenVideoSender) peer.pc.removeTrack(peer.screenVideoSender);
      if (peer.screenAudioSender) peer.pc.removeTrack(peer.screenAudioSender);
      peer.screenVideoSender = null; peer.screenAudioSender = null;
    }
    getSocket().emit('state', { sharing: false, screenStreamId: null });
  }, []);

  const stopCam = useCallback(() => {
    cameraEpoch.current++;
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    setLocalCam(null);
    for (const peer of peers.current.values()) {
      if (peer.camSender) peer.pc.removeTrack(peer.camSender);
      peer.camSender = null;
    }
    getSocket().emit('state', { camOn: false, camStreamId: null });
  }, []);

  const startCam = useCallback(async () => {
    if (!micStream.current || camStream.current || cameraPending.current) return;
    cameraPending.current = true;
    const epoch = cameraEpoch.current;
    try {
      const dev = cfg.current.videoDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(dev ? { deviceId: { exact: dev } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      if (epoch !== cameraEpoch.current || !micStream.current) { stream.getTracks().forEach(t => t.stop()); return; }
      camStream.current = stream;
      setLocalCam(stream);

      const video = stream.getVideoTracks()[0];
      // rosto em movimento: fluidez importa mais que nitidez de detalhe
      applyContentHint(video, 'motion');
      // se o usuário desligar a câmera pelo sistema
      video.addEventListener('ended', () => { if (camStream.current === stream) stopCam(); });

      for (const peer of peers.current.values()) {
        if (peer.camSender) void peer.camSender.replaceTrack(video).catch(() => {});
        else peer.camSender = peer.pc.addTrack(video, stream);
      }
      // o id da stream é o que permite ao outro lado saber que isto é câmera
      getSocket().emit('state', { camOn: true, camStreamId: stream.id });
    } catch {
      setError('Não consegui acessar a câmera. Libere a permissão no navegador e tente de novo.');
    } finally { cameraPending.current = false; }
  }, [stopCam]);

  const toggleCam = useCallback(() => {
    if (camStream.current) stopCam();
    else void startCam();
  }, [startCam, stopCam]);

  const leaveVoice = useCallback(() => {
    sessionEpoch.current++;
    earlySignals.current.clear();
    stopScreen();
    stopCam();
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
    setRemoteStreams({});
    setSpeaking({});
    setDeafened(false);
    setInputLevel(0);
    getSocket().emit('voice:leave');
  }, [myId, dropPeer, stopScreen, stopCam, unwatchLevel]);

  useEffect(() => {
    micLigadoRef.current = micOn && !deafened;
  }, [micOn, deafened]);

  const setMicEnabled = useCallback((on: boolean) => {
    if (rawMic.current) rawMic.current.enabled = on;
    if (outgoingMic.current) outgoingMic.current.enabled = on;
    setMicOn(on);
    getSocket().emit('state', { muted: !on });
  }, []);

  const toggleMic = useCallback(() => {
    if (!rawMic.current) return;
    if (deafened) { setDeafened(false); getSocket().emit('state', { deafened: false }); }
    setMicEnabled(!rawMic.current.enabled);
  }, [setMicEnabled, deafened]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    setDeafened(next);
    if (next) {
      micBeforeDeafen.current = micOn;
      if (rawMic.current) rawMic.current.enabled = false;
      if (outgoingMic.current) outgoingMic.current.enabled = false;
      setMicOn(false);
      getSocket().emit('state', { deafened: true, muted: true });
    } else {
      setMicEnabled(micBeforeDeafen.current);
      getSocket().emit('state', { deafened: false });
    }
  }, [deafened, micOn, setMicEnabled]);

  const startScreen = useCallback(async () => {
    if (!micStream.current || screenStream.current || capturing.current) return;
    capturing.current = true;
    setScreenStarting(true);
    setError(null);
    const epoch = screenEpoch.current;
    const abort = new AbortController();
    captureAbort.current = abort;
    let stream: MediaStream | null = null;
    try {
      const { screenPreset: preset, screenFps: fps, screenAudio: audioMode } = cfg.current;
      stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints(preset, fps, audioMode));
      if (epoch !== screenEpoch.current || !micStream.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const video = stream.getVideoTracks()[0];
      if (!video) throw new Error('A origem não entregou vídeo');
      let info: string | null = null;
      const surface = displaySurfaceOf(video);
      // Áudio global repete a chamada. Só conservar a faixa de uma aba isolada.
      if (surface !== 'browser') {
        stream.getAudioTracks().forEach(track => { track.stop(); stream!.removeTrack(track); });
      }
      if (!stream.getAudioTracks().length && audioMode !== 'none') {
        info = 'Transmitindo sem som. Para incluir áudio sem repetir a chamada, escolha uma aba do Chrome ou Edge e marque "Compartilhar áudio da aba".';
      }
      if (epoch !== screenEpoch.current || !micStream.current || video.readyState !== 'live') {
        stream.getTracks().forEach(t => t.stop()); return;
      }
      const captured = stream;
      screenStream.current = captured;
      const audio = captured.getAudioTracks()[0];
      setScreenAudioInfo(info);
      setScreenHasAudio(!!audio);
      setLocalScreen(captured);
      applyContentHint(video, preset);
      await pushFrameRate(video, fps);
      if (screenStream.current !== captured) return;
      video.addEventListener('ended', () => { if (screenStream.current === captured) stopScreen(); });
      for (const peer of peers.current.values()) {
        peer.screenVideoSender = peer.pc.addTrack(video, captured);
        afinarEnvioDeTela(peer.pc, peer.screenVideoSender);
        if (audio) peer.screenAudioSender = peer.pc.addTrack(audio, captured);
      }
      getSocket().emit('state', { sharing: true, screenStreamId: captured.id });
    } catch (err) {
      if (stream && screenStream.current === stream) stopScreen();
      stream?.getTracks().forEach(t => t.stop());
      if (err instanceof DOMException && err.name === 'NotAllowedError') return;
      if (abort.signal.aborted) return;
      setError('Não foi possível iniciar a transmissão. Verifique a janela escolhida e tente novamente.');
    } finally { capturing.current = false; setScreenStarting(false); }
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

      if (next.screenFps !== previous.screenFps && screenStream.current) {
        const video = screenStream.current.getVideoTracks()[0];
        if (video) await pushFrameRate(video, next.screenFps);
        reajustarBandaDaTela();
      }
      if (next.screenPreset !== previous.screenPreset && screenStream.current) {
        const video = screenStream.current.getVideoTracks()[0];
        if (video) applyContentHint(video, next.screenPreset);
        // recria para o codec do novo preset valer de verdade
        recriarEnvioDeTela();
      }

      const precisaRecapturar =
        next.inputDeviceId !== previous.inputDeviceId ||
        next.echoCancellation !== previous.echoCancellation ||
        next.noiseSuppression !== previous.noiseSuppression ||
        next.autoGainControl !== previous.autoGainControl ||
        next.voiceIsolation !== previous.voiceIsolation;

      try {
        if (precisaRecapturar) {
          const wasEnabled = rawMic.current?.enabled ?? true;
          const track = await acquireMic();
          track.enabled = wasEnabled;
          if (rawMic.current) rawMic.current.enabled = wasEnabled;
          pushMicToPeers(track);
          setMicLive(true);
        } else if (next.noiseGate !== previous.noiseGate) {
          // ligar ou desligar a porta muda se o mixer precisa existir
          const wasEnabled = rawMic.current?.enabled ?? true;
          const track = buildOutgoing(rawMic.current!, next.inputVolume);
          track.enabled = wasEnabled;
          outgoingMic.current = track;
          pushMicToPeers(track);
          portaEstaAberta.current = true;
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
    [acquireMic, buildOutgoing, pushMicToPeers, recriarEnvioDeTela, reajustarBandaDaTela]
  );

  // encerra tudo ao desmontar
  useEffect(
    () => () => {
      sessionEpoch.current++; screenEpoch.current++; cameraEpoch.current++;
      captureAbort.current?.abort();
        mixer.current?.destroy();
      for (const item of analysers.current.values()) item.src.disconnect();
      analysers.current.clear();
      for (const peer of peers.current.values()) peer.pc.close();
      peers.current.clear();
      micStream.current?.getTracks().forEach((t) => t.stop());
      camStream.current?.getTracks().forEach((t) => t.stop());
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
    localCam,
    screenStats,
    screenAudioInfo,
    dismissScreenAudioInfo: () => setScreenAudioInfo(null),
    screenHasAudio,
    screenStarting,
    remoteStreams,
    speaking,
    inputLevel,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    startScreen,
    stopScreen,
    startCam,
    stopCam,
    toggleCam,
    applySettings,
    clearError: () => setError(null),
  };
}
