'use client';

/** Comandos do bot começam com ';' (YouTube) ou ';;' (Spotify). */
export function isMusicCommand(text: string): boolean {
  return text.trim().startsWith(';');
}
