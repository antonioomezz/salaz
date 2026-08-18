'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerState } from '@/lib/types';
import { Speaker } from './icons';

/** Tipagem mínima da IFrame Player API do YouTube (não há @types oficial). */
type YTPlayer = {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setVolume: (v: number) => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function carregarApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('falha ao carregar a API do YouTube'));
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    document.head.appendChild(script);
  });
  return apiPromise;
}

type Props = {
  state: PlayerState;
  /** diferença entre o relógio do servidor e o nosso, em ms */
  clockOffset: number;
  volume: number;
  onVolumeChange: (v: number) => void;
  onEnded: (videoId: string) => void;
};

export function MusicPlayer({ state, clockOffset, volume, onVolumeChange, onEnded }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [pronto, setPronto] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [aberto, setAberto] = useState(true);
  const videoAtual = useRef<string | null>(null);

  // os callbacks do player do YouTube precisam sempre da versão mais recente
  const estado = useRef(state);
  const aoTerminar = useRef(onEnded);
  useEffect(() => {
    estado.current = state;
    aoTerminar.current = onEnded;
  });

  /** Onde a música deveria estar agora, segundo o relógio do servidor. */
  const posicaoAlvo = () => {
    const s = estado.current;
    if (!s.current) return 0;
    const agoraNoServidor = Date.now() - clockOffset;
    const decorrido = s.playing ? agoraNoServidor - s.updatedAt : 0;
    return Math.max(0, (s.positionMs + decorrido) / 1000);
  };

  // cria o player uma vez
  useEffect(() => {
    let vivo = true;
    void carregarApi()
      .then((YT) => {
        if (!vivo || !host.current || player.current) return;
        player.current = new YT.Player(host.current, {
          height: '100%',
          width: '100%',
          playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => setPronto(true),
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.ENDED && estado.current.current) {
                aoTerminar.current(estado.current.current.videoId);
              }
              // o navegador bloqueou o autoplay: precisamos de um clique
              if (e.data === YT.PlayerState.PAUSED && estado.current.playing) setBloqueado(true);
              if (e.data === YT.PlayerState.PLAYING) setBloqueado(false);
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    if (pronto) player.current?.setVolume(volume);
  }, [volume, pronto]);

  // aplica o estado do servidor
  useEffect(() => {
    const p = player.current;
    if (!p || !pronto) return;

    if (!state.current) {
      videoAtual.current = null;
      p.pauseVideo();
      return;
    }

    if (videoAtual.current !== state.current.videoId) {
      videoAtual.current = state.current.videoId;
      p.loadVideoById({ videoId: state.current.videoId, startSeconds: posicaoAlvo() });
      if (!state.playing) setTimeout(() => p.pauseVideo(), 300);
      return;
    }

    if (state.playing) p.playVideo();
    else p.pauseVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pronto]);

  // corrige a defasagem periodicamente
  useEffect(() => {
    if (!pronto) return;
    const timer = setInterval(() => {
      const p = player.current;
      const s = estado.current;
      if (!p || !s.current || !s.playing) return;
      const alvo = posicaoAlvo();
      const atual = p.getCurrentTime();
      if (Math.abs(atual - alvo) > 1.5) p.seekTo(alvo, true);
    }, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, clockOffset]);

  const tocando = !!state.current;

  // O host do player fica SEMPRE montado, mesmo sem música: se ele só
  // aparecesse junto com a primeira faixa, o efeito de criação não teria
  // elemento nenhum para anexar e o player nunca nasceria.
  return (
    <div
      className={
        tocando ? 'shrink-0 border-b border-ink-900/60 bg-ink-800' : 'h-0 overflow-hidden'
      }
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div
          className={`overflow-hidden rounded bg-black ${
            tocando && aberto ? 'h-[90px] w-40' : 'h-0 w-0'
          }`}
        >
          <div ref={host} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {state.current?.title ?? ''}
          </div>
          <div className="truncate text-[11px] text-mute">
            {state.current && `pedido por ${state.current.addedBy}`}
            {state.queue.length > 0 && ` · ${state.queue.length} na fila`}
            {state.current && !state.playing && ' · pausado'}
          </div>

          {bloqueado && tocando && (
            <button
              onClick={() => player.current?.playVideo()}
              className="mt-1 rounded bg-blurple px-2 py-1 text-[11px] font-medium text-white"
            >
              Clique para ouvir (o navegador bloqueou o som)
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Speaker className="h-4 w-4 text-mute" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            title="Volume da música (só para você)"
            className="w-24 accent-blurple"
          />
        </div>

        <button
          onClick={() => setAberto((v) => !v)}
          className="rounded px-2 py-1 text-[11px] text-mute transition hover:bg-ink-400 hover:text-white"
        >
          {aberto ? 'ocultar' : 'mostrar'}
        </button>
      </div>
    </div>
  );
}
