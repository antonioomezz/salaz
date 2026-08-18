import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // StrictMode monta os componentes duas vezes em dev, o que faria as
  // RTCPeerConnection serem criadas em duplicidade. Desligado de propósito.
  reactStrictMode: false,
};

export default nextConfig;
