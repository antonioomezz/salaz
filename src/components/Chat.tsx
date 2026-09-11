'use client';

import { useEffect, useRef, useState } from 'react';
import type { Channel, Message } from '@/lib/types';
import { compressImage, isImageFile, type CompressedImage } from '@/lib/imageCompress';
import { Avatar } from './Avatar';
import { BotAvatar } from './Brand';
import { Clip, Hash, Send } from './icons';

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type Props = {
  channel: Channel | undefined;
  messages: Message[];
  onSend: (text: string, image?: CompressedImage) => void;
  connected: boolean;
};

export function Chat({ channel, messages, onSend, connected }: Props) {
  const [draft, setDraft] = useState('');
  const [anexo, setAnexo] = useState<CompressedImage | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [nearBottom, setNearBottom] = useState(true);

  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const followMessages = useRef(true);
  const imageRequest = useRef(0);

  useEffect(() => () => { imageRequest.current++; }, []);

  useEffect(() => {
    if (ampliada) imageDialog.current?.showModal();
  }, [ampliada]);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    if (followMessages.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  const receberArquivo = async (file: Blob) => {
    setErro(null);
    setPreparing(true);
    const request = ++imageRequest.current;
    try {
      const image = await compressImage(file);
      if (request === imageRequest.current) setAnexo(image);
    } catch {
      if (request === imageRequest.current) setErro('Não consegui preparar essa imagem. Tente uma menor.');
    } finally { if (request === imageRequest.current) setPreparing(false); }
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
    if ((!text && !anexo) || !connected || preparing || !channel) return;
    followMessages.current = true;
    onSend(text, anexo ?? undefined);
    setDraft('');
    setAnexo(null);
    if (textInput.current) textInput.current.style.height = 'auto';
    textInput.current?.focus();
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

      <div ref={scroller} onScroll={(e) => { const box = e.currentTarget; const near = box.scrollHeight - box.scrollTop - box.clientHeight < 100; followMessages.current = near; setNearBottom(near); }} className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 sm:px-6" role="log" aria-label={`Mensagens em ${channel?.name ?? 'conversa'}`} aria-live="polite" aria-relevant="additions">
        <div className="mb-7 pb-2">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/6 bg-ink-400/40 text-soft"><Hash className="h-6 w-6" /></div>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">{channel?.name ?? 'Conectando…'}</h2>
          <p className="mt-1 text-sm text-mute">
            {messages.length ? 'O começo da conversa.' : 'Tudo pronto. Quem puxa o primeiro assunto?'}
          </p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const ehBot = m.kind === 'bot' || m.kind === 'card';
          const grouped =
            !ehBot && prev && prev.userId === m.userId && prev.kind !== 'bot' && m.ts - prev.ts < 5 * 60_000;

          return (
            <div key={m.id} className={`chat-message pop-in flex gap-3 px-1 py-0.5 ${grouped ? 'mt-0.5' : 'mt-4'}`}>
              <div className="w-10 shrink-0">
                {ehBot ? (
                  <BotAvatar size={40} />
                ) : grouped ? null : (
                  <Avatar user={m} size={40} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold" style={{ color: ehBot ? 'var(--color-online)' : m.color }}>
                      {ehBot ? 'Nego Ney' : m.name}
                    </span>
                    {ehBot && (
                      <span className="rounded bg-blurple px-1 py-px text-[10px] font-bold text-white">
                        BOT
                      </span>
                    )}
                    <time dateTime={new Date(m.ts).toISOString()} className="shrink-0 text-[10px] text-mute">{time(m.ts)}</time>
                  </div>
                )}

                {m.text && (
                  <p
                    className={`text-[14px] leading-[1.6] break-words whitespace-pre-wrap ${
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
                      onLoad={() => { if (followMessages.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }}
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

      {!nearBottom && messages.length > 0 && <button onClick={() => { followMessages.current = true; if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }} className="absolute right-5 bottom-24 z-10 rounded-full border border-white/10 bg-ink-800 px-4 py-2 text-xs text-soft shadow-lg hover:text-white">Ir para as últimas mensagens ↓</button>}

      {erro && (
        <div role="alert" className="mx-4 mb-1 rounded bg-danger/15 px-3 py-1.5 text-xs text-danger">{erro}</div>
      )}

      <div className="shrink-0 px-4 pt-2 pb-3 sm:px-6">
        {preparing && <p role="status" className="mb-2 text-xs text-mute">Preparando imagem…</p>}
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

        <div className="chat-composer flex items-end gap-2 rounded-xl bg-ink-400/70 px-2 py-2">
          <button
            onClick={() => fileInput.current?.click()}
            title="Enviar imagem"
            aria-label="Anexar imagem"
            disabled={!connected || preparing}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-ink-300 hover:text-white disabled:opacity-30"
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
            ref={textInput}
            rows={1}
            value={draft}
            onChange={(e) => { setDraft(e.target.value.slice(0, 2000)); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            onPaste={aoColar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={connected ? `Conversar em #${channel?.name ?? ''}` : 'Reconectando… sua mensagem fica aqui'}
            aria-label={`Mensagem em ${channel?.name ?? 'conversa'}`}
            maxLength={2000}
            className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-bright outline-none placeholder:text-mute"
          />
          <button
            onClick={send}
            disabled={(!draft.trim() && !anexo) || !connected || preparing || !channel}
            className="primary-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-30"
            title="Enviar"
            aria-label="Enviar mensagem"
          >
            <Send />
          </button>
        </div>
        <p className="mt-1.5 hidden text-[10px] text-mute/70 sm:block">Enter envia · Shift + Enter quebra a linha · Cole uma imagem com Ctrl + V</p>
      </div>

      {ampliada && (
        <dialog
          ref={imageDialog}
          aria-label="Imagem ampliada"
          className="fixed inset-0 m-auto max-h-dvh max-w-[100vw] border-0 bg-transparent p-6 backdrop:bg-black/85"
          onCancel={() => setAmpliada(null)}
          onClick={(e) => { if (e.target === e.currentTarget) setAmpliada(null); }}
        >
          <button autoFocus onClick={() => setAmpliada(null)} className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-2xl text-white" aria-label="Fechar imagem">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada}
            alt="imagem ampliada"
            className="max-h-[85dvh] max-w-full rounded-lg object-contain"
          />
        </dialog>
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
