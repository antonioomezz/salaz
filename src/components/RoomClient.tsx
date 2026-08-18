'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoice } from '@/hooks/useVoice';
import { saveName, useStoredName } from '@/lib/useStoredName';
import type { Channel, JoinAck, Message, User } from '@/lib/types';
import { Chat } from './Chat';
import { MemberList } from './MemberList';
import { Sidebar } from './Sidebar';
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

  // meu canal de voz vem do servidor: evita divergência entre os clientes
  const myVoiceChannel = users.find((u) => u.id === myId)?.voiceChannel ?? null;

  const peerKey = users
    .filter((u) => u.id !== myId && u.voiceChannel && u.voiceChannel === myVoiceChannel)
    .map((u) => u.id)
    .sort()
    .join(',');
  const peerIds = useMemo(() => (peerKey ? peerKey.split(',') : []), [peerKey]);

  const voice = useVoice({ myId, peerIds });

  // os handlers do socket precisam da versão mais recente da API de voz
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });

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

    const onUsers = (list: User[]) => setUsers(list);
    const onChannels = (list: Channel[]) => setChannels(list);
    const onMessage = (msg: Message) =>
      setMessages((prev) => ({ ...prev, [msg.channelId]: [...(prev[msg.channelId] ?? []), msg] }));

    s.on('connect', join);
    s.on('disconnect', onDisconnect);
    s.on('users', onUsers);
    s.on('channels', onChannels);
    s.on('message', onMessage);
    // se o socket já estava aberto, o evento 'connect' não vai disparar de novo
    if (s.connected) queueMicrotask(join);

    return () => {
      s.off('connect', join);
      s.off('disconnect', onDisconnect);
      s.off('users', onUsers);
      s.off('channels', onChannels);
      s.off('message', onMessage);
    };
  }, [roomId, name]);

  // ------------------------------------------------------------ derivados
  const me = users.find((u) => u.id === myId) ?? null;
  const activeChannel = channels.find((c) => c.id === active);

  const shares: Share[] = users
    .filter((u) => u.sharing && u.voiceChannel === myVoiceChannel && myVoiceChannel !== null)
    .map((u) => {
      const stream = u.id === myId ? voice.localScreen : voice.remoteVideo[u.id];
      return stream ? { user: u, stream, isLocal: u.id === myId } : null;
    })
    .filter((s): s is Share => s !== null);

  const send = (text: string) => getSocket().emit('message', { channelId: active, text });
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
        voice={{
          inVoice: voice.inVoice,
          voiceChannel: voice.voiceChannel,
          micOn: voice.micOn,
          deafened: voice.deafened,
          connecting: voice.connecting,
          joinVoice: (id) => void voice.joinVoice(id),
          leaveVoice: voice.leaveVoice,
          toggleMic: voice.toggleMic,
          toggleDeafen: voice.toggleDeafen,
          startScreen: () => void voice.startScreen(),
          stopScreen: voice.stopScreen,
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
          <div className="border-b border-danger/40 bg-danger/15 px-4 py-2 text-sm text-danger">
            {voice.error}
          </div>
        )}

        <Stage shares={shares} />

        <Chat channel={activeChannel} messages={messages[active] ?? []} onSend={send} />
      </main>

      <MemberList users={users} me={me} speaking={voice.speaking} />

      {/* áudio dos outros participantes */}
      {Object.entries(voice.remoteAudio).map(([id, stream]) => (
        <RemoteAudio key={id} stream={stream} muted={voice.deafened} />
      ))}
    </div>
  );
}

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline muted={muted} className="hidden" />;
}
