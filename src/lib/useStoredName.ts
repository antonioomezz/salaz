'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'negoneycord:name';
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

/**
 * O app se chamava "salaz"; migra o nome salvo uma única vez para que quem já
 * usava não precise digitar de novo.
 */
export function migrarChavesAntigas() {
  const pares: [string, string][] = [
    ['salaz:name', 'negoneycord:name'],
    ['salaz:audio', 'negoneycord:audio'],
    ['salaz:userAudio', 'negoneycord:userAudio'],
  ];
  try {
    for (const [antiga, nova] of pares) {
      const valor = localStorage.getItem(antiga);
      if (valor !== null && localStorage.getItem(nova) === null) {
        localStorage.setItem(nova, valor);
      }
      if (valor !== null) localStorage.removeItem(antiga);
    }
  } catch {
    /* localStorage bloqueado: segue com os padrões */
  }
}
