'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoice } from '@/hooks/useVoice';
import { saveName, useStoredName } from '@/lib/useStoredName';
import {
  DEFAULT_SETTINGS,
  saveSettings,
  useStoredSettings,
  type AudioSettings,
} from '@/lib/audioSettings';
import { configureSfx, playSfx } from '@/lib/sounds';
import type { CompressedImage } from '@/lib/imageCompress';
import {
  getUserAudio,
  saveUserAudio,
  setUserAudio,
  useStoredUserAudio,
  type UserAudio,
  type UserAudioMap,
} from '@/lib/userVolumes';
import { EMPTY_PLAYER, type Channel, type JoinAck, type Message, type PlayerState, type User } from '@/lib/types';
import { isMusicCommand } from '@/lib/musicCommands';
import { Chat } from './Chat';
import { MemberList } from './MemberList';
import { SettingsModal } from './SettingsModal';
import { Sidebar } from './Sidebar';
import { MusicPlayer } from './MusicPlayer';
import { RemoteAudio } from './RemoteAudio';
import { Stage, type Share } from './Stage';
import { Hash, Speaker } from './icons';

export default function RoomClient({ roomId }: { roomId: string }) {
  const stored = useStoredName();
  const [chosen, setChosen] = useState<string | null>(null);
  const name = chosen ?? (stored || null);

  if (stored === null) return <div className="min-h-dvh bg-ink-500" />;
  if (!name) return <NameGate roomId={roomId} onDone={setChosen} />;
  return <Room roomId={roomId} name={name} />;
}

function NameGate({ roomId, onDone }: { roomId: string; onDone: (name: string) => void }) {
  const [draft, setDraft] = useState('');
  const submit = () => {
    const clean = draft.trim().slice(0, 24);
    if (!clean) return;
    saveName(clean);
    onDone(clean);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-800 p-4">
      <div className="w-full max-w-sm rounded-lg bg-ink-500 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blurple text-2xl">
          🎧
        </div>
        <h1 className="text-xl font-bold text-white">Entrar na sala {roomId}</h1>
        <p className="mt-1 mb-5 text-sm text-mute">Como você quer aparecer para a galera?</p>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 24))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Seu nome"
          className="mb-4 w-full rounded bg-ink-900 px-3 py-2.5 text-center text-bright outline-none ring-blurple placeholder:text-ink-200 focus:ring-2"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="w-full rounded bg-blurple py-2.5 font-medium text-white transition hover:bg-blurple-dark disabled:opacity-40"
        >
          Entrar
        </button>
      </div>
    </main>
  );
}

function Room({ roomId, name }: { roomId: string; name: string }) {
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [active, setActive] = useState('geral');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(EMPTY_PLAYER);
  /** relógio nosso menos o do servidor, para alinhar a posição da música */
  const [clockOffset, setClockOffset] = useState(0);
  const [musicVolume, setMusicVolume] = useState(60);

  // -------------------------------------------------------- configurações
  const stored = useStoredSettings();
  const [edited, setEdited] = useState<AudioSettings | null>(null);
  const settings = edited ?? stored ?? DEFAULT_SETTINGS;
  const settingsReady = stored !== null;

  useEffect(() => {
    configureSfx({ enabled: settings.sfxEnabled, volume: settings.sfxVolume / 100 });
  }, [settings.sfxEnabled, settings.sfxVolume]);

  // ------------------------------------------------ volume por pessoa
  const storedUserAudio = useStoredUserAudio();
  const [editedUserAudio, setEditedUserAudio] = useState<UserAudioMap | null>(null);
  const userAudio = editedUserAudio ?? storedUserAudio ?? {};

  const alterarVolumeDe = (userName: string, patch: Partial<UserAudio>) => {
    const next = setUserAudio(userAudio, userName, patch);
    setEditedUserAudio(next);
    saveUserAudio(next);
  };

  // meu canal de voz vem do servidor: evita divergência entre os clientes
  const myVoiceChannel = users.find((u) => u.id === myId)?.voiceChannel ?? null;

  const peerKey = users
    .filter((u) => u.id !== myId && u.voiceChannel && u.voiceChannel === myVoiceChannel)
    .map((u) => u.id)
    .sort()
    .join(',');
  const peerIds = useMemo(() => (peerKey ? peerKey.split(',') : []), [peerKey]);

  const voice = useVoice({ myId, peerIds, settings });

  // os handlers do socket precisam da versão mais recente da API de voz
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });

  const aplicarSettings = (next: AudioSettings) => {
    const previous = settings;
    setEdited(next);
    saveSettings(next);
    void voiceRef.current.applySettings(next, previous);
  };

  // ------------------------------------------------------------ socket
  useEffect(() => {
    const s = getSocket();

    // se cair e voltar, o id muda: refazemos o join (e a voz, se estava nela)
    const rejoinVoice = { channel: null as string | null };

    const join = () => {
      setConnected(true);
      s.emit('join', { roomId, name }, (ack: JoinAck) => {
        setMyId(ack.you.id);
        setUsers(ack.users);
        setChannels(ack.channels);
        setMessages(ack.messages ?? {});
        if (ack.player) {
          setClockOffset(Date.now() - ack.player.serverNow);
          setPlayer(ack.player);
        }
        setActive((cur) =>
          ack.channels.some((c) => c.id === cur && c.type === 'text')
            ? cur
            : (ack.channels.find((c) => c.type === 'text')?.id ?? 'geral')
        );
        if (rejoinVoice.channel) {
          const channel = rejoinVoice.channel;
          rejoinVoice.channel = null;
          void voiceRef.current.joinVoice(channel);
        }
      });
    };

    const onDisconnect = () => {
      setConnected(false);
      if (voiceRef.current.voiceChannel) {
        rejoinVoice.channel = voiceRef.current.voiceChannel;
        voiceRef.current.leaveVoice();
      }
    };

    const onPlayer = (st: PlayerState) => {
      setClockOffset(Date.now() - st.serverNow);
      setPlayer(st);
    };
    const onUsers = (list: User[]) => setUsers(list);
    const onChannels = (list: Channel[]) => setChannels(list);
    const onMessage = (msg: Message) => {
      setMessages((prev) => ({ ...prev, [msg.channelId]: [...(prev[msg.channelId] ?? []), msg] }));
      if (msg.userId !== s.id) playSfx('message');
    };

    s.on('connect', join);
    s.on('disconnect', onDisconnect);
    s.on('users', onUsers);
    s.on('channels', onChannels);
    s.on('message', onMessage);
    s.on('player:state', onPlayer);
    // se o socket já estava aberto, o evento 'connect' não vai disparar de novo
    if (s.connected) queueMicrotask(join);

    return () => {
      s.off('connect', join);
      s.off('disconnect', onDisconnect);
      s.off('users', onUsers);
      s.off('channels', onChannels);
      s.off('message', onMessage);
      s.off('player:state', onPlayer);
    };
  }, [roomId, name]);

  // ------------------------------------------- sons de entrada/saída na voz
  const antesNaVoz = useRef<Set<string>>(new Set());
  useEffect(() => {
    const agora = new Set(
      users.filter((u) => u.voiceChannel && u.voiceChannel === myVoiceChannel && u.id !== myId).map((u) => u.id)
    );
    const anterior = antesNaVoz.current;

    if (myVoiceChannel) {
      for (const id of agora) if (!anterior.has(id)) playSfx('someoneJoined');
      for (const id of anterior) if (!agora.has(id)) playSfx('someoneLeft');
    }
    antesNaVoz.current = agora;
  }, [users, myVoiceChannel, myId]);

  // ------------------------------------------------------------ derivados
  const me = users.find((u) => u.id === myId) ?? null;
  const activeChannel = channels.find((c) => c.id === active);

  const shares: Share[] = users
    .filter((u) => u.sharing && u.voiceChannel === myVoiceChannel && myVoiceChannel !== null)
    .map((u) => {
      const stream = u.id === myId ? voice.localScreen : voice.remoteStreams[u.id]?.screen;
      if (!stream) return null;
      const audio = getUserAudio(userAudio, u.name);
      return {
        user: u,
        stream,
        isLocal: u.id === myId,
        userVolume: audio.volume,
        userMuted: audio.muted,
      };
    })
    .filter((s): s is Share => s !== null);

  const send = (text: string, image?: CompressedImage) => {
    // ";play ..." e amigos vão para o bot, não viram mensagem normal
    if (!image && isMusicCommand(text)) {
      getSocket().emit('music:command', { channelId: active, text });
      playSfx('send');
      return;
    }
    getSocket().emit('message', { channelId: active, text, image });
    playSfx('send');
  };
  const createChannel = (channelName: string, type: 'text' | 'voice') =>
    getSocket().emit('channel:create', { name: channelName, type });

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-500">
      <Sidebar
        roomId={roomId}
        channels={channels}
        users={users}
        me={me}
        speaking={voice.speaking}
        activeChannel={active}
        onSelectChannel={setActive}
        onCreateChannel={createChannel}
        onOpenSettings={() => setSettingsOpen(true)}
        voice={{
          inVoice: voice.inVoice,
          voiceChannel: voice.voiceChannel,
          micOn: voice.micOn,
          micLive: voice.micLive,
          deafened: voice.deafened,
          connecting: voice.connecting,
          joinVoice: (id) => {
            playSfx('join');
            void voice.joinVoice(id);
          },
          leaveVoice: () => {
            playSfx('leave');
            voice.leaveVoice();
          },
          toggleMic: () => {
            playSfx(voice.micOn ? 'mute' : 'unmute');
            voice.toggleMic();
          },
          toggleDeafen: () => {
            playSfx(voice.deafened ? 'unmute' : 'mute');
            voice.toggleDeafen();
          },
          startScreen: () => {
            playSfx('shareStart');
            void voice.startScreen();
          },
          stopScreen: () => {
            playSfx('shareStop');
            voice.stopScreen();
          },
          isSharing: !!voice.localScreen,
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-900/60 px-4 shadow-sm">
          {activeChannel?.type === 'voice' ? (
            <Speaker className="h-5 w-5 text-mute" />
          ) : (
            <Hash className="h-5 w-5 text-mute" />
          )}
          <span className="font-semibold text-white">{activeChannel?.name ?? '...'}</span>
          <span className="ml-3 hidden border-l border-ink-400 pl-3 text-[13px] text-mute sm:block">
            {users.length} {users.length === 1 ? 'pessoa' : 'pessoas'} na sala
          </span>
          {!connected && (
            <span className="ml-auto rounded bg-danger/20 px-2 py-1 text-xs text-danger">
              reconectando...
            </span>
          )}
        </header>

        {voice.error && (
          <div className="flex items-center gap-3 border-b border-danger/40 bg-danger/15 px-4 py-2 text-sm text-danger">
            <span className="flex-1">{voice.error}</span>
            <button onClick={voice.clearError} className="shrink-0 text-xs underline">
              ok
            </button>
          </div>
        )}

        {voice.inVoice && !voice.micLive && !voice.error && (
          <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-300">
            Seu microfone parou de responder — reconectando ele automaticamente...
          </div>
        )}

        <MusicPlayer
          state={player}
          clockOffset={clockOffset}
          volume={musicVolume}
          onVolumeChange={setMusicVolume}
          onEnded={(videoId) => getSocket().emit('music:ended', { videoId, channelId: active })}
        />

        <Stage
          shares={shares}
          volume={settings.outputVolume}
          deafened={voice.deafened}
          outputDeviceId={settings.outputDeviceId}
        />

        <Chat channel={activeChannel} messages={messages[active] ?? []} onSend={send} />
      </main>

      <MemberList
        users={users}
        me={me}
        speaking={voice.speaking}
        userAudio={userAudio}
        onUserAudioChange={alterarVolumeDe}
      />

      {/* áudio (microfone) dos outros participantes */}
      {Object.entries(voice.remoteStreams).map(([id, streams]) => {
        if (!streams.mic) return null;
        const pessoa = users.find((u) => u.id === id);
        const audio = pessoa ? getUserAudio(userAudio, pessoa.name) : null;
        return (
          <RemoteAudio
            key={id}
            stream={streams.mic}
            muted={voice.deafened || !!audio?.muted}
            volume={(settings.outputVolume / 100) * (audio?.volume ?? 100)}
            outputDeviceId={settings.outputDeviceId}
          />
        );
      })}

      {settingsReady && settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={aplicarSettings}
          onClose={() => setSettingsOpen(false)}
          inputLevel={voice.inputLevel}
          inVoice={voice.inVoice}
          playingFile={voice.playingFile}
          onPlayFile={(f) => void voice.playFileInCall(f)}
          onStopFile={voice.stopFileInCall}
        />
      )}
    </div>
  );
}
