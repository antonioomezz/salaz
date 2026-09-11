import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // StrictMode monta os componentes duas vezes em dev, o que faria as
  // RTCPeerConnection serem criadas em duplicidade. Desligado de propósito.
  reactStrictMode: false,
};

export default nextConfig;
