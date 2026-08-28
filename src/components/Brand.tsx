type P = { className?: string };

/**
 * Marca do Negoneycord. A arte é pixel art, então em toda parte usamos
 * image-rendering: pixelated — sem isso o navegador borra os pixels ao
 * redimensionar e a arte perde a cara.
 */
export const Mascote = ({ className = 'h-8 w-8' }: P) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/logo.png"
    alt=""
    aria-hidden="true"
    className={className}
    style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
  />
);

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

/** Avatar do bot de música: o próprio mascote. */
export const BotAvatar = ({ size = 40 }: { size?: number }) => (
  <div
    className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blurple"
    style={{ width: size, height: size }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/icon-app.png"
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, imageRendering: 'pixelated', objectFit: 'cover' }}
    />
  </div>
);

/** Bloco de marca usado nas telas de entrada. */
export const Wordmark = () => (
  <div className="flex items-center justify-center gap-3">
    <Mascote className="h-16 w-16 drop-shadow-lg" />
    <span className="text-2xl font-bold tracking-tight text-white">Negoneycord</span>
  </div>
);
