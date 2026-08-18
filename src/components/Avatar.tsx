import type { User } from '@/lib/types';

export function Avatar({
  user,
  size = 32,
  speaking = false,
}: {
  user: Pick<User, 'name' | 'color'>;
  size?: number;
  speaking?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white transition-shadow"
      style={{
        width: size,
        height: size,
        background: user.color,
        fontSize: Math.round(size * 0.42),
        boxShadow: speaking ? '0 0 0 2px var(--color-online)' : 'none',
      }}
    >
      {user.name.slice(0, 1).toUpperCase()}
    </div>
  );
}
