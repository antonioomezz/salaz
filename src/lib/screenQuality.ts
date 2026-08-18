'use client';

export type ScreenPreset = 'detail' | 'motion';

/**
 * Constraints de captura. Os campos além de video/audio são recentes e
 * ignorados em silêncio por navegadores que não os conhecem.
 */
export function displayConstraints(preset: ScreenPreset): DisplayMediaStreamOptions {
  const motion = preset === 'motion';
  return {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: motion ? 60 : 15, max: motion ? 60 : 30 },
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    // trocar a aba compartilhada sem reiniciar a transmissão
    surfaceSwitching: 'include',
    // evita o efeito espelho ao compartilhar a própria aba do Salaz
    selfBrowserSurface: 'exclude',
    systemAudio: 'include',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions;
}

/** VP9/AV1 comprimem conteúdo de tela bem melhor que o VP8 padrão. */
const PREFERENCIA = ['video/AV1', 'video/VP9', 'video/VP8', 'video/H264'];

export function preferScreenCodecs(transceiver: RTCRtpTransceiver) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (!caps?.codecs || !transceiver.setCodecPreferences) return;

    const posicao = (mime: string) => {
      const i = PREFERENCIA.indexOf(mime);
      return i === -1 ? PREFERENCIA.length : i;
    };
    const ordenados = [...caps.codecs].sort((a, b) => posicao(a.mimeType) - posicao(b.mimeType));
    transceiver.setCodecPreferences(ordenados);
  } catch {
    /* navegador sem suporte: segue no codec padrão */
  }
}

/**
 * Sem isto o navegador degrada a resolução por conta própria — era a causa da
 * tela chegar em 320x180 do outro lado.
 */
export async function tuneScreenSender(sender: RTCRtpSender, preset: ScreenPreset) {
  try {
    const motion = preset === 'motion';
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = motion ? 6_000_000 : 3_000_000;
    params.encodings[0].maxFramerate = motion ? 60 : 30;
    // 'maintain-resolution' = prefere perder quadros a perder nitidez
    params.degradationPreference = motion ? 'balanced' : 'maintain-resolution';
    await sender.setParameters(params);
  } catch {
    /* alguns navegadores recusam parâmetros antes da negociação; sem problema */
  }
}

export function applyContentHint(track: MediaStreamTrack, preset: ScreenPreset) {
  try {
    (track as MediaStreamTrack & { contentHint: string }).contentHint =
      preset === 'motion' ? 'motion' : 'detail';
  } catch {
    /* propriedade opcional */
  }
}
