'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseAtivo } from '@/lib/supabase';
import { isImageFile } from '@/lib/imageCompress';
import { Avatar } from './Avatar';

type Props = {
  name: string;
  color: string;
  avatarUrl: string | null;
  carregando: boolean;
  erro: string | null;
  onPickPhoto: (file: Blob) => Promise<void>;
  onRemovePhoto: () => Promise<void>;
  onClose: () => void;
};

export function ProfileModal({
  name,
  color,
  avatarUrl,
  carregando,
  erro,
  onPickPhoto,
  onRemovePhoto,
  onClose,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const escolher = async (file: Blob) => {
    setEnviando(true);
    await onPickPhoto(file);
    setEnviando(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-ink-500 shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-400 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Seu perfil</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-mute transition hover:bg-ink-400 hover:text-white"
          >
            <span aria-hidden>&times;</span>
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        <div className="px-6 py-6 text-center">
          <div className="mb-4 flex justify-center">
            <Avatar user={{ name, color, avatarUrl }} size={96} />
          </div>
          <div className="mb-5 text-base font-semibold text-white">{name}</div>

          {!supabaseAtivo ? (
            <p className="rounded bg-ink-600/60 px-3 py-3 text-xs leading-relaxed text-mute">
              A foto de perfil precisa das chaves do Supabase configuradas no servidor. Sem elas o
              app funciona normalmente, só com o avatar de letra.
            </p>
          ) : (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = [...e.dataTransfer.files].find(isImageFile);
                  if (f) void escolher(f);
                }}
                className="rounded-lg border border-dashed border-ink-200 p-4"
              >
                <button
                  onClick={() => input.current?.click()}
                  disabled={enviando || carregando}
                  className="w-full rounded-lg bg-blurple py-2.5 text-sm font-semibold text-white transition hover:bg-blurple-dark disabled:opacity-50"
                >
                  {enviando ? 'Enviando...' : avatarUrl ? 'Trocar foto' : 'Escolher foto'}
                </button>
                <p className="mt-2 text-[11px] text-mute">ou arraste uma imagem aqui</p>
                <input
                  ref={input}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void escolher(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {avatarUrl && (
                <button
                  onClick={() => void onRemovePhoto()}
                  className="mt-3 text-xs text-mute underline transition hover:text-danger"
                >
                  remover foto
                </button>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-mute">
                A foto fica salva na nuvem e volta sempre que você entrar neste navegador.
              </p>
            </>
          )}

          {erro && (
            <p className="mt-3 rounded bg-danger/15 px-3 py-2 text-xs text-danger">{erro}</p>
          )}
        </div>
      </div>
    </div>
  );
}
