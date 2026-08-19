'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { migrarChavesAntigas, saveName, useStoredName } from '@/lib/useStoredName';
import { Wordmark } from '@/components/Brand';

migrarChavesAntigas();

function randomRoomId() {
  const alpha = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => alpha[b % alpha.length]).join('');
}

export default function Home() {
  const router = useRouter();
  const stored = useStoredName();
  const [typed, setTyped] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // enquanto o usuário não digitar nada, mostramos o último nome usado
  const name = typed ?? stored ?? '';
  const setName = (v: string) => setTyped(v);

  const createRoom = () => {
    if (!name.trim()) return;
    saveName(name.trim());
    router.push(`/room/${randomRoomId()}`);
  };

  const joinRoom = () => {
    const id = code.trim().replace(/.*\/room\//, '');
    if (!name.trim() || !id) return;
    saveName(name.trim());
    router.push(`/room/${id}`);
  };

  const ready = name.trim().length > 0;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-900 p-4">
      {/* brilho de fundo, discreto, só para a página não ficar chapada */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{ background: 'radial-gradient(circle, var(--color-blurple), transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark />
          <p className="mt-3 text-[15px] leading-snug text-mute">
            Crie uma sala, mande o link
            <br />e chame a galera.
          </p>
        </div>

        <div className="rounded-xl bg-ink-500 p-6 shadow-2xl ring-1 ring-white/5">
          <label htmlFor="nome" className="mb-2 block text-xs font-bold tracking-wide text-soft uppercase">
            Seu nome
          </label>
          <input
            id="nome"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            placeholder="Como a galera te conhece"
            autoFocus
            className="mb-5 w-full rounded-lg bg-ink-900 px-3.5 py-3 text-bright outline-none ring-blurple transition placeholder:text-ink-200 focus:ring-2"
          />

          <button
            onClick={createRoom}
            disabled={!ready}
            className="w-full rounded-lg bg-blurple py-3 font-semibold text-white shadow-lg shadow-blurple/20 transition hover:bg-blurple-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Criar sala
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] tracking-wide text-mute uppercase">
            <span className="h-px flex-1 bg-ink-400" />
            ou entre em uma
            <span className="h-px flex-1 bg-ink-400" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="Código ou link"
              aria-label="Código ou link da sala"
              className="min-w-0 flex-1 rounded-lg bg-ink-900 px-3.5 py-2.5 text-bright outline-none ring-blurple transition placeholder:text-ink-200 focus:ring-2"
            />
            <button
              onClick={joinRoom}
              disabled={!ready || !code.trim()}
              className="rounded-lg bg-ink-400 px-5 font-medium text-bright transition hover:bg-ink-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-mute">
          Voz, câmera e tela funcionam em <b className="text-soft">localhost</b> ou em endereços{' '}
          <b className="text-soft">https</b>.
        </p>
      </div>
    </main>
  );
}
