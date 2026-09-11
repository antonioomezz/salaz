'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { migrarChavesAntigas, saveName, useStoredName } from '@/lib/useStoredName';
import { Wordmark } from '@/components/Brand';
import { VersionBadge } from '@/components/VersionBadge';
import { Mic, Screen, Hash } from '@/components/icons';

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
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false);
  const name = typed ?? stored ?? '';
  const ready = !!name.trim() && !entering;

  const enter = (id: string) => {
    if (!ready) return;
    saveName(name.trim());
    setEntering(true);
    router.push(`/room/${encodeURIComponent(id)}`);
  };
  const joinRoom = () => {
    const raw = code.trim();
    let id = raw;
    try {
      if (/^https?:\/\//i.test(raw)) {
        id = new URL(raw).pathname.match(/^\/room\/([^/]+)\/?$/)?.[1] ?? '';
      } else if (raw.includes('/room/')) {
        id = raw.split('/room/')[1]?.split(/[?#/]/)[0] ?? '';
      }
    } catch { id = ''; }
    if (!/^[\w-]{1,80}$/.test(id)) {
      setError('Confira o código ou cole o link completo da sala.');
      return;
    }
    setError('');
    enter(id);
  };

  return (
    <main className="entry-page min-h-dvh bg-ink-900 px-5 py-10 sm:px-8">
      <header className="entry-brand mx-auto w-full max-w-5xl"><Wordmark /></header>
      <div className="entry-content mx-auto grid w-full max-w-5xl gap-12 py-12 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-20">
        <section className="pop-in">
          <p className="mb-5 text-xs font-semibold tracking-[0.16em] text-online uppercase">Seu lugar de encontro</p>
          <h1 className="max-w-lg text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.06] font-semibold tracking-[-0.055em] text-white">A conversa<br />começa aqui.</h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-soft">Chama a galera. Liga o microfone. Compartilha a tela e fica à vontade.</p>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-mute">
            <span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Voz</span>
            <span className="flex items-center gap-2"><Screen className="h-4 w-4" /> Transmissão</span>
            <span className="flex items-center gap-2"><Hash className="h-4 w-4" /> Conversa</span>
          </div>
        </section>
        <section className="entry-card pop-in rounded-2xl border border-white/8 bg-ink-700 p-6 sm:p-8" aria-labelledby="entry-title">
          <h2 id="entry-title" className="text-xl font-semibold tracking-tight text-white">Vamos entrar?</h2>
          <p className="mt-1 mb-7 text-sm text-mute">Só precisa de um nome e uma boa companhia.</p>
          <label htmlFor="nome" className="mb-2 block text-sm font-medium text-soft">Como a galera te conhece</label>
          <input id="nome" value={name} onChange={(e) => setTyped(e.target.value.slice(0, 24))} onKeyDown={(e) => e.key === 'Enter' && enter(randomRoomId())} placeholder="Seu nome" autoComplete="nickname" maxLength={24} className="field mb-4 w-full rounded-lg bg-ink-900 px-3.5 py-3 text-bright" />
          <button onClick={() => enter(randomRoomId())} disabled={!ready} className="primary-button w-full rounded-lg py-3 text-sm font-semibold">{entering ? 'Abrindo sala…' : 'Criar uma sala'}</button>
          <div className="my-7 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-ink-400" />Já tem um convite?<span className="h-px flex-1 bg-ink-400" /></div>
          <label htmlFor="sala" className="mb-2 block text-sm font-medium text-soft">Código ou link da sala</label>
          <div className="flex gap-2">
            <input id="sala" value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && joinRoom()} placeholder="Cole o convite aqui" aria-invalid={!!error} aria-describedby={error ? 'room-error' : undefined} className="field min-w-0 flex-1 rounded-lg bg-ink-900 px-3.5 py-3 text-sm text-bright" />
            <button onClick={joinRoom} disabled={!ready || !code.trim()} className="secondary-button rounded-lg px-4 text-sm font-semibold">Entrar</button>
          </div>
          {error && <p id="room-error" role="alert" className="mt-3 text-xs text-danger">{error}</p>}
          <p className="mt-6 text-xs leading-5 text-mute">Sua sala fica pronta para compartilhar por link.</p>
        </section>
      </div>
      <footer className="mx-auto w-full max-w-5xl border-t border-white/6 pt-5 text-xs text-mute">Um espaço para estar junto.</footer>
      <VersionBadge />
    </main>
  );
}