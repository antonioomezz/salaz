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
      // pedir o ideal alto importa: o navegador captura no que for pedido, e
      // não dá para recuperar quadros que nunca foram capturados
      frameRate: { ideal: motion ? 60 : 30, max: motion ? 60 : 30 },
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    // trocar a aba compartilhada sem reiniciar a transmissão
    surfaceSwitching: 'include',
    // evita o efeito espelho ao compartilhar a própria aba do Negoneycord
    selfBrowserSurface: 'exclude',
    systemAudio: 'include',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions;
}

/**
 * A ordem muda conforme o objetivo:
 *
 * - Texto/código: AV1 e VP9 comprimem muito melhor conteúdo estático e nítido.
 * - Vídeo/jogo: o AV1 costuma ser codificado por software e come CPU demais a
 *   60 fps, o que derruba justamente a fluidez. VP9 e H264 têm bem mais chance
 *   de usar o encoder de hardware da placa.
 */
const ORDEM: Record<ScreenPreset, string[]> = {
  detail: ['video/AV1', 'video/VP9', 'video/VP8', 'video/H264'],
  motion: ['video/VP9', 'video/H264', 'video/VP8', 'video/AV1'],
};

export function preferScreenCodecs(transceiver: RTCRtpTransceiver, preset: ScreenPreset) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (!caps?.codecs || !transceiver.setCodecPreferences) return;

    const preferencia = ORDEM[preset];
    const posicao = (mime: string) => {
      const i = preferencia.indexOf(mime);
      return i === -1 ? preferencia.length : i;
    };
    const ordenados = [...caps.codecs].sort((a, b) => posicao(a.mimeType) - posicao(b.mimeType));
    transceiver.setCodecPreferences(ordenados);
  } catch {
    /* navegador sem suporte: segue no codec padrão */
  }
}

/**
 * Teto de banda por destinatário, em bits por segundo.
 *
 * É um TETO, não uma meta: o controle de congestionamento do WebRTC já baixa
 * sozinho quando a rede não aguenta. Por isso vale ser generoso aqui — apertar
 * o teto só impede a transmissão de ficar boa quando a banda existe.
 *
 * 10 Mbps é o que 1080p60 de tela precisa para ficar realmente nítido.
 */
const BITRATE_BASE: Record<ScreenPreset, number> = {
  detail: 5_000_000,
  motion: 10_000_000,
};

/**
 * Com muita gente na sala o upload é multiplicado, então reduzimos um pouco —
 * mas nunca abaixo do que 1080p60 exige, senão o preset perde o sentido.
 */
const BITRATE_MINIMO: Record<ScreenPreset, number> = {
  detail: 2_000_000,
  motion: 6_000_000,
};

/**
 * Sem isto o navegador degrada a transmissão por conta própria — era a causa
 * da tela chegar em 320x180 do outro lado.
 *
 * `peerCount` divide a banda: numa malha P2P você envia uma cópia para cada
 * pessoa, então 3 espectadores a 8 Mbps seriam 24 Mbps de upload. Estourar o
 * link entope a fila do encoder e derruba o fps de todo mundo.
 */
export async function tuneScreenSender(
  sender: RTCRtpSender,
  preset: ScreenPreset,
  peerCount = 1
) {
  try {
    const motion = preset === 'motion';
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];

    const teto = Math.max(
      BITRATE_MINIMO[preset],
      Math.round(BITRATE_BASE[preset] / Math.max(1, peerCount))
    );
    params.encodings[0].maxBitrate = teto;
    params.encodings[0].maxFramerate = motion ? 60 : 30;
    // não deixa o navegador reduzir a resolução por conta própria
    params.encodings[0].scaleResolutionDownBy = 1;

    // 'maintain-framerate' derruba resolução para segurar os quadros — é o que
    // se quer em jogo e vídeo. Em texto vale o contrário.
    params.degradationPreference = motion ? 'maintain-framerate' : 'maintain-resolution';

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
