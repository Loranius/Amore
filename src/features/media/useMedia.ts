// ============================================================
// useMedia — дані вкладки «Вотчліст» (порт media.js даних)
// ------------------------------------------------------------
// Запит media_items за типом + мутації. Постер: HEIC-normalize +
// compress → Storage. Відгук (rating/comment Діми/Лєни) пишеться
// типобезпечно через явну гілку who → колонка (без рядкових ключів).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { MediaItemRow, MediaType, MediaStatus, InsertRow, TmdbSearchResult } from '@/types';

const BUCKET = 'media-posters';

async function loadItems(type: MediaType): Promise<MediaItemRow[]> {
  const { data, error } = await supabase
    .from('media_items')
    .select(
      'id,type,title,status,poster_url,rating_dima,rating_lena,comment_dima,comment_lena,created_by',
    )
    .eq('type', type);
  if (error) throw error;
  return data ?? [];
}

export function useMediaItems(type: MediaType) {
  return useQuery({ queryKey: qk.media(type), queryFn: () => loadItems(type) });
}

/** Постер: HEIC → JPEG → compress → Storage. Повертає public URL або null. */
export async function uploadPoster(file: File, type: MediaType, itemId: number): Promise<string | null> {
  let normalized: File;
  try {
    normalized = await normalize(file);
  } catch (e) {
    console.error('uploadPoster HEIC error:', e);
    return null;
  }
  let blob: Blob = normalized;
  let ext = (normalized.name.split('.').pop() || 'jpg').toLowerCase();
  let contentType = normalized.type;
  try {
    const out = await compress(normalized, 900, 0.78);
    blob = out.blob;
    ext = out.ext;
    contentType = out.contentType;
  } catch (e) {
    console.warn('uploadPoster compress error:', e);
  }
  const path = `${type}-${itemId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
  });
  if (error) {
    console.error('uploadPoster error:', error);
    return null;
  }
  return publicUrl(BUCKET, path);
}

export type ReviewWho = 'dima' | 'lena';

export function useMediaMutations(type: MediaType) {
  const client = useQueryClient();
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.media(type) });

  // Додати вручну (+ опційний постер, який вантажиться після отримання id).
  const add = useMutation({
    mutationFn: async (v: { title: string; status: MediaStatus; file?: File }) => {
      const { data, error } = await supabase
        .from('media_items')
        .insert({ type, title: v.title, status: v.status, created_by: user.id })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('insert failed');
      if (v.file) {
        const url = await uploadPoster(v.file, type, data.id);
        if (url) await supabase.from('media_items').update({ poster_url: url }).eq('id', data.id);
      }
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось зберегти'),
  });

  // Додати з результату TMDB-пошуку (постер уже є).
  const addFromSearch = useMutation({
    mutationFn: async (v: { item: TmdbSearchResult; status: MediaStatus }) => {
      const row: InsertRow<'media_items'> = {
        type,
        title: v.item.title,
        status: v.status,
        poster_url: v.item.poster_url,
        created_by: user.id,
      };
      const { error } = await supabase.from('media_items').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка додавання'),
  });

  // Відгук: рейтинг + коментар обраного автора (типобезпечно, без рядкових ключів).
  const saveReview = useMutation({
    mutationFn: async (v: {
      id: number;
      who: ReviewWho;
      rating: number | null;
      comment: string | null;
    }) => {
      const patch =
        v.who === 'dima'
          ? { rating_dima: v.rating, comment_dima: v.comment }
          : { rating_lena: v.rating, comment_lena: v.comment };
      const { error } = await supabase.from('media_items').update(patch).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка збереження'),
  });

  // Редагувати назву/статус (+ опційна заміна постера).
  const edit = useMutation({
    mutationFn: async (v: { id: number; title: string; status: MediaStatus; file?: File }) => {
      const patch: { title: string; status: MediaStatus; poster_url?: string } = {
        title: v.title,
        status: v.status,
      };
      if (v.file) {
        const url = await uploadPoster(v.file, type, v.id);
        if (url) patch.poster_url = url;
      }
      const { error } = await supabase.from('media_items').update(patch).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка збереження'),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('media_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка видалення'),
  });

  return { add, addFromSearch, saveReview, edit, remove };
}
