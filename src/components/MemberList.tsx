'use client';

import { useState } from 'react';
import type { User } from '@/lib/types';
import { getUserAudio, type UserAudio, type UserAudioMap } from '@/lib/userVolumes';
import { Avatar } from './Avatar';
import { UserVolume } from './UserVolume';
import { Camera, MicOff, Screen, Speaker, SpeakerMuted } from './icons';

type Props = {
  users: User[];
  me: User | null;
  speaking: Record<string, boolean>;
  userAudio: UserAudioMap;
  onUserAudioChange: (name: string, patch: Partial<UserAudio>) => void;
  /** o que o bot está tocando agora, ou null se estiver parado */
  botTocando: string | null;
};

export function MemberList({
  users,
  me,
  speaking,
  userAudio,
  onUserAudioChange,
  botTocando,
}: Props) {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto bg-ink-600 px-2 py-4 lg:flex">
      {/* o bot aparece como um membro, para ficar claro que ele existe */}
      <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-mute uppercase">Bot — 1</div>
      <div className="mb-4 flex items-center gap-2.5 rounded px-2 py-1.5">
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blurple text-base">
            🎵
          </div>
          <span
            className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-[2.5px] border-ink-600 ${
              botTocando ? 'bg-online' : 'bg-ink-200'
            }`}
          />
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-bright">Negoneycord</span>
            <span className="rounded bg-blurple px-1 py-px text-[9px] font-bold text-white">BOT</span>
          </span>
          <span className="block truncate text-[11px] text-mute">
            {botTocando ? `♪ ${botTocando}` : 'ocioso — digite ;play'}
          </span>
        </span>
      </div>

      <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-mute uppercase">
        Online — {users.length}
      </div>

      {users.map((u) => {
        const audio = getUserAudio(userAudio, u.name);
        const souEu = u.id === me?.id;
        const ajustado = !souEu && (audio.muted || audio.volume !== 100);

        return (
          <div key={u.id} className="relative">
            <button
              onClick={() => !souEu && setAberto(aberto === u.id ? null : u.id)}
              disabled={souEu}
              title={souEu ? undefined : 'Ajustar o volume desta pessoa'}
              className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition enabled:hover:bg-ink-400/50"
            >
              <div className="relative">
                <Avatar user={u} size={32} speaking={!!speaking[u.id]} />
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-[2.5px] border-ink-600 bg-online" />
              </div>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-mute">
                {u.name}
                {souEu && <span className="text-[11px] text-ink-200"> (você)</span>}
              </span>
              <span className="flex items-center gap-1">
                {ajustado &&
                  (audio.muted ? (
                    <SpeakerMuted className="h-3.5 w-3.5 text-danger" />
                  ) : (
                    <span className="text-[10px] text-mute">{audio.volume}%</span>
                  ))}
                {u.camOn && <Camera className="h-4 w-4 text-online" />}
                {u.sharing && <Screen className="h-4 w-4 text-online" />}
                {u.voiceChannel && !u.muted && <Speaker className="h-3.5 w-3.5 text-mute" />}
                {u.voiceChannel && u.muted && <MicOff className="h-3.5 w-3.5 text-danger" />}
              </span>
            </button>

            {aberto === u.id && (
              <UserVolume
                name={u.name}
                audio={audio}
                onChange={(patch) => onUserAudioChange(u.name, patch)}
                onClose={() => setAberto(null)}
              />
            )}
          </div>
        );
      })}
    </aside>
  );
}
