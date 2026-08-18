'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { iceServers } from '@/lib/rtc';
import { getSocket } from '@/lib/socket';

type Peer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  /** candidatos que chegaram antes da descrição remota; aplicados depois */
  pendingCandidates: RTCIceCandidateInit[];
};

type Params = {
  myId: string | null;
  /** ids dos outros usuários que estão no MESMO canal de voz que eu */
  peerIds: string[];
};

/**
 * Malha (mesh) WebRTC: cada participante abre uma conexão direta com cada um
 * dos outros. Aguenta bem até ~6-8 pessoas, suficiente para o MVP. Se um dia
 * precisar de SFU, só este arquivo muda.
 */
export function useVoice({ myId, peerIds }: Params) {
  const peers = useRef(new Map<string, Peer>());
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<Record<string, MediaStream>>({});
  const [remoteVideo, setRemoteVideo] = useState<Record<string, MediaStream>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  const inVoice = voiceChannel !== null;

  // ---------------------------------------------------------- detector de fala
  const audioCtx = useRef<AudioContext | null>(null);
  const analysers = useRef(
    new Map<
      string,
      { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; src: MediaStreamAudioSourceNode }
    >()
  );

  const watchLevel = useCallback((key: string, stream: MediaStream) => {
    try {
      if (!stream.getAudioTracks().length) return;
      audioCtx.current ||= new AudioContext();
      if (audioCtx.current.state === 'suspended') void audioCtx.current.resume();
      analysers.current.get(key)?.src.disconnect();

      const src = audioCtx.current.createMediaStreamSource(stream);
      const analyser = audioCtx.current.createAnalyser();
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
  }, []);

  const unwatchLevel = useCallback((key: string) => {
    analysers.current.get(key)?.src.disconnect();
    analysers.current.delete(key);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!analysers.current.size) return;
      const next: Record<string, boolean> = {};
      for (const [key, { analyser, data }] of analysers.current) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        next[key] = Math.sqrt(sum / data.length) > 12;
      }
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) if (!!prev[k] !== !!next[k]) return next;
        return prev;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

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
      setRemoteAudio((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      setRemoteVideo((m) => {
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
        audioSender: null,
        videoSender: null,
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

      pc.ontrack = ({ track, streams }) => {
        const stream = streams[0];
        if (!stream) return;
        if (track.kind === 'audio') {
          setRemoteAudio((m) => ({ ...m, [id]: stream }));
          watchLevel(id, stream);
        } else {
          setRemoteVideo((m) => ({ ...m, [id]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') pc.restartIce();
      };

      // tracks entram depois dos handlers para a renegociação ser capturada
      const audio = micStream.current?.getAudioTracks()[0];
      if (audio && micStream.current) peer.audioSender = pc.addTrack(audio, micStream.current);

      const video = screenStream.current?.getVideoTracks()[0];
      if (video && screenStream.current) peer.videoSender = pc.addTrack(video, screenStream.current);
    },
    [myId, watchLevel]
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
        if (!micStream.current) {
          micStream.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
          if (myId) watchLevel(myId, micStream.current);
        }
        micStream.current.getAudioTracks().forEach((t) => (t.enabled = true));
        setMicOn(true);
        setVoiceChannel(channelId);
        socket.emit('voice:join', { channelId });
        socket.emit('state', { muted: false, sharing: false });
      } catch {
        setError('Não consegui acessar o microfone. Libere a permissão no navegador e tente de novo.');
      } finally {
        setConnecting(false);
      }
    },
    [myId, watchLevel]
  );

  const stopScreen = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setLocalScreen(null);
    for (const peer of peers.current.values()) void peer.videoSender?.replaceTrack(null);
    getSocket().emit('state', { sharing: false });
  }, []);

  const leaveVoice = useCallback(() => {
    stopScreen();
    for (const id of [...peers.current.keys()]) dropPeer(id);
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    if (myId) unwatchLevel(myId);
    setVoiceChannel(null);
    setDeafened(false);
    getSocket().emit('voice:leave');
  }, [myId, dropPeer, stopScreen, unwatchLevel]);

  const toggleMic = useCallback(() => {
    const track = micStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    getSocket().emit('state', { muted: !track.enabled });
  }, []);

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => {
      const next = !prev;
      const track = micStream.current?.getAudioTracks()[0];
      if (next && track) {
        track.enabled = false;
        setMicOn(false);
      }
      getSocket().emit('state', next ? { deafened: true, muted: true } : { deafened: false });
      return next;
    });
  }, []);

  const startScreen = useCallback(async () => {
    const socket = getSocket();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      screenStream.current = stream;
      setLocalScreen(stream);

      const track = stream.getVideoTracks()[0];
      // botão nativo "parar compartilhamento" do navegador
      track.addEventListener('ended', () => stopScreen());

      for (const peer of peers.current.values()) {
        if (peer.videoSender) void peer.videoSender.replaceTrack(track);
        else peer.videoSender = peer.pc.addTrack(track, stream);
      }
      socket.emit('state', { sharing: true });
    } catch {
      /* usuário fechou o seletor de tela */
    }
  }, [stopScreen]);

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
    deafened,
    connecting,
    error,
    localScreen,
    remoteAudio,
    remoteVideo,
    speaking,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    startScreen,
    stopScreen,
  };
}
