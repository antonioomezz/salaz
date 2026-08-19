'use client';

import { useState } from 'react';
import type { Channel, User } from '@/lib/types';
import { Avatar } from './Avatar';
import {
  Camera,
  CameraOff,
  Copy,
  Gear,
  Hash,
  Headphones,
  HeadphonesOff,
  Leave,
  Mic,
  MicOff,
  Plus,
  Screen,
  Speaker,
} from './icons';

type Voice = {
  inVoice: boolean;
  voiceChannel: string | null;
  micOn: boolean;
  micLive: boolean;
  deafened: boolean;
  connecting: boolean;
  joinVoice: (channelId: string) => void;
  leaveVoice: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
  startScreen: () => void;
  stopScreen: () => void;
  isSharing: boolean;
  camOn: boolean;
  toggleCam: () => void;
};

type Props = {
  roomId: string;
  channels: Channel[];
  users: User[];
  me: User | null;
  speaking: Record<string, boolean>;
  activeChannel: string;
  onSelectChannel: (id: string) => void;
  onCreateChannel: (name: string, type: 'text' | 'voice') => void;
  onOpenSettings: () => void;
  voice: Voice;
};

export function Sidebar({
  roomId,
  channels,
  users,
  me,
  speaking,
  activeChannel,
  onSelectChannel,
  onCreateChannel,
  onOpenSettings,
  voice,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState<null | 'text' | 'voice'>(null);
  const [draft, setDraft] = useState('');

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const submitChannel = () => {
    if (draft.trim() && creating) onCreateChannel(draft.trim(), creating);
    setDraft('');
    setCreating(null);
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-ink-600">
      {/* cabeçalho: código da sala + copiar link */}
      <button
        onClick={copyLink}
        className="flex h-12 shrink-0 items-center justify-between border-b border-ink-900/60 px-4 text-left transition hover:bg-ink-400/40"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">Sala {roomId}</span>
          <span className="block text-[11px] text-mute">
            {copied ? 'link copiado!' : 'clique para copiar o link'}
          </span>
        </span>
        <Copy className="h-4 w-4 shrink-0 text-mute" />
      </button>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <Section label="Canais de texto" onAdd={() => setCreating('text')} />
        {textChannels.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectChannel(c.id)}
            className={`group mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[15px] transition ${
              activeChannel === c.id
                ? 'bg-ink-300 text-white'
                : 'text-mute hover:bg-ink-400/50 hover:text-soft'
            }`}
          >
            <Hash className="h-5 w-5 shrink-0 text-mute" />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
        {creating === 'text' && (
          <ChannelInput value={draft} onChange={setDraft} onSubmit={submitChannel} onCancel={() => setCreating(null)} />
        )}

        <Section label="Canais de voz" onAdd={() => setCreating('voice')} />
        {voiceChannels.map((c) => {
          const inside = users.filter((u) => u.voiceChannel === c.id);
          const active = voice.voiceChannel === c.id;
          return (
            <div key={c.id} className="mb-0.5">
              <button
                onClick={() => (active ? voice.leaveVoice() : voice.joinVoice(c.id))}
                className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[15px] transition ${
                  active ? 'bg-ink-300 text-white' : 'text-mute hover:bg-ink-400/50 hover:text-soft'
                }`}
              >
                <Speaker className="h-5 w-5 shrink-0 text-mute" />
                <span className="truncate">{c.name}</span>
                {inside.length > 0 && (
                  <span className="ml-auto text-[11px] text-mute">{inside.length}</span>
                )}
              </button>

              {inside.map((u) => (
                <div key={u.id} className="flex items-center gap-2 py-1 pr-2 pl-6 text-sm">
                  <Avatar user={u} size={22} speaking={!!speaking[u.id]} />
                  <span className={`truncate ${speaking[u.id] ? 'text-white' : 'text-mute'}`}>
                    {u.name}
                    {u.id === me?.id && ' (você)'}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-mute">
                    {u.camOn && <Camera className="h-3.5 w-3.5 text-online" />}
                    {u.sharing && <Screen className="h-3.5 w-3.5 text-online" />}
                    {u.deafened ? (
                      <HeadphonesOff className="h-3.5 w-3.5 text-danger" />
                    ) : (
                      u.muted && <MicOff className="h-3.5 w-3.5 text-danger" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {creating === 'voice' && (
          <ChannelInput value={draft} onChange={setDraft} onSubmit={submitChannel} onCancel={() => setCreating(null)} />
        )}
      </div>

      {/* painel de voz conectada */}
      {voice.inVoice && (
        <div className="mx-2 mb-1 rounded-md bg-ink-700 p-2">
          <div className="mb-2 px-1 text-[13px] font-semibold text-online">
            Voz conectada
            <span className="block text-[11px] font-normal text-mute">Sala {roomId}</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={voice.toggleCam}
              title={voice.camOn ? 'Desligar câmera' : 'Ligar câmera'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
                voice.camOn
                  ? 'bg-danger text-white hover:bg-danger-dark'
                  : 'bg-ink-400 text-bright hover:bg-ink-300'
              }`}
            >
              {voice.camOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              Câmera
            </button>
            <button
              onClick={voice.isSharing ? voice.stopScreen : voice.startScreen}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
                voice.isSharing
                  ? 'bg-danger text-white hover:bg-danger-dark'
                  : 'bg-ink-400 text-bright hover:bg-ink-300'
              }`}
            >
              <Screen className="h-4 w-4" />
              {voice.isSharing ? 'Parar' : 'Tela'}
            </button>
            <button
              onClick={voice.leaveVoice}
              title="Sair da chamada"
              className="rounded bg-ink-400 px-2.5 text-bright transition hover:bg-danger hover:text-white"
            >
              <Leave className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* painel do usuário */}
      <div className="flex h-13 shrink-0 items-center gap-2 bg-ink-700 px-2 py-1.5">
        {me && <Avatar user={me} size={32} speaking={!!speaking[me.id]} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">{me?.name ?? '...'}</div>
          <div
            className={`text-[11px] ${voice.inVoice && !voice.micLive ? 'text-danger' : 'text-mute'}`}
          >
            {voice.connecting
              ? 'conectando...'
              : voice.inVoice
                ? voice.micLive
                  ? 'em chamada'
                  : 'microfone mudo'
                : 'online'}
          </div>
        </div>
        <button
          onClick={voice.toggleMic}
          disabled={!voice.inVoice}
          title={voice.micOn ? 'Desativar microfone' : 'Ativar microfone'}
          className={`rounded p-1.5 transition hover:bg-ink-400 disabled:opacity-40 ${
            voice.inVoice && !voice.micOn ? 'text-danger' : 'text-soft'
          }`}
        >
          {voice.inVoice && !voice.micOn ? <MicOff /> : <Mic />}
        </button>
        <button
          onClick={voice.toggleDeafen}
          disabled={!voice.inVoice}
          title={voice.deafened ? 'Ouvir novamente' : 'Silenciar todos'}
          className={`rounded p-1.5 transition hover:bg-ink-400 disabled:opacity-40 ${
            voice.deafened ? 'text-danger' : 'text-soft'
          }`}
        >
          {voice.deafened ? <HeadphonesOff /> : <Headphones />}
        </button>
        <button
          onClick={onOpenSettings}
          title="Configurações de voz"
          className="rounded p-1.5 text-soft transition hover:bg-ink-400 hover:text-white"
        >
          <Gear />
        </button>
      </div>
    </aside>
  );
}

function Section({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="mt-4 mb-1 flex items-center justify-between px-2">
      <span className="text-[11px] font-bold tracking-wider text-mute uppercase">{label}</span>
      <button
        onClick={onAdd}
        title={`Criar canal de ${label.toLowerCase()}`}
        className="text-mute transition hover:text-white"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function ChannelInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 24))}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit();
        if (e.key === 'Escape') onCancel();
      }}
      placeholder="nome-do-canal"
      className="mb-1 w-full rounded bg-ink-900 px-2 py-1.5 text-sm text-bright outline-none placeholder:text-ink-200"
    />
  );
}
