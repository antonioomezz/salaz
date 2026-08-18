'use client';

/**
 * AudioContext compartilhado pelas partes que só *reproduzem* áudio
 * (impulso de volume por pessoa, mixer de música local).
 *
 * O caminho do microfone tem o seu próprio contexto dentro de useVoice, de
 * propósito: é o caminho crítico e não deve depender de nada mais.
 */
let ctx: AudioContext | null = null;

export function sharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}
