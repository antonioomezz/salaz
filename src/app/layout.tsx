import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Negoneycord',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Negoneycord', statusBarStyle: 'black-translucent' },
  description: 'Salas de voz, câmera, chat e compartilhamento de tela com os amigos.',
};

export const viewport: Viewport = {
  themeColor: '#1e1f22',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
