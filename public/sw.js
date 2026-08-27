/*
 * Service worker mínimo: existe para o navegador aceitar instalar o app.
 * Não guarda nada em cache de propósito — a sala depende de estar online, e
 * cache antigo aqui só causaria confusão de versão.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
