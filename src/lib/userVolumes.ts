'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type UserAudio = {
  /** voz da pessoa (microfone), 0-200. Acima de 100 exige ganho por WebAudio. */
  volume: number;
  /**
   * Áudio da transmissão de tela dela, 0-200 — separado da voz de propósito:
   * quem compartilha a tela inteira com som do sistema acaba recapturando a
   * própria chamada, e você precisa poder abaixar a live sem perder as vozes.
   */
  screenVolume: number;
  muted: boolean;
};

export const DEFAULT_USER_AUDIO: UserAudio = { volume: 100, screenVolume: 100, muted: false };

const KEY = 'negoneycord:userAudio';

/**
 * A chave é o NOME da pessoa, não o id do socket: o id muda a cada conexão,
 * então seria inútil para lembrar o volume entre sessões.
 */
const normalize = (name: string) => name.trim().toLowerCase();

export type UserAudioMap = Record<string, UserAudio>;

export function getUserAudio(map: UserAudioMap, name: string): UserAudio {
  const salvo = map[normalize(name)];
  // o formato antigo não tinha screenVolume; o spread cobre esse caso
  return salvo ? { ...DEFAULT_USER_AUDIO, ...salvo } : DEFAULT_USER_AUDIO;
}

export function setUserAudio(map: UserAudioMap, name: string, patch: Partial<UserAudio>): UserAudioMap {
  const key = normalize(name);
  return { ...map, [key]: { ...getUserAudio(map, name), ...patch } };
}

export function saveUserAudio(map: UserAudioMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* localStorage bloqueado: vale só nesta sessão */
  }
}

const neverChanges = () => () => {};

/** `null` = ainda não lemos (servidor / primeiro render). */
export function useStoredUserAudio(): UserAudioMap | null {
  const raw = useSyncExternalStore(
    neverChanges,
    () => localStorage.getItem(KEY) ?? '',
    () => null
  );

  return useMemo(() => {
    if (raw === null) return null;
    if (!raw) return {};
    try {
      return JSON.parse(raw) as UserAudioMap;
    } catch {
      return {};
    }
  }, [raw]);
}
