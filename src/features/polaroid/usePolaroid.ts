// ============================================================
// Полароїд — фото, що висять на острові кристала.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ, А НЕ ЧАСТИНА «СПОГАДІВ». Екран у них тепер
// один, але сховище й призначення різні, і плутати їх дорого:
//
//   СПОГАД — складена річ: назва, дата, точність дати, місце, підпис,
//   альбом. Лежить у таблиці `memories` + бакет `photo-calendar`.
//
//   ПОЛАРОЇД — просто фото, кинуте без церемонії. Лежить КОРЕНЕМ бакета
//   `family_photos`, без жодного рядка в базі, і дату йому дає сам
//   Storage (`created_at`).
//
// Друге і є причиною окремості: `usePhotoPool` (`home/useHome.ts`) читає
// саме той корінь, і його дата — єдине, що дозволяє рушію пускати фото у
// форму кристала (недатований факт зрушив би вже відкладену масу й зламав
// append-only — див. `artifact/species/crystalConstraints.ts`).
//
// Хуки тут — та сама пара, що жила в `settings/useSettings.ts` до
// ADR-0180: менеджер прибрали з налаштувань на прохання власника, і разом
// із ним пішла ЄДИНА дорога в бакет. Тепер вона у «Спогадах» (ADR-0181) —
// тобто там, де пара і так тримає свої фото.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import { randomToken } from '@/lib/entropy';

export const POLAROID_BUCKET = 'family_photos';

/** Фото полароїда з ІМЕНЕМ ФАЙЛА: без нього його нічим видалити. */
export interface PolaroidPhoto {
  name: string;
  url: string;
}

/**
 * Повний список фото полароїда.
 *
 * Ключ ділить префікс із `qk.photos()`, тож одне
 * `invalidateQueries({ queryKey: qk.photos() })` скидає і цей список, і
 * пул, з якого кристал бере грань «Фотографії».
 */
export function usePolaroidPhotos() {
  return useQuery({
    queryKey: [...qk.photos(), 'manager'],
    queryFn: async (): Promise<PolaroidPhoto[]> => {
      const { data, error } = await supabase.storage
        .from(POLAROID_BUCKET)
        .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      /*
       * Фільтр за розширенням — він же й межа з профілем: портрети лежать
       * у ПАПЦІ `profile/`, а папка приходить у цей листинг одним записом
       * без розширення й відсівається тут (ADR-0180 §5).
       */
      return (data ?? [])
        .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name))
        .map((f) => ({ name: f.name, url: publicUrl(POLAROID_BUCKET, f.name) }));
    },
  });
}

export function usePolaroidMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.photos() });

  /** HEIC → normalize, потім compress (із фолбеком на оригінал). */
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
        console.warn('usePolaroidMutations upload: стиснення не вдалося, ллю оригінал', e);
      }
      /*
       * Випадковий хвіст в імені — не косметика: дві фотографії, вибрані
       * в одну мілісекунду (а мультизавантаження робить саме це), інакше
       * дістали б однакове ім'я, і друга затерла б першу. Причина кидка
       * названа в `lib/entropy.ts`.
       */
      const name = `photo_${Date.now()}_${randomToken()}.${ext}`;
      const { error } = await supabase.storage
        .from(POLAROID_BUCKET)
        .upload(name, blob, { upsert: false, contentType });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => {
      console.error('usePolaroidMutations upload:', e);
      toast.show('Не вдалося завантажити фото');
    },
  });

  const remove = useMutation({
    mutationFn: async (name: string): Promise<void> => {
      const { error } = await supabase.storage.from(POLAROID_BUCKET).remove([name]);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалося видалити фото'),
  });

  return { upload, remove };
}
