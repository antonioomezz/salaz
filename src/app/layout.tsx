import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salaz',
  description: 'Salas de voz, chat e compartilhamento de tela com os amigos.',
};

export const viewport: Viewport = {
  themeColor: '#1e1f22',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
