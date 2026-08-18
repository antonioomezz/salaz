import type { User } from '@/lib/types';
import { Avatar } from './Avatar';
import { MicOff, Screen, Speaker } from './icons';

export function MemberList({
  users,
  me,
  speaking,
}: {
  users: User[];
  me: User | null;
  speaking: Record<string, boolean>;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto bg-ink-600 px-2 py-4 lg:flex">
      <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-mute uppercase">
        Online — {users.length}
      </div>

      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-2.5 rounded px-2 py-1.5 transition hover:bg-ink-400/50"
        >
          <div className="relative">
            <Avatar user={u} size={32} speaking={!!speaking[u.id]} />
            <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-[2.5px] border-ink-600 bg-online" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-mute">
            {u.name}
            {u.id === me?.id && <span className="text-[11px] text-ink-200"> (você)</span>}
          </span>
          <span className="flex items-center gap-1">
            {u.sharing && <Screen className="h-4 w-4 text-online" />}
            {u.voiceChannel && !u.muted && <Speaker className="h-3.5 w-3.5 text-mute" />}
            {u.voiceChannel && u.muted && <MicOff className="h-3.5 w-3.5 text-danger" />}
          </span>
        </div>
      ))}
    </aside>
  );
}
