'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { garantirSessao, getSupabase, supabaseAtivo } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';

export type Profile = {
  userId: string | null;
  avatarUrl: string | null;
  /** true enquanto ainda não sabemos se existe perfil salvo */
  carregando: boolean;
  erro: string | null;
};

/** Avatar aparece com 32-40px na tela; 160px cobre telas de alta densidade. */
const LADO_AVATAR = 160;

/**
 * Perfil na nuvem: só nome e foto. Degrada em silêncio — sem Supabase
 * configurado, devolve tudo vazio e o app usa o avatar de letra.
 */
export function useProfile(nome: string) {
  const [profile, setProfile] = useState<Profile>({
    userId: null,
    avatarUrl: null,
    carregando: supabaseAtivo,
    erro: null,
  });
  const nomeRef = useRef(nome);
  useEffect(() => {
    nomeRef.current = nome;
  });

  // entra (anonimamente) e busca o perfil salvo
  useEffect(() => {
    if (!supabaseAtivo) return;
    let vivo = true;

    void (async () => {
      const { userId, erro } = await garantirSessao();
      if (!vivo) return;
      if (!userId) {
        setProfile({ userId: null, avatarUrl: null, carregando: false, erro });
        return;
      }

      const sb = getSupabase()!;
      const { data } = await sb
        .from('ng_profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (!vivo) return;
      setProfile({
        userId,
        avatarUrl: data?.avatar_url ?? null,
        carregando: false,
        erro: null,
      });
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const salvarFoto = useCallback(
    async (file: Blob) => {
      const sb = getSupabase();
      if (!sb) return;

      setProfile((p) => ({ ...p, erro: null }));
      try {
        let userId = profile.userId;
        if (!userId) {
          const sessao = await garantirSessao();
          userId = sessao.userId;
          if (!userId) {
            setProfile((p) => ({ ...p, erro: sessao.erro ?? 'Não consegui entrar para salvar a foto.' }));
            return;
          }
        }

        // comprime antes de subir: uma foto de celular tem vários MB e o
        // bucket aceita 256KB
        const { dataUrl } = await compressImage(file, { maxLado: LADO_AVATAR, alvoKB: 40 });
        const binario = await (await fetch(dataUrl)).blob();

        // nome novo a cada envio, senão o cache do navegador segura a antiga
        const caminho = `${userId}/${Date.now()}.webp`;
        const { error: erroUpload } = await sb.storage
          .from('ng-avatars')
          .upload(caminho, binario, { contentType: binario.type, upsert: true });
        if (erroUpload) throw erroUpload;

        const { data: pub } = sb.storage.from('ng-avatars').getPublicUrl(caminho);
        const avatarUrl = pub.publicUrl;

        const { error: erroPerfil } = await sb
          .from('ng_profiles')
          .upsert({ id: userId, name: nomeRef.current, avatar_url: avatarUrl, updated_at: new Date().toISOString() });
        if (erroPerfil) throw erroPerfil;

        setProfile({ userId, avatarUrl, carregando: false, erro: null });
      } catch (err) {
        setProfile((p) => ({
          ...p,
          erro: err instanceof Error ? err.message : 'Não consegui salvar a foto.',
        }));
      }
    },
    [profile.userId]
  );

  const removerFoto = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !profile.userId) return;
    try {
      await sb
        .from('ng_profiles')
        .upsert({ id: profile.userId, name: nomeRef.current, avatar_url: null, updated_at: new Date().toISOString() });
      setProfile((p) => ({ ...p, avatarUrl: null }));
    } catch {
      /* segue com a foto atual */
    }
  }, [profile.userId]);

  return { ...profile, salvarFoto, removerFoto };
}
