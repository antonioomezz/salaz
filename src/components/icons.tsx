type P = { className?: string };

const base = 'h-5 w-5';

export const Hash = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9.3 3l-.7 4.2H4.5l-.3 2h4.1l-.8 4.6H3.4l-.3 2h4.1L6.4 20h2l.8-4.2h4.4L12.8 20h2l.8-4.2h4.1l.3-2h-4.1l.8-4.6h4.1l.3-2h-4.1L17.8 3h-2l-.7 4.2h-4.4L11.3 3h-2zm.6 6.2h4.4l-.8 4.6H9.1l.8-4.6z" />
  </svg>
);

export const Speaker = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.4 3.3a1 1 0 011.6.8v15.8a1 1 0 01-1.6.8L6.3 17H3a1 1 0 01-1-1V8a1 1 0 011-1h3.3l5.1-3.7zM16.5 8.2a1 1 0 011.4 0 5.4 5.4 0 010 7.6 1 1 0 11-1.4-1.4 3.4 3.4 0 000-4.8 1 1 0 010-1.4zM19.3 5.4a1 1 0 011.4 0 9.3 9.3 0 010 13.2 1 1 0 11-1.4-1.4 7.3 7.3 0 000-10.4 1 1 0 010-1.4z" />
  </svg>
);

export const Mic = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
    <path d="M18 11a1 1 0 112 0 8 8 0 01-7 7.94V21a1 1 0 11-2 0v-2.06A8 8 0 014 11a1 1 0 112 0 6 6 0 0012 0z" />
  </svg>
);

export const MicOff = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.7 2.3a1 1 0 00-1.4 1.4l18 18a1 1 0 001.4-1.4l-4.1-4.1A8 8 0 0020 11a1 1 0 10-2 0 6 6 0 01-1.1 3.5L15 12.6V5a3 3 0 10-6 0v.6L3.7 2.3z" />
    <path d="M9 11.4V11l4.6 4.6A3 3 0 019 11.4zM6 11a1 1 0 10-2 0 8 8 0 007 7.94V21a1 1 0 102 0v-2.06a7.9 7.9 0 002.2-.66l-1.5-1.5A6 6 0 016 11z" />
  </svg>
);

export const Headphones = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3a9 9 0 00-9 9v5a3 3 0 003 3h1a2 2 0 002-2v-4a2 2 0 00-2-2H5v-.2A7 7 0 0119 12v.8h-2a2 2 0 00-2 2v4a2 2 0 002 2h1a3 3 0 003-3v-5a9 9 0 00-9-9z" />
  </svg>
);

export const HeadphonesOff = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.7 2.3a1 1 0 00-1.4 1.4l1.9 1.9A9 9 0 003 12v5a3 3 0 003 3h1a2 2 0 002-2v-4a2 2 0 00-2-2H5v-.8c0-1.3.3-2.4 1-3.4L20.3 21.7a1 1 0 001.4-1.4L3.7 2.3zM21 12v5a3 3 0 01-1.2 2.4L15 14.6a2 2 0 011.9-1.8H19V12a7 7 0 00-9.6-6.5L7.8 3.9A9 9 0 0121 12z" />
  </svg>
);

export const Screen = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-5v2h3a1 1 0 110 2H9a1 1 0 110-2h3v-2H5a2 2 0 01-2-2V4zm9 1.5l4 3.5-4 3.5V10H8V8h4V5.5z" />
  </svg>
);

export const Leave = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 3a1 1 0 011 1v2a1 1 0 11-2 0V5H6v14h6v-1a1 1 0 112 0v2a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h8z" />
    <path d="M17.3 8.3a1 1 0 011.4 0l3 3a1 1 0 010 1.4l-3 3a1 1 0 01-1.4-1.4l1.3-1.3H11a1 1 0 110-2h7.6l-1.3-1.3a1 1 0 010-1.4z" />
  </svg>
);

export const Plus = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 5a1 1 0 10-2 0v6H5a1 1 0 100 2h6v6a1 1 0 102 0v-6h6a1 1 0 100-2h-6V5z" />
  </svg>
);

export const Copy = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9 2a2 2 0 00-2 2v10a2 2 0 002 2h9a2 2 0 002-2V4a2 2 0 00-2-2H9zm0 2h9v10H9V4z" />
    <path d="M5 6a1 1 0 00-1 1v13a2 2 0 002 2h9a1 1 0 100-2H6V7a1 1 0 00-1-1z" />
  </svg>
);

export const Send = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.4 20.4l17.5-7.5a1 1 0 000-1.8L3.4 3.6a1 1 0 00-1.4 1.1L4 11l11 1-11 1-2 6.3a1 1 0 001.4 1.1z" />
  </svg>
);

export const Expand = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM6 14v4h4v2H4v-6h2zm12 0h2v6h-6v-2h4v-4z" />
  </svg>
);

export const Gear = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
    <path d="M10.4 2a1 1 0 00-1 .8l-.3 1.7a8 8 0 00-1.6.9L5.9 4.8a1 1 0 00-1.2.4l-1.6 2.8a1 1 0 00.2 1.2l1.3 1.1a8 8 0 000 1.4l-1.3 1.1a1 1 0 00-.2 1.2l1.6 2.8a1 1 0 001.2.4l1.6-.6a8 8 0 001.6.9l.3 1.7a1 1 0 001 .8h3.2a1 1 0 001-.8l.3-1.7a8 8 0 001.6-.9l1.6.6a1 1 0 001.2-.4l1.6-2.8a1 1 0 00-.2-1.2l-1.3-1.1a8 8 0 000-1.4l1.3-1.1a1 1 0 00.2-1.2l-1.6-2.8a1 1 0 00-1.2-.4l-1.6.6a8 8 0 00-1.6-.9l-.3-1.7a1 1 0 00-1-.8h-3.2zm.9 2h1.4l.3 1.5a1 1 0 00.7.8 6 6 0 011.9 1.1 1 1 0 001 .2l1.4-.5.7 1.2-1.1 1a1 1 0 00-.3 1 6 6 0 010 2.2 1 1 0 00.3 1l1.1 1-.7 1.2-1.4-.5a1 1 0 00-1 .2 6 6 0 01-1.9 1.1 1 1 0 00-.7.8l-.3 1.5h-1.4l-.3-1.5a1 1 0 00-.7-.8 6 6 0 01-1.9-1.1 1 1 0 00-1-.2l-1.4.5-.7-1.2 1.1-1a1 1 0 00.3-1 6 6 0 010-2.2 1 1 0 00-.3-1l-1.1-1 .7-1.2 1.4.5a1 1 0 001-.2 6 6 0 011.9-1.1 1 1 0 00.7-.8L11.3 4z" />
  </svg>
);

export const SpeakerMuted = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.4 3.3a1 1 0 011.6.8v15.8a1 1 0 01-1.6.8L6.3 17H3a1 1 0 01-1-1V8a1 1 0 011-1h3.3l5.1-3.7z" />
    <path d="M16.3 9.3a1 1 0 011.4 0l1.3 1.3 1.3-1.3a1 1 0 111.4 1.4L20.4 12l1.3 1.3a1 1 0 01-1.4 1.4L19 13.4l-1.3 1.3a1 1 0 01-1.4-1.4l1.3-1.3-1.3-1.3a1 1 0 010-1.4z" />
  </svg>
);

export const Clip = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16.5 6.5v9a4.5 4.5 0 11-9 0V6a3 3 0 116 0v9a1.5 1.5 0 11-3 0V7H9v8a3 3 0 106 0V6a4.5 4.5 0 10-9 0v9.5a6 6 0 1012 0v-9h-1.5z" />
  </svg>
);

export const Camera = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 6a2 2 0 00-2 2v8a2 2 0 002 2h9a2 2 0 002-2V8a2 2 0 00-2-2H4zm13.4 3.2a1 1 0 011.6.8v4a1 1 0 01-1.6.8L16 14v-4l1.4-.8z" />
  </svg>
);

export const CameraOff = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.7 2.3a1 1 0 00-1.4 1.4l1.5 1.5A2 2 0 002 7v8a2 2 0 002 2h9c.3 0 .6-.1.9-.2l4.4 4.4a1 1 0 001.4-1.4L3.7 2.3z" />
    <path d="M15 8v4.2l-6-6H13a2 2 0 012 2zm2.4.2a1 1 0 011.6.8v4a1 1 0 01-1.6.8L16 13v-4l1.4-.8z" />
  </svg>
);
