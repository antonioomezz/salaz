'use client';

import { useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { Expand, Screen, Speaker, SpeakerMuted } from './icons';

export type Share = {
  user: User;
  stream: MediaStream;
  isLocal: boolean;
  /** 0-200: volume individual configurado para esta pessoa */
  userVolume: number;
  userMuted: boolean;
};

type Props = {
  shares: Share[];
  /** 0-100 */
  volume: number;
  deafened: boolean;
  outputDeviceId: string;
};

export function Stage({ shares, volume, deafened, outputDeviceId }: Props) {
  if (!shares.length) return null;

  return (
    <div className="shrink-0 border-b border-ink-900/60 bg-ink-900 p-3">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(shares.length, 2)}, minmax(0, 1fr))` }}
      >
        {shares.map((share) => (
          <Tile
            key={share.user.id}
            share={share}
            solo={shares.length === 1}
            volume={(volume / 100) * share.userVolume}
            deafened={deafened}
            outputDeviceId={outputDeviceId}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({
  share,
  solo,
  volume,
  deafened,
  outputDeviceId,
}: {
  share: Share;
  solo: boolean;
  volume: number;
  deafened: boolean;
  outputDeviceId: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const temAudio = share.stream.getAudioTracks().length > 0;

  useEffect(() => {
    const el = video.current;
    if (el && el.srcObject !== share.stream) {
      el.srcObject = share.stream;
      el.play().catch(() => {});
    }
  }, [share.stream]);

  // o próprio vídeo carrega o som da tela; a nossa própria transmissão fica
  // sempre muda para não criar realimentação com o alto-falante
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    // o som da própria transmissão fica sempre mudo para não realimentar
    el.muted = share.isLocal || deafened || share.userMuted;
    // o elemento aceita no máximo 1.0; acima disso seria preciso WebAudio
    el.volume = Math.max(0, Math.min(1, volume / 100));
  }, [share.isLocal, share.userMuted, deafened, volume]);

  useEffect(() => {
    const el = video.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el?.setSinkId || share.isLocal) return;
    void el.setSinkId(outputDeviceId).catch(() => {});
  }, [outputDeviceId, share.isLocal]);

  return (
    <div className="group relative overflow-hidden rounded-lg bg-black ring-1 ring-ink-400">
      <video
        ref={video}
        autoPlay
        playsInline
        className="w-full bg-black object-contain"
        style={{ maxHeight: solo ? '46vh' : '30vh' }}
      />

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs text-white">
        <Screen className="h-3.5 w-3.5 text-online" />
        {share.isLocal ? 'Você está transmitindo' : `${share.user.name} está transmitindo`}
        {temAudio ? (
          <Speaker className="h-3.5 w-3.5 text-online" />
        ) : (
          <SpeakerMuted className="h-3.5 w-3.5 text-mute" />
        )}
      </div>

      <button
        onClick={() => video.current?.requestFullscreen?.()}
        title="Tela cheia"
        className="absolute top-2 right-2 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
      >
        <Expand className="h-4 w-4" />
      </button>
    </div>
  );
}
