'use client';

import { useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { Camera, Expand, Screen, Speaker, SpeakerMuted } from './icons';

export type Tile = {
  user: User;
  stream: MediaStream;
  isLocal: boolean;
  /** tela compartilhada ou câmera do participante */
  kind: 'screen' | 'cam';
  /** 0-200: volume individual configurado para esta pessoa */
  userVolume: number;
  userMuted: boolean;
};

type Props = {
  tiles: Tile[];
  /** medição da própria transmissão de tela, se houver */
  screenStats?: { width: number; height: number; fps: number; kbps: number } | null;
  /** 0-100 */
  volume: number;
  deafened: boolean;
  outputDeviceId: string;
};

export function Stage({ tiles, screenStats, volume, deafened, outputDeviceId }: Props) {
  if (!tiles.length) return null;

  // telas ocupam a linha de cima e mandam no layout; câmeras ficam menores
  const telas = tiles.filter((t) => t.kind === 'screen');
  const cameras = tiles.filter((t) => t.kind === 'cam');

  return (
    <div className="shrink-0 space-y-3 border-b border-ink-900/60 bg-ink-900 p-3">
      {telas.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(telas.length, 2)}, minmax(0, 1fr))` }}
        >
          {telas.map((t) => (
            <VideoTile
              key={t.user.id + t.kind}
              tile={t}
              maxHeight={telas.length === 1 ? '44vh' : '28vh'}
              volume={(volume / 100) * t.userVolume}
              deafened={deafened}
              outputDeviceId={outputDeviceId}
              stats={t.isLocal ? screenStats : null}
            />
          ))}
        </div>
      )}

      {cameras.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {cameras.map((t) => (
            <VideoTile
              key={t.user.id + t.kind}
              tile={t}
              maxHeight={telas.length > 0 ? '14vh' : '32vh'}
              volume={(volume / 100) * t.userVolume}
              deafened={deafened}
              outputDeviceId={outputDeviceId}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({
  tile,
  maxHeight,
  volume,
  deafened,
  outputDeviceId,
  compact = false,
  stats = null,
}: {
  tile: Tile;
  maxHeight: string;
  volume: number;
  deafened: boolean;
  outputDeviceId: string;
  compact?: boolean;
  stats?: { width: number; height: number; fps: number; kbps: number } | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const temAudio = tile.stream.getAudioTracks().length > 0;
  const ehCamera = tile.kind === 'cam';

  useEffect(() => {
    const el = video.current;
    if (el && el.srcObject !== tile.stream) {
      el.srcObject = tile.stream;
      el.play().catch(() => {});
    }
  }, [tile.stream]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    // a própria imagem fica sempre muda para não realimentar o alto-falante
    el.muted = tile.isLocal || deafened || tile.userMuted;
    el.volume = Math.max(0, Math.min(1, volume / 100));
  }, [tile.isLocal, tile.userMuted, deafened, volume]);

  useEffect(() => {
    const el = video.current as
      | (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!el?.setSinkId || tile.isLocal) return;
    void el.setSinkId(outputDeviceId).catch(() => {});
  }, [outputDeviceId, tile.isLocal]);

  return (
    <div
      className={`group relative overflow-hidden rounded-lg bg-black ring-1 ring-ink-400 ${
        compact ? 'w-56 shrink-0' : ''
      }`}
    >
      <video
        ref={video}
        autoPlay
        playsInline
        className="w-full bg-black object-contain"
        style={{
          maxHeight,
          // espelhar a própria câmera é o que todo mundo espera
          transform: ehCamera && tile.isLocal ? 'scaleX(-1)' : undefined,
        }}
      />

      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
        {ehCamera ? (
          <Camera className="h-3.5 w-3.5 text-online" />
        ) : (
          <Screen className="h-3.5 w-3.5 text-online" />
        )}
        {tile.isLocal ? 'Você' : tile.user.name}
        {!ehCamera &&
          (temAudio ? (
            <Speaker className="h-3.5 w-3.5 text-online" />
          ) : (
            <SpeakerMuted className="h-3.5 w-3.5 text-mute" />
          ))}
      </div>

      {stats && stats.width > 0 && (
        <div
          className="absolute top-1.5 left-1.5 rounded bg-black/70 px-2 py-1 font-mono text-[10px]"
          title="O que está realmente saindo daqui"
        >
          <span className={stats.height >= 1080 ? 'text-online' : 'text-amber-400'}>
            {stats.width}×{stats.height}
          </span>
          <span className="text-mute"> · </span>
          <span className={stats.fps >= 50 ? 'text-online' : 'text-amber-400'}>{stats.fps} fps</span>
          <span className="text-mute"> · {(stats.kbps / 1000).toFixed(1)} Mbps</span>
        </div>
      )}

      <button
        onClick={() => video.current?.requestFullscreen?.()}
        title="Tela cheia"
        className="absolute top-1.5 right-1.5 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
      >
        <Expand className="h-4 w-4" />
      </button>
    </div>
  );
}
