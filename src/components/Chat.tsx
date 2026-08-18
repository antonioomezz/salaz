'use client';

import { useEffect, useRef, useState } from 'react';
import type { Channel, Message } from '@/lib/types';
import { Avatar } from './Avatar';
import { Send } from './icons';

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function Chat({
  channel,
  messages,
  onSend,
}: {
  channel: Channel | undefined;
  messages: Message[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 250;
    if (nearBottom || messages.length <= 1) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mb-6 border-b border-ink-400 pb-4">
          <h2 className="text-2xl font-bold text-white">Bem-vindo a #{channel?.name ?? '...'}</h2>
          <p className="text-sm text-mute">Este é o começo do canal. Manda ver.</p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.userId === m.userId && m.ts - prev.ts < 5 * 60_000;
          return (
            <div key={m.id} className={`pop-in flex gap-3 px-1 ${grouped ? 'mt-0.5' : 'mt-4'}`}>
              <div className="w-10 shrink-0">
                {grouped ? (
                  <span className="hidden text-[10px] leading-6 text-mute group-hover:block" />
                ) : (
                  <Avatar user={m} size={40} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold" style={{ color: m.color }}>
                      {m.name}
                    </span>
                    <span className="text-[11px] text-mute">{time(m.ts)}</span>
                  </div>
                )}
                <p className="text-[15px] leading-[1.4] break-words whitespace-pre-wrap text-bright">
                  {m.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} className="h-4" />
      </div>

      <div className="px-4 pt-1 pb-5">
        <div className="flex items-end gap-2 rounded-lg bg-ink-400 px-4 py-2.5">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
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
            disabled={!draft.trim()}
            className="shrink-0 text-mute transition hover:text-white disabled:opacity-30"
            title="Enviar"
          >
            <Send />
          </button>
        </div>
      </div>
    </div>
  );
}
