export type ChannelType = 'text' | 'voice';

export type Channel = {
  id: string;
  name: string;
  type: ChannelType;
};

export type User = {
  id: string;
  name: string;
  color: string;
  voiceChannel: string | null;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
};

/** 'bot' e 'card' são mensagens geradas pelo servidor, não por uma pessoa. */
export type MessageKind = 'text' | 'image' | 'bot' | 'card';

export type MessageImage = {
  /** data URL; vive só na memória do servidor, nunca em disco */
  dataUrl: string | null;
  w: number;
  h: number;
};

export type MessageCard = {
  source: 'youtube' | 'spotify';
  title: string;
  subtitle?: string;
  thumb?: string;
  url: string;
};

export type Message = {
  id: string;
  channelId: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  ts: number;
  kind?: MessageKind;
  image?: MessageImage;
  card?: MessageCard;
};

export type JoinAck = {
  roomId: string;
  you: User;
  users: User[];
  channels: Channel[];
  messages: Record<string, Message[]>;
  player?: PlayerState;
};

export type Track = {
  id: string;
  videoId: string;
  title: string;
  author: string;
  thumb: string;
  addedBy: string;
  url: string;
};

export type PlayerState = {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  positionMs: number;
  /** relógio do SERVIDOR; o cliente corrige com o offset */
  updatedAt: number;
  serverNow: number;
};

export const EMPTY_PLAYER: PlayerState = {
  current: null,
  queue: [],
  playing: false,
  positionMs: 0,
  updatedAt: 0,
  serverNow: 0,
};
