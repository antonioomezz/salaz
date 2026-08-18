// Config de ICE isolada aqui: para adicionar um TURN depois, basta
// definir as variáveis NEXT_PUBLIC_TURN_* — nada mais muda no código.
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}
