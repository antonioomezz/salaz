'use client';

/**
 * Mixer do áudio que SAI daqui.
 *
 *   microfone ──► ganho(mic) ──┐
 *   música local ► ganho(música) ┼─► master ─► destination ─► track enviada
 *                               └─► alto-falante (você também ouve a música)
 *
 * Regra que protege o caminho crítico: quem não mexer em nada continua
 * enviando a track crua do microfone, sem WebAudio no meio. O mixer só entra
 * quando há motivo — ganho diferente de 100% ou uma fonte extra tocando.
 */
export type Mixer = {
  track: MediaStreamTrack;
  setMicGain: (percent: number) => void;
  setMusicGain: (percent: number) => void;
  playFile: (url: string) => HTMLAudioElement;
  stopFile: () => void;
  destroy: () => void;
};

export function createMixer(
  ctx: AudioContext,
  micTrack: MediaStreamTrack,
  opts: { micVolume: number; musicVolume: number }
): Mixer | null {
  try {
    const micSrc = ctx.createMediaStreamSource(new MediaStream([micTrack]));
    const micGain = ctx.createGain();
    const musicGain = ctx.createGain();
    const master = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();

    micGain.gain.value = opts.micVolume / 100;
    musicGain.gain.value = opts.musicVolume / 100;

    micSrc.connect(micGain).connect(master);
    musicGain.connect(master);
    master.connect(dest);
    // a música também vai para o alto-falante, senão só os outros ouviriam
    musicGain.connect(ctx.destination);

    let audioEl: HTMLAudioElement | null = null;
    let elSource: MediaElementAudioSourceNode | null = null;

    const stopFile = () => {
      audioEl?.pause();
      elSource?.disconnect();
      elSource = null;
      if (audioEl?.src.startsWith('blob:')) URL.revokeObjectURL(audioEl.src);
      audioEl = null;
    };

    return {
      track: dest.stream.getAudioTracks()[0] ?? micTrack,
      setMicGain: (p) => {
        micGain.gain.value = p / 100;
      },
      setMusicGain: (p) => {
        musicGain.gain.value = p / 100;
      },
      playFile: (url) => {
        stopFile();
        audioEl = new Audio(url);
        audioEl.crossOrigin = 'anonymous';
        // createMediaElementSource tira o elemento da saída padrão; por isso o
        // musicGain precisa estar ligado ao ctx.destination lá em cima
        elSource = ctx.createMediaElementSource(audioEl);
        elSource.connect(musicGain);
        void audioEl.play().catch(() => {});
        return audioEl;
      },
      stopFile,
      destroy: () => {
        stopFile();
        micSrc.disconnect();
        micGain.disconnect();
        musicGain.disconnect();
        master.disconnect();
      },
    };
  } catch {
    return null;
  }
}
