'use client';

import { useEffect, type RefObject } from 'react';
import { sharedAudioContext } from '@/lib/audioContext';

type Opts = {
  /** 0-200. Acima de 100 exige amplificação por WebAudio. */
  volume: number;
  muted: boolean;
  /** true para a própria mídia: nunca toca, para não realimentar o microfone */
  isLocal?: boolean;
  outputDeviceId?: string;
};

/**
 * Aplica volume num <audio> ou <video> que carrega uma MediaStream remota.
 *
 * Até 100% usamos só `el.volume` — sem WebAudio no caminho, risco zero.
 * Acima disso o elemento HTML não ajuda: `el.volume` satura em 1. Aí o
 * elemento é silenciado e o som passa por um GainNode, que amplifica de
 * verdade. O `srcObject` continua atribuído porque o Chrome só entrega a
 * stream remota ao WebAudio se ela também estiver presa a um elemento.
 */
export function useMediaVolume(
  ref: RefObject<HTMLMediaElement | null>,
  stream: MediaStream | null,
  { volume, muted, isLocal = false, outputDeviceId = '' }: Opts
) {
  const silenciar = muted || isLocal;
  const amplificar = !silenciar && volume > 100 && !!stream;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!amplificar) {
      el.muted = silenciar;
      el.volume = Math.max(0, Math.min(1, volume / 100));
      return;
    }

    const ctx = sharedAudioContext();
    if (!ctx || !stream) {
      el.muted = silenciar;
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
      src.connect(gain);
      let active = true;
      const routed = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
      const connect = async () => {
        try {
          if (routed.setSinkId) await routed.setSinkId(outputDeviceId);
          else if (outputDeviceId) throw new Error('Saída alternativa indisponível no amplificador');
          if (active) gain.connect(ctx.destination);
        } catch {
          // Manter o som no dispositivo escolhido, mesmo sem amplificação disponível.
          if (active) { el.muted = false; el.volume = 1; }
        }
      };
      void connect();
      return () => { active = false; src.disconnect(); gain.disconnect(); };
    } catch {
      // sem WebAudio disponível, o teto volta a ser 100%
      el.muted = silenciar;
      el.volume = 1;
      return;
    }

  }, [ref, stream, volume, silenciar, amplificar, outputDeviceId]);
}
