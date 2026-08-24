'use client';

import { useEffect, useRef } from 'react';
import { useMediaVolume } from '@/hooks/useMediaVolume';

type Props = {
  stream: MediaStream;
  /** silenciado globalmente (fone desligado) ou só esta pessoa */
  muted: boolean;
  /** 0-200, já combinando volume geral e volume desta pessoa */
  volume: number;
  outputDeviceId: string;
};

/** Voz de um participante. O volume acima de 100% é amplificado por WebAudio. */
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

  useMediaVolume(ref, stream, { volume, muted });

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
