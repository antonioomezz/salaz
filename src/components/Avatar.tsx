import type { User } from '@/lib/types';

export function Avatar({
  user,
  size = 32,
  speaking = false,
}: {
  user: Pick<User, 'name' | 'color'> & { avatarUrl?: string | null };
  size?: number;
  speaking?: boolean;
}) {
  const anel = speaking ? '0 0 0 2px var(--color-online)' : 'none';

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover transition-shadow"
        style={{ width: size, height: size, boxShadow: anel }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white transition-shadow"
      style={{
        width: size,
        height: size,
        background: user.color,
        fontSize: Math.round(size * 0.42),
        boxShadow: anel,
      }}
    >
      {user.name.slice(0, 1).toUpperCase()}
    </div>
  );
}
