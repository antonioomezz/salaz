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

// no máximo 25 imagens por sala; passando disso, a mais antiga perde o binário.
// Segura o consumo de RAM no plano Free do Render.
const MAX_IMAGENS_POR_SALA = 25;
const MAX_BYTES_IMAGEM = 1.2 * 1024 * 1024;

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
      player: {
        queue: [],
        current: null,
        playing: false,
        positionMs: 0,
        updatedAt: Date.now(),
        lastAdvance: 0,
      },
      emptySince: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

const usersOf = (room) => [...room.users.values()];

/**
 * Mantém no máximo MAX_IMAGENS_POR_SALA binários vivos. As mensagens antigas
 * continuam no histórico, mas sem o dataUrl — o texto avisa o que houve.
 */
function podarImagens(room) {
  const comImagem = [];
  for (const bucket of Object.values(room.messages)) {
    for (const msg of bucket) if (msg.kind === 'image' && msg.image?.dataUrl) comImagem.push(msg);
  }
  if (comImagem.length <= MAX_IMAGENS_POR_SALA) return;

  comImagem.sort((a, b) => a.ts - b.ts);
  for (const msg of comImagem.slice(0, comImagem.length - MAX_IMAGENS_POR_SALA)) {
    msg.image.dataUrl = null;
    msg.text = 'imagem liberada da memória';
  }
}

function broadcastUsers(io, room) {
  io.to(room.id).emit('users', usersOf(room));
}

// ---------------------------------------------------------------- música
function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (!host.endsWith('youtube.com')) return null;
    if (u.pathname === '/watch') return u.searchParams.get('v');

    const partes = u.pathname.split('/').filter(Boolean);
    if (partes.length >= 2 && ['shorts', 'embed', 'live'].includes(partes[0])) return partes[1];
    return null;
  } catch {
    return null;
  }
}

const ehSpotify = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().endsWith('spotify.com');
  } catch {
    return false;
  }
};

/** oEmbed é público e não exige chave de API. */
async function oembed(endpoint, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&format=json`, {
      signal: controller.signal,
      headers: { 'user-agent': 'salaz/1.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function estadoDoPlayer(room) {
  const p = room.player;
  return {
    current: p.current,
    queue: p.queue,
    playing: p.playing,
    positionMs: p.positionMs,
    updatedAt: p.updatedAt,
    serverNow: Date.now(),
  };
}

function emitirPlayer(io, room) {
  io.to(room.id).emit('player:state', estadoDoPlayer(room));
}

/** Congela a posição atual antes de mudar qualquer coisa. */
function fixarPosicao(room) {
  const p = room.player;
  if (p.playing) p.positionMs += Date.now() - p.updatedAt;
  p.updatedAt = Date.now();
}

function falarBot(io, room, channelId, text, card) {
  const msg = {
    id: id(10),
    channelId: String(channelId),
    userId: 'bot',
    name: 'Salaz',
    color: '#5865f2',
    text,
    ts: Date.now(),
    kind: card ? 'card' : 'bot',
    ...(card ? { card } : {}),
  };
  const bucket = (room.messages[msg.channelId] ||= []);
  bucket.push(msg);
  if (bucket.length > 200) bucket.shift();
  io.to(room.id).emit('message', msg);
}

function tocarProxima(io, room, channelId) {
  const p = room.player;
  p.current = p.queue.shift() ?? null;
  p.positionMs = 0;
  p.updatedAt = Date.now();
  p.playing = !!p.current;
  emitirPlayer(io, room);
  if (p.current && channelId) falarBot(io, room, channelId, `Tocando agora: ${p.current.title}`);
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
  const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 2e6 });

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
        ack({
          roomId,
          you: user,
          users: usersOf(room),
          channels: room.channels,
          messages: room.messages,
          player: estadoDoPlayer(room),
        });
      }
      broadcastUsers(io, room);
    });

    socket.on('message', ({ channelId, text, image } = {}) => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user) return;

      let imagemValida = null;
      if (image && typeof image.dataUrl === 'string') {
        const ehImagem = ['png', 'jpeg', 'webp', 'gif'].some((t) =>
          image.dataUrl.startsWith('data:image/' + t + ';base64,')
        );
        const cabe = image.dataUrl.length <= MAX_BYTES_IMAGEM;
        if (!ehImagem || !cabe) return;
        imagemValida = {
          dataUrl: image.dataUrl,
          w: Number(image.w) || 0,
          h: Number(image.h) || 0,
        };
      }

      const clean = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
      if (!clean && !imagemValida) return;

      const msg = {
        id: id(10),
        channelId: String(channelId),
        userId: user.id,
        name: user.name,
        color: user.color,
        text: clean,
        ts: Date.now(),
        kind: imagemValida ? 'image' : 'text',
        ...(imagemValida ? { image: imagemValida } : {}),
      };
      const bucket = (room.messages[msg.channelId] ||= []);
      bucket.push(msg);
      if (bucket.length > 200) bucket.shift();
      podarImagens(room);
      io.to(room.id).emit('message', msg);
    });

    // ------------------------------------------------------------ música
    socket.on('music:command', async ({ channelId, text } = {}) => {
      const room = roomId && rooms.get(roomId);
      const user = me();
      if (!room || !user || typeof text !== 'string') return;

      const canal = String(channelId);
      const bruto = text.trim();
      const spotify = bruto.startsWith(';;');
      const corpo = bruto.slice(spotify ? 2 : 1).trim();
      const [comando, ...resto] = corpo.split(/\s+/);
      const arg = resto.join(' ').trim();
      const p = room.player;

      const ajuda = [
        ';play <link do YouTube> — toca ou põe na fila',
        ';pause  ;resume  ;skip  ;stop',
        ';queue — mostra a fila',
        ';;play <link do Spotify> — mostra a música (o Spotify não pode ser transmitido)',
      ].join('\n');

      if (comando === 'help' || !comando) return falarBot(io, room, canal, ajuda);

      if (comando === 'play') {
        if (!arg) return falarBot(io, room, canal, 'Faltou o link. Exemplo: ;play https://youtu.be/...');

        if (spotify || ehSpotify(arg)) {
          const info = await oembed('https://open.spotify.com/oembed', arg);
          if (!info) return falarBot(io, room, canal, 'Não consegui ler esse link do Spotify.');
          return falarBot(
            io,
            room,
            canal,
            `${user.name} compartilhou. O Spotify não permite transmitir áudio para fora do app dele — manda o link do YouTube que eu toco pra todo mundo.`,
            {
              source: 'spotify',
              title: info.title || 'Música no Spotify',
              subtitle: info.provider_name || 'Spotify',
              thumb: info.thumbnail_url,
              url: arg,
            }
          );
        }

        const videoId = youtubeId(arg);
        if (!videoId) return falarBot(io, room, canal, 'Não reconheci esse link do YouTube.');

        const info = await oembed('https://www.youtube.com/oembed', `https://www.youtube.com/watch?v=${videoId}`);
        const faixa = {
          id: id(8),
          videoId,
          title: info?.title || 'Vídeo do YouTube',
          author: info?.author_name || '',
          thumb: info?.thumbnail_url || '',
          addedBy: user.name,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };

        if (!p.current) {
          p.current = faixa;
          p.positionMs = 0;
          p.updatedAt = Date.now();
          p.playing = true;
          emitirPlayer(io, room);
          return falarBot(io, room, canal, `Tocando agora: ${faixa.title} (pedido por ${user.name})`);
        }

        if (p.queue.length >= 30) return falarBot(io, room, canal, 'A fila está cheia (30 músicas).');
        p.queue.push(faixa);
        emitirPlayer(io, room);
        return falarBot(io, room, canal, `Na fila (#${p.queue.length}): ${faixa.title}`);
      }

      if (comando === 'pause') {
        if (!p.current || !p.playing) return falarBot(io, room, canal, 'Não tem nada tocando.');
        fixarPosicao(room);
        p.playing = false;
        emitirPlayer(io, room);
        return falarBot(io, room, canal, `${user.name} pausou.`);
      }

      if (comando === 'resume') {
        if (!p.current || p.playing) return falarBot(io, room, canal, 'Já está tocando.');
        p.updatedAt = Date.now();
        p.playing = true;
        emitirPlayer(io, room);
        return falarBot(io, room, canal, `${user.name} despausou.`);
      }

      if (comando === 'skip') {
        if (!p.current) return falarBot(io, room, canal, 'Não tem nada tocando.');
        falarBot(io, room, canal, `${user.name} pulou ${p.current.title}.`);
        return tocarProxima(io, room, canal);
      }

      if (comando === 'stop') {
        p.current = null;
        p.queue = [];
        p.playing = false;
        p.positionMs = 0;
        p.updatedAt = Date.now();
        emitirPlayer(io, room);
        return falarBot(io, room, canal, `${user.name} parou a música e limpou a fila.`);
      }

      if (comando === 'queue') {
        if (!p.current) return falarBot(io, room, canal, 'A fila está vazia. Use ;play <link>.');
        const linhas = [`Tocando: ${p.current.title}`];
        p.queue.forEach((f, i) => linhas.push(`${i + 1}. ${f.title} — ${f.addedBy}`));
        return falarBot(io, room, canal, linhas.join('\n'));
      }

      return falarBot(io, room, canal, `Não conheço ";${comando}". Use ;help.`);
    });

    // o cliente avisa que o vídeo acabou; debounce evita várias abas avançarem juntas
    socket.on('music:ended', ({ videoId, channelId } = {}) => {
      const room = roomId && rooms.get(roomId);
      if (!room) return;
      const p = room.player;
      if (!p.current || p.current.videoId !== videoId) return;
      if (Date.now() - p.lastAdvance < 3000) return;
      p.lastAdvance = Date.now();
      tocarProxima(io, room, String(channelId || 'geral'));
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
