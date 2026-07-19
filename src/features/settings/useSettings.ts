// ============================================================
// useSettings — фото-менеджер полароїда + розміри (порт даних
// modules/settings.js)
// ------------------------------------------------------------
// Фото: HEIC-normalize + compress → Storage-бакет family_photos
// (той самий бакет і фільтр розширень, що й usePhotoPool на
// головній). Список тут ділить префікс ключа з qk.photos(), тож
// invalidateQueries({ queryKey: qk.photos() }) скидає і повний
// менеджер-список, і пул для полароїд-хмарки одночасно.
//
// Розміри: user_sizes, один рядок на user_id (upsert onConflict).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import type { InsertRow, UserSizesRow } from '@/types';

const PHOTO_BUCKET = 'family_photos';

export interface ManagedPhoto {
  name: string;
  url: string;
}

/** Повний список фото полароїда (з іменами файлів — потрібні для видалення). */
export function usePhotoManager() {
  return useQuery({
    queryKey: [...qk.photos(), 'manager'],
    queryFn: async (): Promise<ManagedPhoto[]> => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data ?? [])
        .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name))
        .map((f) => ({ name: f.name, url: publicUrl(PHOTO_BUCKET, f.name) }));
    },
  });
}

export function usePhotoMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.photos() });

  /** HEIC → normalize, потім compress (з фолбеком на оригінал, якщо стиснення впало). */
  const upload = useMutation({
    mutationFn: async (file: File): Promise<void> => {
      const normalized = await normalize(file);
      let blob: Blob = normalized;
      let ext = (normalized.name.split('.').pop() || 'jpg').toLowerCase();
      let contentType = normalized.type;
      try {
        const out = await compress(normalized, 1280, 0.78);
        blob = out.blob;
        ext = out.ext;
        contentType = out.contentType;
      } catch (e) {
        console.warn('usePhotoMutations upload: стиснення не вдалося, ллю оригінал', e);
      }
      const name = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(name, blob, { upsert: false, contentType });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => {
      console.error('usePhotoMutations upload:', e);
      toast.show('Не вдалося завантажити фото');
    },
  });

  const remove = useMutation({
    mutationFn: async (name: string): Promise<void> => {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([name]);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалося видалити фото'),
  });

  return { upload, remove };
}

// ── Розміри (user_sizes) ─────────────────────────────────────

export function useUserSizes(userId: number) {
  return useQuery({
    queryKey: qk.userSizes(userId),
    queryFn: async (): Promise<UserSizesRow | null> => {
      const { data, error } = await supabase
        .from('user_sizes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveSizes() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (patch: InsertRow<'user_sizes'>): Promise<void> => {
      const { error } = await supabase.from('user_sizes').upsert(patch, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: (_data, patch) =>
      void client.invalidateQueries({ queryKey: qk.userSizes(patch.user_id) }),
    onError: () => toast.show('Не вдалося зберегти розміри'),
  });
}
