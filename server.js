// Servidor único: Next.js + Socket.IO no mesmo processo/porta.
// Estado das salas fica em memória (sem banco, sem Redis) — MVP.
const prod = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
process.env.NODE_ENV = prod ? 'production' : 'development';

const { createServer } = require('http');
const crypto = require('crypto');
const next = require('next');
const { Server } = require('socket.io');

const port = parseInt(process.env.PORT || '3800', 10);
const hostname = process.env.HOST || '0.0.0.0';

const app = next({ dev: !prod });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------- estado
/** @type {Map<string, Room>} */
const rooms = new Map();

const COLORS = ['#5865f2', '#23a55a', '#e67e22', '#eb459e', '#3ba55d', '#f0b132', '#ed4245', '#00a8fc'];

function id(len = 6) {
  const alpha = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const b of crypto.randomBytes(len)) out += alpha[b % alpha.length];
  return out;
}

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      users: new Map(),
      channels: [
        { id: 'geral', name: 'geral', type: 'text' },
        { id: 'conversa', name: 'conversa', type: 'text' },
        { id: 'voz-geral', name: 'Geral', type: 'voice' },
      ],
      messages: { geral: [], conversa: [] },
      emptySince: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

const usersOf = (room) => [...room.users.values()];

function broadcastUsers(io, room) {
  io.to(room.id).emit('users', usersOf(room));
}

// limpa salas vazias há mais de 2h
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, room] of rooms) {
    if (room.users.size === 0 && room.emptySince < cutoff) rooms.delete(key);
  }
}, 15 * 60 * 1000);

// ---------------------------------------------------------------- boot
app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e6 });

  io.on('connection', (socket) => {
    /** @type {string|null} */ let roomId = null;

    const me = () => (roomId ? rooms.get(roomId)?.users.get(socket.id) : null);

    socket.on('join', ({ roomId: rid, name } = {}, ack) => {
      if (typeof rid !== 'string' || !rid.trim()) return;
      roomId = rid.trim().slice(0, 32);
      const room = getRoom(roomId);
      const user = {
        id: socket.id,
        name: String(name || 'Anônimo').trim().slice(0, 24) || 'Anônimo',
        color: COLORS[room.users.size % COLORS.length],
        voiceChannel: null,
        muted: false,
        deafened: false,
        sharing: false,
      };
      room.users.set(socket.id, user);
      socket.join(roomId);
      if (typeof ack === 'function') {
        ack({ roomId, you: user, users: usersOf(room), channels: room.channels, messages: room.messages });
      }
      broadcastUsers(io, room);
    });

    socket.on('message', ({ channelId, text } = {}) => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user || typeof text !== 'string') return;
      const clean = text.trim().slice(0, 2000);
      if (!clean) return;
      const msg = {
        id: id(10),
        channelId: String(channelId),
        userId: user.id,
        name: user.name,
        color: user.color,
        text: clean,
        ts: Date.now(),
      };
      const bucket = (room.messages[msg.channelId] ||= []);
      bucket.push(msg);
      if (bucket.length > 200) bucket.shift();
      io.to(room.id).emit('message', msg);
    });

    socket.on('channel:create', ({ name, type } = {}) => {
      const room = roomId && rooms.get(roomId);
      if (!room || room.channels.length >= 20) return;
      const clean = String(name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
      if (!clean) return;
      const channel = { id: `${type === 'voice' ? 'voz' : 'txt'}-${id(4)}`, name: clean, type: type === 'voice' ? 'voice' : 'text' };
      room.channels.push(channel);
      if (channel.type === 'text') room.messages[channel.id] = [];
      io.to(room.id).emit('channels', room.channels);
    });

    socket.on('voice:join', ({ channelId } = {}) => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user) return;
      user.voiceChannel = String(channelId);
      broadcastUsers(io, room);
    });

    socket.on('voice:leave', () => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user) return;
      user.voiceChannel = null;
      user.sharing = false;
      user.speaking = false;
      broadcastUsers(io, room);
    });

    socket.on('state', ({ muted, deafened, sharing } = {}) => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user) return;
      if (typeof muted === 'boolean') user.muted = muted;
      if (typeof deafened === 'boolean') user.deafened = deafened;
      if (typeof sharing === 'boolean') user.sharing = sharing;
      broadcastUsers(io, room);
    });

    // --- sinalização WebRTC: repassa cru para o destinatário ---
    socket.on('signal', ({ to, data } = {}) => {
      if (!to || !roomId) return;
      io.to(to).emit('signal', { from: socket.id, data });
    });

    socket.on('disconnect', () => {
      const room = roomId && rooms.get(roomId);
      if (!room) return;
      room.users.delete(socket.id);
      if (room.users.size === 0) room.emptySince = Date.now();
      broadcastUsers(io, room);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`\n  Salaz rodando em http://localhost:${port}  (${prod ? 'produção' : 'dev'})\n`);
  });
});
