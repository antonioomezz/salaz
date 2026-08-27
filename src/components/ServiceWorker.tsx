'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker. Ele não faz cache — existe só para o navegador
 * considerar o Negoneycord instalável e mostrar o botão "Instalar".
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sem service worker o app funciona igual, só não instala */
    });
  }, []);
  return null;
}
