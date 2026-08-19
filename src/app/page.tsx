'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { migrarChavesAntigas, saveName, useStoredName } from '@/lib/useStoredName';

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
    <main className="flex min-h-dvh items-center justify-center bg-ink-800 p-4">
      <div className="w-full max-w-md rounded-lg bg-ink-500 p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blurple text-2xl">
            🎧
          </div>
          <h1 className="text-2xl font-bold text-white">Negoneycord</h1>
          <p className="mt-1 text-sm text-mute">
            Crie uma sala, mande o link e chame a galera.
          </p>
        </div>

        <label className="mb-1.5 block text-xs font-bold tracking-wide text-soft uppercase">
          Seu nome
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          onKeyDown={(e) => e.key === 'Enter' && createRoom()}
          placeholder="Antônio"
          autoFocus
          className="mb-5 w-full rounded bg-ink-900 px-3 py-2.5 text-bright outline-none ring-blurple placeholder:text-ink-200 focus:ring-2"
        />

        <button
          onClick={createRoom}
          disabled={!ready}
          className="w-full rounded bg-blurple py-2.5 font-medium text-white transition hover:bg-blurple-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Criar sala
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-mute">
          <span className="h-px flex-1 bg-ink-400" />
          ou entre em uma existente
          <span className="h-px flex-1 bg-ink-400" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="Código ou link da sala"
            className="min-w-0 flex-1 rounded bg-ink-900 px-3 py-2.5 text-bright outline-none ring-blurple placeholder:text-ink-200 focus:ring-2"
          />
          <button
            onClick={joinRoom}
            disabled={!ready || !code.trim()}
            className="rounded bg-ink-400 px-4 font-medium text-bright transition hover:bg-ink-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Entrar
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-mute">
          Microfone e tela funcionam em <b>localhost</b> ou em endereços <b>https</b>.
        </p>
      </div>
    </main>
  );
}
