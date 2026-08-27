/*
 * Service worker mínimo.
 *
 * O handler de 'fetch' precisa existir: o Chrome só considera o site
 * instalável se houver um, mesmo que ele não faça nada além de repassar o
 * pedido. Sem isso o evento beforeinstallprompt nunca dispara e o botão
 * "Instalar" não aparece.
 *
 * De propósito não guardamos nada em cache: a sala depende de estar online,
 * e cache aqui só criaria confusão de versão depois de um deploy.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
