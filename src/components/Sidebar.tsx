'use client';

import { useState } from 'react';
import type { Channel, User } from '@/lib/types';
import { Avatar } from './Avatar';
import { Mascote } from './Brand';
import { UserVolume } from './UserVolume';
import { getUserAudio, type UserAudio, type UserAudioMap } from '@/lib/userVolumes';
import { Camera, Copy, Gear, Hash, Headphones, HeadphonesOff, Leave, Mic, MicOff, Plus, Screen, Speaker, SpeakerMuted } from './icons';

export type VoiceControls = {
  inVoice: boolean;
  voiceChannel: string | null;
  micOn: boolean;
  micLive: boolean;
  deafened: boolean;
  connecting: boolean;
  screenStarting: boolean;
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
  connected: boolean;
  onClose: () => void;
  onSelectChannel: (id: string) => void;
  onCreateChannel: (name: string, type: 'text' | 'voice') => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  userAudio: UserAudioMap;
  onUserAudioChange: (name: string, patch: Partial<UserAudio>) => void;
  voice: VoiceControls;
};

export function Sidebar({ roomId, channels, users, me, speaking, activeChannel, connected, onClose, onSelectChannel, onCreateChannel, onOpenSettings, onOpenProfile, userAudio, onUserAudioChange, voice }: Props) {
  const [copyStatus, setCopyStatus] = useState('');
  const [volumeAberto, setVolumeAberto] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [creating, setCreating] = useState<null | 'text' | 'voice'>(null);
  const [draft, setDraft] = useState('');
  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');
  const currentVoiceName = channels.find((c) => c.id === voice.voiceChannel)?.name;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('Convite copiado');
    } catch { setCopyStatus('Copie o endereço no navegador'); }
  };
  const submitChannel = () => {
    if (!draft.trim() || !creating || !connected) return;
    onCreateChannel(draft.trim(), creating);
    setDraft('');
    setCreating(null);
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/6 bg-ink-700" aria-label="Canais e perfil">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <Mascote className="h-8 w-8" />
        <span className="text-[15px] font-semibold tracking-tight text-white">Negoneycord</span>
        <button onClick={onClose} aria-label="Fechar canais" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-xl text-mute hover:bg-ink-400 md:hidden">×</button>
      </div>
      <div className="mx-3 mb-2 rounded-lg border border-white/6 bg-ink-900/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-bright">Sala {roomId}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? 'bg-online' : 'bg-danger'}`} title={connected ? 'Conectado' : 'Reconectando'} />
        </div>
        <button onClick={copyLink} className="flex w-full items-center gap-2 text-left text-xs text-mute hover:text-white">
          <Copy className="h-3.5 w-3.5" /><span aria-live="polite">{copyStatus || 'Copiar convite'}</span>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Canais da sala">
        <Section label="Conversa" onAdd={() => { setCreating('text'); setDraft(''); }} disabled={!connected} />
        {textChannels.map((c) => (
          <button key={c.id} onClick={() => onSelectChannel(c.id)} aria-current={activeChannel === c.id ? 'page' : undefined} className="channel-row mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-mute hover:bg-ink-400/50 hover:text-soft">
            <Hash className="h-4 w-4 shrink-0" /><span className="truncate">{c.name}</span>
          </button>
        ))}
        {creating === 'text' && <ChannelInput value={draft} onChange={setDraft} onSubmit={submitChannel} onCancel={() => setCreating(null)} />}
        <Section label="Canais de voz" onAdd={() => { setCreating('voice'); setDraft(''); }} disabled={!connected} />
        {voiceChannels.map((c) => {
          const inside = users.filter((u) => u.voiceChannel === c.id);
          const active = voice.voiceChannel === c.id;
          return (
            <div key={c.id} className="mb-1">
              <button onClick={() => { if (!active) voice.joinVoice(c.id); }} disabled={!connected || voice.connecting} aria-current={active ? 'page' : undefined} title={active ? 'Você está neste canal' : `Entrar em ${c.name}`} className="channel-row flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-mute hover:bg-ink-400/50 hover:text-soft disabled:opacity-50">
                <Speaker className="h-4 w-4 shrink-0" /><span className="truncate">{c.name}</span>
                {inside.length > 0 && <span className="ml-auto rounded bg-ink-400/50 px-1.5 text-[11px] text-soft">{inside.length}</span>}
              </button>
              {inside.map((u) => {
                const souEu = u.id === me?.id;
                const audio = getUserAudio(userAudio, u.name);
                return (
                  <div key={u.id} className="relative">
                    <button onClick={(e) => !souEu && setVolumeAberto(volumeAberto?.id === u.id ? null : { id: u.id, rect: e.currentTarget.getBoundingClientRect() })} onContextMenu={(e) => { if (souEu) return; e.preventDefault(); setVolumeAberto({ id: u.id, rect: e.currentTarget.getBoundingClientRect() }); }} disabled={souEu} title={souEu ? undefined : `Ajustar volume de ${u.name}`} className="flex min-h-9 w-full items-center gap-2 rounded-lg py-1 pr-2 pl-7 text-left text-xs enabled:hover:bg-ink-400/40">
                      <Avatar user={u} size={22} speaking={!!speaking[u.id]} />
                      <span className={`truncate ${speaking[u.id] ? 'text-white' : 'text-mute'}`}>{u.name}{souEu && ' · você'}</span>
                      <span className="ml-auto flex items-center gap-1 text-mute">
                        {!souEu && audio.muted && <SpeakerMuted className="h-3 w-3 text-danger" />}
                        {u.camOn && <Camera className="h-3 w-3 text-online" />}
                        {u.sharing && <Screen className="h-3 w-3 text-online" />}
                        {u.deafened ? <HeadphonesOff className="h-3 w-3 text-danger" /> : u.muted && <MicOff className="h-3 w-3 text-danger" />}
                      </span>
                    </button>
                    {volumeAberto?.id === u.id && <UserVolume name={u.name} audio={audio} sharing={u.sharing} anchor={volumeAberto.rect} onChange={(patch) => onUserAudioChange(u.name, patch)} onClose={() => setVolumeAberto(null)} />}
                  </div>
                );
              })}
            </div>
          );
        })}
        {creating === 'voice' && <ChannelInput value={draft} onChange={setDraft} onSubmit={submitChannel} onCancel={() => setCreating(null)} />}
      </nav>
      {voice.inVoice && (
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-online/15 bg-online/5 px-3 py-2.5">
          <Speaker className="h-4 w-4 shrink-0 text-online" />
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-online">Voz conectada</p><p className="truncate text-[11px] text-mute">{currentVoiceName}</p></div>
          <button onClick={voice.leaveVoice} title="Sair da chamada" className="flex min-h-8 items-center gap-1 rounded px-2 text-xs text-danger hover:bg-danger/10"><Leave className="h-3.5 w-3.5" />Sair</button>
        </div>
      )}
      <div className="flex min-h-16 shrink-0 items-center gap-1 border-t border-white/6 bg-ink-900/50 px-3 py-2">
        <button onClick={onOpenProfile} title="Seu perfil e foto" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-ink-400/50">
          {me && <Avatar user={me} size={30} speaking={!!speaking[me.id]} />}
          <div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{me?.name ?? 'Conectando…'}</div><p className="text-[10px] text-mute">{voice.connecting ? 'Entrando na voz…' : voice.inVoice ? 'Em chamada' : connected ? 'Disponível' : 'Reconectando…'}</p></div>
        </button>
        <button onClick={voice.toggleMic} disabled={!voice.inVoice} aria-label={voice.micOn ? 'Desativar microfone' : 'Ativar microfone'} aria-pressed={voice.micOn} title={voice.micOn ? 'Desativar microfone' : 'Ativar microfone'} className={`rounded-lg p-2 hover:bg-ink-400 disabled:opacity-40 ${voice.inVoice && !voice.micOn ? 'text-danger' : 'text-soft'}`}>{voice.inVoice && !voice.micOn ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
        <button onClick={voice.toggleDeafen} disabled={!voice.inVoice} aria-label={voice.deafened ? 'Ouvir novamente' : 'Silenciar todos'} aria-pressed={voice.deafened} title={voice.deafened ? 'Ouvir novamente' : 'Silenciar todos'} className={`rounded-lg p-2 hover:bg-ink-400 disabled:opacity-40 ${voice.deafened ? 'text-danger' : 'text-soft'}`}>{voice.deafened ? <HeadphonesOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}</button>
        <button onClick={onOpenSettings} aria-label="Configurações de voz" title="Configurações de voz" className="rounded-lg p-2 text-soft hover:bg-ink-400 hover:text-white"><Gear className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}

function Section({ label, onAdd, disabled }: { label: string; onAdd: () => void; disabled: boolean }) {
  return <div className="mt-5 mb-2 flex items-center justify-between px-2.5"><span className="text-[10px] font-semibold tracking-[0.12em] text-mute uppercase">{label}</span><button onClick={onAdd} disabled={disabled} aria-label={`Criar canal em ${label.toLowerCase()}`} title="Criar canal" className="flex h-6 w-6 items-center justify-center rounded text-mute hover:bg-ink-400 hover:text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button></div>;
}

function ChannelInput({ value, onChange, onSubmit, onCancel }: { value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <form className="pop-in my-2 rounded-lg border border-white/8 bg-ink-900 p-2" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}><input autoFocus value={value} onChange={(e) => onChange(e.target.value.slice(0, 24))} onKeyDown={(e) => e.key === 'Escape' && onCancel()} aria-label="Nome do novo canal" placeholder="nome-do-canal" className="field w-full rounded px-2 py-2 text-sm text-bright" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-mute hover:text-white">Cancelar</button><button type="submit" disabled={!value.trim()} className="primary-button rounded px-3 py-1 text-xs">Criar</button></div></form>;
}