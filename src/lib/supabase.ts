'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase, usado só para o perfil (nome e foto).
 *
 * Tudo aqui é opcional de propósito: sem as variáveis de ambiente o app
 * funciona exatamente como antes, com avatar de letra. Nada de voz, vídeo ou
 * chat depende disto — essas partes continuam no servidor próprio.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const supabaseAtivo = Boolean(url && key);

let cliente: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseAtivo) return null;
  cliente ||= createClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'negoneycord:auth',
    },
  });
  return cliente;
}

/**
 * Garante uma sessão. Usa login anônimo: ninguém digita nada, mas existe um
 * usuário de verdade por trás, então as regras de segurança conseguem impedir
 * que alguém altere o perfil de outra pessoa.
 *
 * Quando virar app com login por e-mail, dá para vincular esta conta anônima
 * à conta real sem perder foto nem nome.
 */
export type Sessao = { userId: string | null; erro: string | null };

export async function garantirSessao(): Promise<Sessao> {
  const sb = getSupabase();
  if (!sb) return { userId: null, erro: null };
  try {
    const { data } = await sb.auth.getSession();
    if (data.session?.user) return { userId: data.session.user.id, erro: null };

    const { data: novo, error } = await sb.auth.signInAnonymously();
    if (error) {
      const desligado =
        error.message.toLowerCase().includes('anonymous') ||
        (error as { code?: string }).code === 'anonymous_provider_disabled';
      return {
        userId: null,
        erro: desligado
          ? 'Falta ligar "Anonymous sign-ins" no painel do Supabase, em Authentication → Sign In / Providers. Sem isso não dá para salvar a foto.'
          : `Não consegui entrar no Supabase: ${error.message}`,
      };
    }
    return { userId: novo.user?.id ?? null, erro: null };
  } catch (err) {
    return { userId: null, erro: err instanceof Error ? err.message : 'falha ao entrar' };
  }
}
