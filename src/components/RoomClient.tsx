'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useVoice } from '@/hooks/useVoice';
import { migrarChavesAntigas, saveName, useStoredName } from '@/lib/useStoredName';

migrarChavesAntigas();
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
import { useProfile } from '@/hooks/useProfile';
import { Wordmark } from './Brand';
import { ProfileModal } from './ProfileModal';
import { Chat } from './Chat';
import { MemberList } from './MemberList';
import { SettingsModal } from './SettingsModal';
import { Sidebar, type VoiceControls } from './Sidebar';
import { CallPanel } from './CallPanel';
import { MusicPlayer } from './MusicPlayer';
import { RemoteAudio } from './RemoteAudio';
import { Stage, type Tile } from './Stage';
import { VersionBadge } from './VersionBadge';
import { Hash, Speaker, Users } from './icons';

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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-900 p-4">
      <div className="pop-in relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark />
        </div>
        <div className="rounded-2xl border border-white/8 bg-ink-700 p-7 text-center">
          <h1 className="text-lg font-bold text-white">Entrar na sala {roomId}</h1>
          <p className="mt-1 mb-5 text-sm text-mute">Como você quer aparecer para a galera?</p>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 24))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Seu nome"
            aria-label="Seu nome"
            className="mb-4 w-full rounded-lg bg-ink-900 px-3.5 py-3 text-center text-bright outline-none ring-blurple transition placeholder:text-ink-200 focus:ring-2"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="primary-button w-full rounded-lg py-3 text-sm font-semibold"
          >
            Entrar
          </button>
        </div>
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
  const [profileOpen, setProfileOpen] = useState(false);
  // abaixo de 1024px a lista de membros some; este botão a traz de volta
  const [listaAberta, setListaAberta] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const channelTrigger = useRef<HTMLButtonElement>(null);
  const [player, setPlayer] = useState<PlayerState>(EMPTY_PLAYER);
  /** relógio nosso menos o do servidor, para alinhar a posição da música */
  const [clockOffset, setClockOffset] = useState(0);
  const [musicVolume, setMusicVolume] = useState(60);

  useEffect(() => {
    if (!channelsOpen && !listaAberta) return;
    const mobileDrawer = channelsOpen && window.matchMedia('(max-width: 767px)').matches;
    if (mobileDrawer) drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChannelsOpen(false);
        setListaAberta(false);
        if (mobileDrawer) channelTrigger.current?.focus();
      }
      if (event.key !== 'Tab' || !mobileDrawer) return;
      const controls = drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [channelsOpen, listaAberta]);

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

  // -------------------------------------------------------------- perfil
  const perfil = useProfile(name);

  // avisa a sala assim que a foto chega ou muda
  const avatarEnviado = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (perfil.carregando) return;
    if (avatarEnviado.current === perfil.avatarUrl) return;
    avatarEnviado.current = perfil.avatarUrl;
    if (connected) getSocket().emit('state', { avatarUrl: perfil.avatarUrl });
  }, [perfil.avatarUrl, perfil.carregando, connected]);

  // meu canal de voz vem do servidor: evita divergência entre os clientes
  const myVoiceChannel = users.find((u) => u.id === myId)?.voiceChannel ?? null;

  const peerKey = users
    .filter((u) => u.id !== myId && u.voiceChannel && u.voiceChannel === myVoiceChannel)
    .map((u) => u.id)
    .sort()
    .join(',');
  const peerIds = useMemo(() => (peerKey ? peerKey.split(',') : []), [peerKey]);

  const voice = useVoice({ myId, peerIds, settings });

  // o join acontece dentro de um efeito que não deve depender do perfil
  const perfilRef = useRef<string | null>(null);
  useEffect(() => {
    perfilRef.current = perfil.avatarUrl;
  });

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
      s.emit('join', { roomId, name, avatarUrl: perfilRef.current }, (ack: JoinAck) => {
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

  /**
   * Separa câmera de tela pelos ids que cada pessoa anuncia. O track remoto não
   * diz de onde veio, então sem esses ids as duas se confundiriam.
   */
  const tiles: Tile[] = users
    .filter((u) => u.voiceChannel === myVoiceChannel && myVoiceChannel !== null)
    .flatMap((u) => {
      const souEu = u.id === myId;
      const audio = getUserAudio(userAudio, u.name);
      const videos = voice.remoteStreams[u.id]?.videos ?? [];
      const base = { user: u, isLocal: souEu, userVolume: audio.volume, userMuted: audio.muted };
      const out: Tile[] = [];

      const tela = souEu
        ? voice.localScreen
        : (videos.find((v) => v.id === u.screenStreamId) ??
          // reserva: só há um vídeo e a pessoa não está com câmera ligada
          (u.sharing && !u.camOn ? videos[0] : undefined));
      // a live tem volume próprio: quem transmite a tela inteira com som acaba
      // repetindo o áudio da chamada, e isso precisa ser abaixável sozinho
      if (u.sharing && tela) {
        out.push({ ...base, stream: tela, kind: 'screen', userVolume: audio.screenVolume });
      }

      const cam = souEu
        ? voice.localCam
        : (videos.find((v) => v.id === u.camStreamId) ??
          (u.camOn && !u.sharing ? videos[0] : undefined));
      if (u.camOn && cam) out.push({ ...base, stream: cam, kind: 'cam' });

      return out;
    });

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

  const voiceControls: VoiceControls = {
    inVoice: voice.inVoice,
    voiceChannel: voice.voiceChannel,
    micOn: voice.micOn,
    micLive: voice.micLive,
    deafened: voice.deafened,
    connecting: voice.connecting,
    screenStarting: voice.screenStarting,
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
    camOn: !!voice.localCam,
    toggleCam: () => {
      playSfx(voice.localCam ? 'shareStop' : 'shareStart');
      voice.toggleCam();
    },
    stopScreen: () => {
      playSfx('shareStop');
      voice.stopScreen();
    },
    isSharing: !!voice.localScreen,
  };

  return (
    <div className="room-shell flex h-dvh overflow-hidden bg-ink-500">
      {channelsOpen && <button className="fixed inset-0 z-40 bg-black/55 md:hidden" aria-label="Fechar canais" onClick={() => { setChannelsOpen(false); channelTrigger.current?.focus(); }} />}
      {listaAberta && <button className="fixed inset-0 z-30 bg-black/35 lg:hidden" aria-label="Fechar lista de pessoas" onClick={() => setListaAberta(false)} />}
      <div ref={drawer} id="channel-navigation" className="sidebar-drawer h-full shrink-0" data-open={channelsOpen}>
      <Sidebar
        roomId={roomId}
        connected={connected}
        onClose={() => { setChannelsOpen(false); channelTrigger.current?.focus(); }}
        channels={channels}
        users={users}
        me={me}
        speaking={voice.speaking}
        activeChannel={active}
        onSelectChannel={(id) => { setActive(id); setChannelsOpen(false); }}
        onCreateChannel={createChannel}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        userAudio={userAudio}
        onUserAudioChange={alterarVolumeDe}
        voice={voiceControls}
      />

      </div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/6 bg-ink-500 px-4 sm:px-6">
          <button ref={channelTrigger} onClick={() => { setChannelsOpen(true); setListaAberta(false); }} aria-label="Abrir canais" aria-controls="channel-navigation" aria-expanded={channelsOpen} className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mute hover:bg-ink-400 md:hidden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          {activeChannel?.type === 'voice' ? (
            <Speaker className="h-5 w-5 text-mute" />
          ) : (
            <Hash className="h-5 w-5 text-mute" />
          )}
          <span className="truncate text-sm font-semibold text-white">{activeChannel?.name ?? '...'}</span>
          <span className="ml-3 hidden border-l border-ink-400 pl-3 text-[13px] text-mute sm:block">
            {users.length} {users.length === 1 ? 'pessoa' : 'pessoas'} na sala
          </span>
          {!connected && (
            <span className="rounded bg-danger/20 px-2 py-1 text-xs text-danger">
              reconectando...
            </span>
          )}
          <button
            onClick={() => { setListaAberta((v) => !v); setChannelsOpen(false); }}
            aria-label="Mostrar ou esconder pessoas"
            aria-expanded={listaAberta}
            title="Mostrar ou esconder a lista de pessoas"
            className={`ml-auto rounded p-1.5 transition hover:bg-ink-400 lg:hidden ${
              listaAberta ? 'text-white' : 'text-mute'
            }`}
          >
            <Users />
          </button>
        </header>

        <CallPanel voice={voiceControls} users={users} channels={channels} speaking={voice.speaking} connected={connected} onOpenSettings={() => setSettingsOpen(true)} />

        {voice.error && (
          <div role="alert" className="flex items-center gap-3 border-b border-danger/40 bg-danger/15 px-4 py-2 text-sm text-danger">
            <span className="flex-1">{voice.error}</span>
            <button onClick={voice.clearError} className="shrink-0 text-xs underline">
              ok
            </button>
          </div>
        )}

        {voice.screenAudioInfo && (
          <div className="flex items-center gap-3 border-b border-blurple/40 bg-blurple/15 px-4 py-2 text-sm text-soft">
            <span className="flex-1">{voice.screenAudioInfo}</span>
            <button
              onClick={voice.dismissScreenAudioInfo}
              className="shrink-0 text-xs underline"
            >
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
          tiles={tiles}
          screenStats={voice.localScreen ? voice.screenStats : null}
          volume={settings.outputVolume}
          deafened={voice.deafened}
          outputDeviceId={settings.outputDeviceId}
          onToggleScreenMute={(userName) => {
            const atual = getUserAudio(userAudio, userName);
            alterarVolumeDe(userName, { screenVolume: atual.screenVolume === 0 ? 100 : 0 });
          }}
        />

        <Chat key={active} channel={activeChannel} messages={messages[active] ?? []} onSend={send} connected={connected} />
      </main>

      <div className="member-drawer shrink-0" data-open={listaAberta}>
      <MemberList
        users={users}
        me={me}
        speaking={voice.speaking}
        userAudio={userAudio}
        onUserAudioChange={alterarVolumeDe}
        botTocando={player.current ? player.current.title : null}
        visivel={listaAberta}
      />
      </div>

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

      {profileOpen && (
        <ProfileModal
          name={name}
          color={me?.color ?? '#5865f2'}
          avatarUrl={perfil.avatarUrl}
          carregando={perfil.carregando}
          erro={perfil.erro}
          onPickPhoto={perfil.salvarFoto}
          onRemovePhoto={perfil.removerFoto}
          onClose={() => setProfileOpen(false)}
        />
      )}

      <VersionBadge />

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
