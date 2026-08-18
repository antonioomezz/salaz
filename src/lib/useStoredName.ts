'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'salaz:name';
const neverChanges = () => () => {};

/**
 * Lê o nome salvo no navegador sem quebrar a hidratação:
 * `null` = ainda não lemos (servidor / primeiro render), `''` = sem nome salvo.
 */
export function useStoredName(): string | null {
  return useSyncExternalStore(
    neverChanges,
    () => localStorage.getItem(KEY) ?? '',
    () => null
  );
}

export function saveName(name: string) {
  localStorage.setItem(KEY, name);
}
