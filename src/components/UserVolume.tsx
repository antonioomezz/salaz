'use client';

import { useEffect, useRef } from 'react';
import type { UserAudio } from '@/lib/userVolumes';
import { Mic, Screen, Speaker, SpeakerMuted } from './icons';

type Props = {
  name: string;
  audio: UserAudio;
  /** só mostra o controle da live se a pessoa estiver transmitindo */
  sharing: boolean;
  onChange: (patch: Partial<UserAudio>) => void;
  onClose: () => void;
};

/** Popover de volume individual, no espírito do menu de usuário do Discord. */
export function UserVolume({ name, audio, sharing, onChange, onClose }: Props) {
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
      className="pop-in absolute right-2 z-40 mt-1 w-60 rounded-lg bg-ink-800 p-3 shadow-2xl ring-1 ring-black/40"
    >
      <div className="mb-3 truncate text-xs font-bold tracking-wide text-soft uppercase">{name}</div>

      <Fader
        icon={<Mic className="h-3.5 w-3.5" />}
        label="Voz"
        value={audio.volume}
        disabled={audio.muted}
        onChange={(v) => onChange({ volume: v })}
      />

      {sharing && (
        <div className="mt-3">
          <Fader
            icon={<Screen className="h-3.5 w-3.5" />}
            label="Live"
            value={audio.screenVolume}
            disabled={audio.muted}
            onChange={(v) => onChange({ screenVolume: v })}
          />
          <p className="mt-1 text-[10px] leading-tight text-mute">
            Separado da voz: quem transmite a tela inteira com som acaba repetindo o áudio da
            própria chamada. Zere aqui para ouvir só as vozes.
          </p>
        </div>
      )}

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
    </div>
  );
}

function Fader({
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-soft">
          {icon}
          {label}
        </span>
        <span className={`text-[11px] ${value > 100 ? 'text-amber-400' : 'text-mute'}`}>
          {disabled ? '—' : `${value}%`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        step={5}
        value={value}
        disabled={disabled}
        aria-label={`Volume — ${label}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blurple disabled:opacity-40"
      />
    </div>
  );
}
