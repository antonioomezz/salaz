'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { CURRENT_VERSION, RELEASES } from '@/lib/changelog';
import { Logo } from './Brand';
import { Download } from './icons';

/**
 * Selo de versão no canto inferior direito. Além do histórico, serve para
 * saber num relance se o navegador já carregou a versão nova depois de um
 * deploy — sem precisar abrir log nenhum.
 */
/** Evento do Chrome que permite oferecer a instalação na hora que quisermos. */
type PromptDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function VersionBadge() {
  const [aberto, setAberto] = useState(false);
  const [instalar, setInstalar] = useState<PromptDeInstalacao | null>(null);
  const [instaladoAgora, setInstaladoAgora] = useState(false);

  // já está rodando como app instalado? lido direto, sem setState em efeito
  const standalone = useSyncExternalStore(
    (aviso) => {
      const mq = window.matchMedia?.('(display-mode: standalone)');
      mq?.addEventListener('change', aviso);
      return () => mq?.removeEventListener('change', aviso);
    },
    () =>
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false
  );

  const instalado = standalone || instaladoAgora;

  useEffect(() => {
    const guardar = (e: Event) => {
      // sem isto o Chrome mostra o próprio aviso, fora do lugar que queremos
      e.preventDefault();
      setInstalar(e as PromptDeInstalacao);
    };
    const aoInstalar = () => {
      setInstaladoAgora(true);
      setInstalar(null);
    };
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="fixed right-3 bottom-3 z-40 flex items-center gap-1.5 opacity-60 transition hover:opacity-100">
        {instalar && !instalado && (
          <button
            onClick={async () => {
              await instalar.prompt();
              const { outcome } = await instalar.userChoice;
              if (outcome === 'accepted') setInstaladoAgora(true);
              setInstalar(null);
            }}
            title="Instalar o Negoneycord como aplicativo, com ícone próprio"
            className="flex items-center gap-1.5 rounded-full bg-blurple px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg shadow-blurple/25 transition hover:bg-blurple-dark"
          >
            <Download className="h-3 w-3" />
            Instalar
          </button>
        )}
        <button
          onClick={() => setAberto(true)}
          title="Ver o que mudou em cada versão"
          className="rounded-full bg-ink-800/80 px-2.5 py-1 font-mono text-[10px] text-mute backdrop-blur transition hover:text-bright"
        >
          v{CURRENT_VERSION}
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-ink-500 shadow-2xl ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-ink-400 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blurple text-white">
                  <Logo className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">O que mudou</h2>
                  <p className="font-mono text-[11px] text-mute">
                    você está na v{CURRENT_VERSION}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="rounded px-2 py-1 text-mute transition hover:bg-ink-400 hover:text-white"
              >
                <span aria-hidden>&times;</span>
                <span className="sr-only">Fechar</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {RELEASES.map((release, i) => (
                <section key={release.version}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                        i === 0 ? 'bg-blurple text-white' : 'bg-ink-400 text-soft'
                      }`}
                    >
                      v{release.version}
                    </span>
                    <span className="text-sm font-semibold text-bright">{release.headline}</span>
                    <span className="ml-auto text-[11px] text-mute">{release.date}</span>
                  </div>
                  <ul className="space-y-1 pl-1">
                    {release.changes.map((change) => (
                      <li key={change} className="flex gap-2 text-[13px] leading-snug text-mute">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-200" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="shrink-0 border-t border-ink-400 px-6 py-3 text-center text-[11px] text-mute">
              {instalado
                ? 'Rodando como aplicativo instalado.'
                : 'Se o número aqui não mudou depois de um deploy, recarregue com Ctrl + Shift + R.'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
