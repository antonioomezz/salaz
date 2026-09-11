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
  /**
   * Isolamento de voz do próprio Chrome (mais recente e bem mais forte que o
   * noiseSuppression). Ignorado em silêncio por navegadores sem suporte.
   */
  voiceIsolation: boolean;
  /**
   * Porta de ruído: só transmite quando você realmente fala. É o que corta
   * teclado e chiado de fundo, que a supressão do navegador deixa passar.
   */
  noiseGate: boolean;
  /** 0-100: a partir de que nível o microfone abre */
  noiseGateThreshold: number;
  sfxEnabled: boolean;
  /** 0-100 */
  sfxVolume: number;
  /**
   * 'detail' privilegia nitidez (texto, código); 'motion' privilegia fluidez
   * (vídeo, jogo). Vira contentHint + bitrate + framerate na transmissão.
   */
  screenPreset: 'detail' | 'motion';
  /** taxa de quadros pedida na captura de tela */
  screenFps: 30 | 60;
  /**
   * O que capturar de áudio ao transmitir:
   * - 'tab': só o som da aba escolhida (preciso; nenhum outro som vaza)
   * - 'system': no desktop, som do computador excluindo o Negoneycord.
   *   No navegador só permitimos som de aba para evitar recapturar a chamada.
   * - 'none': sem áudio
   */
  screenAudio: 'tab' | 'system' | 'none';
  /** 0-100: volume do arquivo de música tocado direto na chamada */
  musicVolume: number;
  /** '' = câmera padrão do sistema */
  videoDeviceId: string;
};

export const DEFAULT_SETTINGS: AudioSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  inputVolume: 100,
  outputVolume: 100,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
  noiseGate: true,
  noiseGateThreshold: 12,
  sfxEnabled: true,
  sfxVolume: 60,
  screenPreset: 'motion',
  screenFps: 60,
  screenAudio: 'tab',
  musicVolume: 70,
  videoDeviceId: '',
};

const KEY = 'negoneycord:audio';

function normalizeSettings(saved: Partial<AudioSettings>): AudioSettings {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  // Preferência antiga de áudio global: na web usar apenas a aba escolhida.
  if (settings.screenAudio === 'system') settings.screenAudio = 'tab';
  return settings;
}

export function loadSettings(): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // mescla com o padrão para sobreviver a versões antigas do objeto salvo
    return normalizeSettings(JSON.parse(raw) as Partial<AudioSettings>);
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
      // constraint recente; navegador que não conhece simplesmente ignora
      ...(settings.voiceIsolation ? { voiceIsolation: true } : {}),
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
      return normalizeSettings(JSON.parse(raw) as Partial<AudioSettings>);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }, [raw]);
}
