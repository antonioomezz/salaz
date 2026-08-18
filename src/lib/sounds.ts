'use client';

/**
 * Efeitos sonoros sintetizados na hora com WebAudio — sem arquivos de áudio
 * para baixar. Cada som é uma sequência curta de notas.
 */

export type SfxName =
  | 'join'
  | 'leave'
  | 'someoneJoined'
  | 'someoneLeft'
  | 'message'
  | 'send'
  | 'mute'
  | 'unmute'
  | 'shareStart'
  | 'shareStop'
  | 'error';

type Note = {
  freq: number;
  /** atraso em segundos a partir do início do som */
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
};

const SOUNDS: Record<SfxName, Note[]> = {
  // entrar/sair da chamada: par de notas subindo ou descendo
  join: [
    { freq: 587.33, at: 0, dur: 0.11 },
    { freq: 880, at: 0.09, dur: 0.16 },
  ],
  leave: [
    { freq: 880, at: 0, dur: 0.11 },
    { freq: 587.33, at: 0.09, dur: 0.18 },
  ],
  // alguém entrou/saiu: mais discreto que o seu próprio
  someoneJoined: [
    { freq: 659.25, at: 0, dur: 0.09, gain: 0.5 },
    { freq: 987.77, at: 0.07, dur: 0.12, gain: 0.5 },
  ],
  someoneLeft: [
    { freq: 987.77, at: 0, dur: 0.09, gain: 0.5 },
    { freq: 659.25, at: 0.07, dur: 0.14, gain: 0.5 },
  ],
  message: [{ freq: 1046.5, at: 0, dur: 0.09, gain: 0.35 }],
  send: [{ freq: 784, at: 0, dur: 0.05, gain: 0.22 }],
  mute: [{ freq: 493.88, at: 0, dur: 0.07, gain: 0.5 }],
  unmute: [{ freq: 739.99, at: 0, dur: 0.07, gain: 0.5 }],
  shareStart: [
    { freq: 523.25, at: 0, dur: 0.08, gain: 0.45 },
    { freq: 783.99, at: 0.07, dur: 0.14, gain: 0.45 },
  ],
  shareStop: [
    { freq: 783.99, at: 0, dur: 0.08, gain: 0.45 },
    { freq: 523.25, at: 0.07, dur: 0.14, gain: 0.45 },
  ],
  error: [
    { freq: 311.13, at: 0, dur: 0.14, gain: 0.5, type: 'square' },
    { freq: 233.08, at: 0.12, dur: 0.2, gain: 0.5, type: 'square' },
  ],
};

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.6;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function configureSfx(opts: { enabled?: boolean; volume?: number }) {
  if (typeof opts.enabled === 'boolean') enabled = opts.enabled;
  if (typeof opts.volume === 'number') volume = Math.max(0, Math.min(1, opts.volume));
}

/** Toca um efeito. Silencioso e sem erro se o navegador bloquear o áudio. */
export function playSfx(name: SfxName) {
  if (!enabled || volume === 0) return;
  const audio = context();
  if (!audio) return;

  const now = audio.currentTime;
  for (const note of SOUNDS[name]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.value = note.freq;

    const peak = (note.gain ?? 0.6) * volume * 0.25;
    const start = now + note.at;
    const end = start + note.dur;

    // envelope curto para não estalar
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
