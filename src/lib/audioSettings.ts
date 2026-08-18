'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type AudioSettings = {
  /** '' = dispositivo padrão do sistema */
  inputDeviceId: string;
  outputDeviceId: string;
  /** 0-200. Em 100 mandamos a track crua, sem processamento nenhum. */
  inputVolume: number;
  /** 0-100, aplicado no áudio que você ouve dos outros */
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sfxEnabled: boolean;
  /** 0-100 */
  sfxVolume: number;
  /**
   * 'detail' privilegia nitidez (texto, código); 'motion' privilegia fluidez
   * (vídeo, jogo). Vira contentHint + bitrate + framerate na transmissão.
   */
  screenPreset: 'detail' | 'motion';
  /** 0-100: volume do arquivo de música tocado direto na chamada */
  musicVolume: number;
};

export const DEFAULT_SETTINGS: AudioSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  inputVolume: 100,
  outputVolume: 100,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sfxEnabled: true,
  sfxVolume: 60,
  screenPreset: 'detail',
  musicVolume: 70,
};

const KEY = 'salaz:audio';

export function loadSettings(): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // mescla com o padrão para sobreviver a versões antigas do objeto salvo
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AudioSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* localStorage cheio ou bloqueado: as configurações valem só nesta sessão */
  }
}

/** Constraints de captura do microfone a partir das configurações. */
export function micConstraints(settings: AudioSettings): MediaStreamConstraints {
  return {
    audio: {
      ...(settings.inputDeviceId ? { deviceId: { exact: settings.inputDeviceId } } : {}),
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    },
    video: false,
  };
}

const neverChanges = () => () => {};

/**
 * Lê as configurações salvas sem quebrar a hidratação.
 * `null` = ainda não lemos (servidor / primeiro render).
 */
export function useStoredSettings(): AudioSettings | null {
  const raw = useSyncExternalStore(
    neverChanges,
    () => localStorage.getItem(KEY) ?? '',
    () => null
  );

  return useMemo(() => {
    if (raw === null) return null;
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }, [raw]);
}
