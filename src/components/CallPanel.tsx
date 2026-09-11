'use client';

import type { Channel, User } from '@/lib/types';
import type { VoiceControls } from './Sidebar';
import { Avatar } from './Avatar';
import { Camera, CameraOff, Gear, Headphones, HeadphonesOff, Leave, Mic, MicOff, Screen, Speaker } from './icons';

export function CallPanel({ voice, users, channels, speaking, connected, onOpenSettings }: {
  voice: VoiceControls;
  users: User[];
  channels: Channel[];
  speaking: Record<string, boolean>;
  connected: boolean;
  onOpenSettings: () => void;
}) {
  const channel = channels.find((c) => c.id === voice.voiceChannel);
  const participants = users.filter((u) => !!voice.voiceChannel && u.voiceChannel === voice.voiceChannel);
  const firstVoice = channels.find((c) => c.type === 'voice');

  if (!voice.inVoice) return (
    <section className="flex shrink-0 items-center justify-between gap-3 border-b border-white/6 bg-ink-800 px-4 py-3 sm:px-6" aria-label="Entrar na chamada">
      <div className="flex min-w-0 items-center gap-3"><Speaker className="h-5 w-5 shrink-0 text-mute" /><div><p className="text-sm font-medium text-soft">A sala também tem voz.</p><p className="mt-0.5 hidden text-xs text-mute sm:block">Entre quando quiser. O chat continua aqui.</p></div></div>
      <button disabled={!firstVoice || !connected || voice.connecting} onClick={() => firstVoice && voice.joinVoice(firstVoice.id)} className="primary-button min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold">{voice.connecting ? 'Conectando…' : 'Entrar na voz'}</button>
    </section>
  );

  return (
    <section className="pop-in shrink-0 border-b border-white/6 bg-ink-800 px-4 py-3 sm:px-6" aria-label="Chamada em andamento">
      <div className="mb-3 flex min-w-0 items-center gap-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-online" />
        <h2 className="truncate text-sm font-semibold text-white">{channel?.name ?? 'Chamada'}</h2>
        <span className="text-xs text-mute">{participants.length} na voz</span>
        <div className="ml-auto flex -space-x-1.5" aria-label={participants.map((u) => u.name).join(', ')}>{participants.slice(0, 5).map((u) => <span key={u.id} className="rounded-full ring-2 ring-ink-800" title={u.name}><Avatar user={u} size={26} speaking={!!speaking[u.id]} /></span>)}{participants.length > 5 && <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ink-400 text-[10px] text-soft ring-2 ring-ink-800">+{participants.length - 5}</span>}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={`call-control ${!voice.micOn ? 'danger' : ''}`} onClick={voice.toggleMic} aria-pressed={voice.micOn} aria-label={voice.micOn ? 'Desativar microfone' : 'Ativar microfone'}>{voice.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}<span className="hidden sm:inline">{voice.micOn ? 'Microfone' : 'Sem microfone'}</span></button>
        <button className="call-control" onClick={voice.toggleCam} aria-pressed={voice.camOn} aria-label={voice.camOn ? 'Desligar câmera' : 'Ligar câmera'}>{voice.camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}<span className="hidden sm:inline">Câmera</span></button>
        <button className="call-control" onClick={voice.isSharing ? voice.stopScreen : voice.startScreen} disabled={voice.screenStarting} aria-pressed={voice.isSharing} aria-busy={voice.screenStarting}><Screen className="h-4 w-4" /><span>{voice.screenStarting ? 'Abrindo…' : voice.isSharing ? 'Parar transmissão' : 'Transmitir tela'}</span></button>
        <button className={`call-control ${voice.deafened ? 'danger' : ''}`} onClick={voice.toggleDeafen} aria-pressed={voice.deafened} aria-label={voice.deafened ? 'Ouvir novamente' : 'Silenciar chamada'} title={voice.deafened ? 'Ouvir novamente' : 'Silenciar chamada'}>{voice.deafened ? <HeadphonesOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}</button>
        <button className="call-control" onClick={onOpenSettings} aria-label="Configurações de voz" title="Configurações de voz"><Gear className="h-4 w-4" /></button>
        <button className="call-control danger ml-auto" onClick={voice.leaveVoice}><Leave className="h-4 w-4" /><span>Sair</span></button>
      </div>
    </section>
  );
}
