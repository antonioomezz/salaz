type P = { className?: string };

/**
 * Marca do Negoneycord: um "N" formado por barras de onda sonora.
 * Substitui os emojis — desenho próprio escala bem e não depende da fonte
 * de emoji do sistema, que varia entre Windows, Mac e Android.
 */
export const Logo = ({ className = 'h-7 w-7' }: P) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="10" width="3.6" height="12" rx="1.8" fill="currentColor" opacity="0.55" />
    <rect x="9.4" y="5" width="3.6" height="22" rx="1.8" fill="currentColor" />
    <rect
      x="14.8"
      y="9"
      width="3.6"
      height="16"
      rx="1.8"
      fill="currentColor"
      transform="rotate(28 16.6 17)"
    />
    <rect x="19" y="5" width="3.6" height="22" rx="1.8" fill="currentColor" />
    <rect x="25.4" y="10" width="3.6" height="12" rx="1.8" fill="currentColor" opacity="0.55" />
  </svg>
);

/** Avatar do bot de música — onda sonora, sem emoji. */
export const BotAvatar = ({ size = 40 }: { size?: number }) => (
  <div
    className="flex shrink-0 items-center justify-center rounded-full bg-blurple text-white"
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.55, height: size * 0.55 }}>
      <path
        d="M9 18V6l10-2v12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
      <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
    </svg>
  </div>
);

/** Bloco de marca usado nas telas de entrada. */
export const Wordmark = () => (
  <div className="flex items-center justify-center gap-2.5">
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blurple text-white shadow-lg shadow-blurple/25">
      <Logo className="h-6 w-6" />
    </span>
    <span className="text-2xl font-bold tracking-tight text-white">Negoneycord</span>
  </div>
);
