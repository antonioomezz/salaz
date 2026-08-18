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

export type Message = {
  id: string;
  channelId: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  ts: number;
};

export type JoinAck = {
  roomId: string;
  you: User;
  users: User[];
  channels: Channel[];
  messages: Record<string, Message[]>;
};
