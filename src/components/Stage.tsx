'use client';

import { useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { Expand, Screen } from './icons';

export type Share = { user: User; stream: MediaStream; isLocal: boolean };

export function Stage({ shares }: { shares: Share[] }) {
  if (!shares.length) return null;

  return (
    <div className="shrink-0 border-b border-ink-900/60 bg-ink-900 p-3">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(shares.length, 2)}, minmax(0, 1fr))` }}
      >
        {shares.map((share) => (
          <Tile key={share.user.id} share={share} solo={shares.length === 1} />
        ))}
      </div>
    </div>
  );
}

function Tile({ share, solo }: { share: Share; solo: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (el && el.srcObject !== share.stream) {
      el.srcObject = share.stream;
      el.play().catch(() => {});
    }
  }, [share.stream]);

  return (
    <div className="group relative overflow-hidden rounded-lg bg-black ring-1 ring-ink-400">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        className="w-full bg-black object-contain"
        style={{ maxHeight: solo ? '46vh' : '30vh' }}
      />

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs text-white">
        <Screen className="h-3.5 w-3.5 text-online" />
        {share.isLocal ? 'Você está transmitindo' : `${share.user.name} está transmitindo`}
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
