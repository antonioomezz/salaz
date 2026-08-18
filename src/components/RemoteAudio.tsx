'use client';

import { useEffect, useRef } from 'react';
import { sharedAudioContext } from '@/lib/audioContext';

type Props = {
  stream: MediaStream;
  /** silenciado globalmente (fone desligado) ou só esta pessoa */
  muted: boolean;
  /** 0-200, já combinando volume geral e volume desta pessoa */
  volume: number;
  outputDeviceId: string;
};

/**
 * Áudio de um participante.
 *
 * Até 100% usamos só `el.volume` — nenhum WebAudio no caminho, risco zero.
 * Acima de 100% precisamos amplificar, e aí entra um GainNode; o elemento fica
 * mudo, mas continua com `srcObject` atribuído porque o Chrome só faz a stream
 * remota fluir para o WebAudio se ela também estiver presa a um elemento.
 */
export function RemoteAudio({ stream, muted, volume, outputDeviceId }: Props) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    const el = ref.current as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!el?.setSinkId) return;
    void el.setSinkId(outputDeviceId).catch(() => {});
  }, [outputDeviceId]);

  const boost = volume > 100 && !muted;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!boost) {
      el.muted = muted;
      el.volume = Math.max(0, Math.min(1, volume / 100));
      return;
    }

    const ctx = sharedAudioContext();
    if (!ctx) {
      // sem WebAudio: cai para o teto de 100%
      el.muted = muted;
      el.volume = 1;
      return;
    }

    el.muted = true;
    let src: MediaStreamAudioSourceNode;
    let gain: GainNode;
    try {
      src = ctx.createMediaStreamSource(stream);
      gain = ctx.createGain();
      gain.gain.value = volume / 100;
      src.connect(gain).connect(ctx.destination);
    } catch {
      el.muted = false;
      el.volume = 1;
      return;
    }

    return () => {
      src.disconnect();
      gain.disconnect();
    };
  }, [boost, muted, volume, stream]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
