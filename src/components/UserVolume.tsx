'use client';

import { useEffect, useRef } from 'react';
import type { UserAudio } from '@/lib/userVolumes';
import { Speaker, SpeakerMuted } from './icons';

type Props = {
  name: string;
  audio: UserAudio;
  onChange: (patch: Partial<UserAudio>) => void;
  onClose: () => void;
};

/** Popover de volume individual, no espírito do menu de usuário do Discord. */
export function UserVolume({ name, audio, onChange, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // no próximo tick, senão o clique que abriu já fecharia o popover
    const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      className="pop-in absolute right-2 z-40 mt-1 w-56 rounded-lg bg-ink-800 p-3 shadow-2xl ring-1 ring-black/40"
    >
      <div className="mb-2 truncate text-xs font-bold tracking-wide text-soft uppercase">{name}</div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] text-mute">Volume</span>
        <span className="text-[11px] text-mute">{audio.muted ? 'silenciado' : `${audio.volume}%`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={audio.volume}
        disabled={audio.muted}
        onChange={(e) => onChange({ volume: Number(e.target.value) })}
        className="w-full accent-blurple disabled:opacity-40"
      />

      <button
        onClick={() => onChange({ muted: !audio.muted })}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition ${
          audio.muted
            ? 'bg-danger text-white hover:bg-danger-dark'
            : 'bg-ink-400 text-bright hover:bg-ink-300'
        }`}
      >
        {audio.muted ? <SpeakerMuted className="h-4 w-4" /> : <Speaker className="h-4 w-4" />}
        {audio.muted ? 'Ouvir de novo' : 'Silenciar esta pessoa'}
      </button>

      {audio.volume > 100 && !audio.muted && (
        <p className="mt-2 text-[10px] leading-tight text-mute">
          Acima de 100% o áudio é amplificado — pode distorcer.
        </p>
      )}
    </div>
  );
}
