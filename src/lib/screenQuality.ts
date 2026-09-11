'use client';

export type ScreenPreset = 'detail' | 'motion';

/**
 * Constraints de captura. Os campos além de video/audio são recentes e
 * ignorados em silêncio por navegadores que não os conhecem.
 */
export type ScreenAudio = 'tab' | 'system' | 'none';

export function displayConstraints(
  preset: ScreenPreset,
  fps: number,
  screenAudio: ScreenAudio
): DisplayMediaStreamOptions {
  return {
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      // Não capturar acima da qualidade escolhida: poupa encoder e upload.
      frameRate: { ideal: fps, max: fps },
    },
    audio:
      screenAudio === 'none'
        ? false
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false, restrictOwnAudio: true, suppressLocalAudioPlayback: false },
    // trocar a aba compartilhada sem reiniciar a transmissão
    surfaceSwitching: 'include',
    // evita o efeito espelho ao compartilhar a própria aba do Negoneycord
    selfBrowserSurface: 'exclude',
    // 'exclude' impede o Chrome de oferecer o som do sistema inteiro; com isso
    // sobra só o áudio da aba, que é o único que dá para isolar de verdade
    systemAudio: 'exclude',
    windowAudio: 'exclude',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions;
}

/**
 * VP9 para detalhe; H264 primeiro para movimento, favorecendo o encoder de hardware.
 *
 * O AV1 fica por último de propósito. Ele comprime melhor no papel, mas quase
 * sempre é codificado por SOFTWARE — a 1080p o codificador não dá conta, para
 * de produzir quadros e o outro lado vê tela preta, enquanto quem transmite
 * continua vendo tudo certo (a prévia local não passa pelo codificador).
 */
const ORDEM: Record<ScreenPreset, string[]> = {
  detail: ['video/VP9', 'video/VP8', 'video/H264', 'video/AV1'],
  motion: ['video/H264', 'video/VP8', 'video/VP9', 'video/AV1'],
};

/** Última tentativa quando nada é codificado: H264 tem encoder de hardware quase sempre. */
export const ORDEM_SEGURA = ['video/H264', 'video/VP8', 'video/VP9', 'video/AV1'];

export function preferScreenCodecs(
  transceiver: RTCRtpTransceiver,
  preset: ScreenPreset,
  seguro = false
) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (!caps?.codecs || !transceiver.setCodecPreferences) return;

    const preferencia = seguro ? ORDEM_SEGURA : ORDEM[preset];
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
  peerCount = 1,
  fps = 60
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
    params.encodings[0].maxFramerate = fps;
    /*
     * Sem travar scaleResolutionDownBy: fixá-lo em 1 tira a válvula de escape
     * do codificador. Quando ele não dá conta, não consegue reduzir para se
     * salvar — simplesmente para, e o outro lado vê tela preta.
     */
    delete params.encodings[0].scaleResolutionDownBy;

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

/**
 * Reforça a taxa de quadros na track já capturada. Alguns capturadores começam
 * abaixo do pedido e sobem quando a restrição é reaplicada.
 */
export async function pushFrameRate(track: MediaStreamTrack, fps: number) {
  try {
    await track.applyConstraints({ width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: fps, max: fps } });
  } catch {
    /* o capturador não aceitou; segue no que conseguir */
  }
}

/**
 * Que tipo de superfície o usuário escolheu: 'browser' (aba), 'window'
 * (janela) ou 'monitor' (tela inteira).
 */
export function displaySurfaceOf(track: MediaStreamTrack): string | null {
  try {
    return (track.getSettings() as MediaTrackSettings & { displaySurface?: string })
      .displaySurface ?? null;
  } catch {
    return null;
  }
}
