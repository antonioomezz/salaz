'use client';

import { useEffect, useRef, useState } from 'react';
import type { Channel, Message } from '@/lib/types';
import { compressImage, isImageFile, type CompressedImage } from '@/lib/imageCompress';
import { Avatar } from './Avatar';
import { Clip, Send } from './icons';

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type Props = {
  channel: Channel | undefined;
  messages: Message[];
  onSend: (text: string, image?: CompressedImage) => void;
};

export function Chat({ channel, messages, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const [anexo, setAnexo] = useState<CompressedImage | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 250;
    if (nearBottom || messages.length <= 1) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const receberArquivo = async (file: Blob) => {
    setErro(null);
    try {
      setAnexo(await compressImage(file));
    } catch {
      setErro('Não consegui preparar essa imagem. Tente uma menor.');
    }
  };

  // colar imagem com Ctrl+V em qualquer lugar do chat
  const aoColar = (e: React.ClipboardEvent) => {
    const item = [...e.clipboardData.files].find(isImageFile);
    if (item) {
      e.preventDefault();
      void receberArquivo(item);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text && !anexo) return;
    onSend(text, anexo ?? undefined);
    setDraft('');
    setAnexo(null);
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setArrastando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        const file = [...e.dataTransfer.files].find(isImageFile);
        if (file) void receberArquivo(file);
      }}
    >
      {arrastando && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-blurple bg-ink-900/80 text-sm font-medium text-white">
          Solte a imagem para enviar
        </div>
      )}

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mb-6 border-b border-ink-400 pb-4">
          <h2 className="text-2xl font-bold text-white">Bem-vindo a #{channel?.name ?? '...'}</h2>
          <p className="text-sm text-mute">
            Este é o começo do canal. Manda ver — pode colar imagem com Ctrl+V.
          </p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const ehBot = m.kind === 'bot' || m.kind === 'card';
          const grouped =
            !ehBot && prev && prev.userId === m.userId && prev.kind !== 'bot' && m.ts - prev.ts < 5 * 60_000;

          return (
            <div key={m.id} className={`pop-in flex gap-3 px-1 ${grouped ? 'mt-0.5' : 'mt-4'}`}>
              <div className="w-10 shrink-0">
                {ehBot ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blurple text-lg">
                    🎵
                  </div>
                ) : grouped ? null : (
                  <Avatar user={m} size={40} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold" style={{ color: ehBot ? '#5865f2' : m.color }}>
                      {ehBot ? 'Negoneycord' : m.name}
                    </span>
                    {ehBot && (
                      <span className="rounded bg-blurple px-1 py-px text-[10px] font-bold text-white">
                        BOT
                      </span>
                    )}
                    <span className="text-[11px] text-mute">{time(m.ts)}</span>
                  </div>
                )}

                {m.text && (
                  <p
                    className={`text-[15px] leading-[1.4] break-words whitespace-pre-wrap ${
                      m.kind === 'image' && !m.image?.dataUrl ? 'text-mute italic' : 'text-bright'
                    }`}
                  >
                    {m.text}
                  </p>
                )}

                {m.image?.dataUrl && (
                  <button
                    onClick={() => setAmpliada(m.image!.dataUrl)}
                    className="mt-1 block max-w-md overflow-hidden rounded-lg ring-1 ring-ink-400 transition hover:ring-blurple"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image.dataUrl}
                      alt="imagem enviada no chat"
                      width={m.image.w}
                      height={m.image.h}
                      className="h-auto w-full"
                    />
                  </button>
                )}

                {m.card && <Card card={m.card} />}
              </div>
            </div>
          );
        })}
        <div ref={bottom} className="h-4" />
      </div>

      {erro && (
        <div className="mx-4 mb-1 rounded bg-danger/15 px-3 py-1.5 text-xs text-danger">{erro}</div>
      )}

      <div className="px-4 pt-1 pb-5">
        {anexo && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-ink-400 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anexo.dataUrl} alt="prévia" className="h-14 w-14 rounded object-cover" />
            <span className="flex-1 text-xs text-mute">
              {anexo.w}×{anexo.h} — pronta para enviar
            </span>
            <button
              onClick={() => setAnexo(null)}
              className="rounded px-2 py-1 text-xs text-mute transition hover:bg-ink-300 hover:text-white"
            >
              remover
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-lg bg-ink-400 px-4 py-2.5">
          <button
            onClick={() => fileInput.current?.click()}
            title="Enviar imagem"
            className="shrink-0 text-mute transition hover:text-white"
          >
            <Clip />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void receberArquivo(file);
              e.target.value = '';
            }}
          />
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onPaste={aoColar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Conversar em #${channel?.name ?? ''}`}
            className="max-h-40 flex-1 resize-none bg-transparent text-[15px] text-bright outline-none placeholder:text-mute"
          />
          <button
            onClick={send}
            disabled={!draft.trim() && !anexo}
            className="shrink-0 text-mute transition hover:text-white disabled:opacity-30"
            title="Enviar"
          >
            <Send />
          </button>
        </div>
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setAmpliada(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada}
            alt="imagem ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

function Card({ card }: { card: NonNullable<Message['card']> }) {
  const cor = card.source === 'spotify' ? '#1db954' : '#ff0000';
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex max-w-md items-center gap-3 overflow-hidden rounded-lg bg-ink-400 p-2 transition hover:bg-ink-300"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      {card.thumb && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={card.thumb} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-bright">{card.title}</span>
        {card.subtitle && <span className="block truncate text-xs text-mute">{card.subtitle}</span>}
      </span>
    </a>
  );
}
