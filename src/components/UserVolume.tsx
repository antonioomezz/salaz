'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserAudio } from '@/lib/userVolumes';
import { Mic, Screen, Speaker, SpeakerMuted } from './icons';

type Props = {
  name: string;
  audio: UserAudio;
  /** só mostra o controle da live se a pessoa estiver transmitindo */
  sharing: boolean;
  /** posição do item clicado, para ancorar o popover */
  anchor: DOMRect;
  onChange: (patch: Partial<UserAudio>) => void;
  onClose: () => void;
};

const LARGURA = 240;
const MARGEM = 8;

/**
 * Controle de volume individual.
 *
 * Vai para um portal com posição fixa de propósito: as duas listas que abrem
 * este popover têm `overflow-y-auto` e só 240px de largura, então um elemento
 * posicionado dentro delas seria recortado — o controle abria mas ficava
 * invisível.
 */
export function UserVolume({ name, audio, sharing, anchor, onChange, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // posiciona ao lado do item, sempre dentro da tela
  useLayoutEffect(() => {
    const altura = box.current?.offsetHeight ?? 200;

    // abre para a esquerda se couber (lista da direita); senão para a direita
    const cabeAEsquerda = anchor.left - LARGURA - MARGEM >= MARGEM;
    const left = cabeAEsquerda ? anchor.left - LARGURA - MARGEM : anchor.right + MARGEM;

    setPos({
      top: Math.min(Math.max(MARGEM, anchor.top), window.innerHeight - altura - MARGEM),
      left: Math.min(Math.max(MARGEM, left), window.innerWidth - LARGURA - MARGEM),
    });
  }, [anchor, sharing]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // no próximo tick, senão o clique que abriu já fecharia o popover
    const timer = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={box}
      style={{ width: LARGURA, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="pop-in fixed z-[60] rounded-lg bg-ink-800 p-3 shadow-2xl ring-1 ring-black/40"
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
            Separado da voz: quem transmite a tela inteira com som repete o áudio da própria
            chamada. Zere aqui para ouvir só as vozes.
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
    </div>,
    document.body
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
