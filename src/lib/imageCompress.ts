'use client';

const MAX_LADO = 1280;
/** alvo em bytes do binário (a data URL fica ~33% maior) */
const ALVO = 300 * 1024;
const TETO = 900 * 1024;

export type CompressedImage = { dataUrl: string; w: number; h: number };

/** Aproxima o tamanho em bytes do binário embutido numa data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Reduz e recomprime a imagem no navegador antes de mandar pro servidor.
 * Sem isso uma foto de celular (5-10MB) estouraria o limite do socket e a
 * memória da sala.
 */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);

  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // WebP comprime bem melhor; se o navegador não gerar, cai para JPEG
  const suportaWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  const tipo = suportaWebp ? 'image/webp' : 'image/jpeg';

  let qualidade = 0.82;
  let dataUrl = canvas.toDataURL(tipo, qualidade);
  while (dataUrlBytes(dataUrl) > ALVO && qualidade > 0.4) {
    qualidade -= 0.12;
    dataUrl = canvas.toDataURL(tipo, qualidade);
  }

  if (dataUrlBytes(dataUrl) > TETO) {
    throw new Error('imagem grande demais mesmo depois de comprimir');
  }

  return { dataUrl, w, h };
}

export const isImageFile = (f: { type: string }) => f.type.startsWith('image/');
