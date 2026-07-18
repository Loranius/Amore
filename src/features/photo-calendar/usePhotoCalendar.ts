// ============================================================
// usePhotoCalendar — фото дня (порт photo-calendar.js даних)
// ------------------------------------------------------------
// Місячний запит photo_calendar → мапа { 'YYYY-MM-DD': PhotoRow[] }.
// Аплоад: HEIC-normalize + compress → Storage (з прибиранням
// сиріт-варіантів іншого розширення) → insert/update рядка.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress } from '@/lib/images';
import { monthRange, monthKeyOf } from '@/features/_shared/month';
import { useToast } from '@/providers/ToastProvider';
import type { PhotoCalendarRow } from '@/types';

const BUCKET = 'photo-calendar';

/** date → фото обох користувачів. */
export type PhotosByDate = Record<string, PhotoCalendarRow[]>;

function groupByDate(rows: PhotoCalendarRow[]): PhotosByDate {
  const map: PhotosByDate = {};
  for (const p of rows) (map[p.date] ??= []).push(p);
  return map;
}

export function usePhotoCalendar(yr: number, mo: number) {
  return useQuery({
    queryKey: qk.photoCalendar(monthKeyOf(yr, mo)),
    queryFn: async (): Promise<PhotosByDate> => {
      const { from, to } = monthRange(yr, mo);
      const { data, error } = await supabase
        .from('photo_calendar')
        .select('id,date,user_id,photo_url,comment')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return groupByDate(data ?? []);
    },
  });
}

export function usePhotoCalendarMutations(yr: number, mo: number) {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () =>
    void client.invalidateQueries({ queryKey: qk.photoCalendar(monthKeyOf(yr, mo)) });

  // Завантаження/заміна фото дня.
  const upload = useMutation({
    mutationFn: async (v: {
      date: string;
      userId: number;
      file: File;
      comment: string | null;
      existingId?: number | undefined;
    }) => {
      let blob: Blob = v.file;
      let ext = 'jpg';
      let contentType = 'image/jpeg';
      try {
        const out = await compress(v.file, 1280, 0.82);
        blob = out.blob;
        ext = out.ext;
        contentType = out.contentType;
      } catch (e) {
        console.warn('[PhotoCalendar] стиснення не вдалося, оригінал:', e);
      }

      // Шлях: y/m/date_userId.ext. Розширення різне між браузерами (webp/jpg),
      // тож при заміні прибираємо старі варіанти, щоб не лишались сироти.
      const [y, m] = v.date.split('-');
      const basePath = `${y}/${m}/${v.date}_${v.userId}`;
      const path = `${basePath}.${ext}`;
      const stale = ['jpg', 'webp', 'jpeg', 'png']
        .map((e) => `${basePath}.${e}`)
        .filter((p) => p !== path);
      if (stale.length) {
        try {
          await supabase.storage.from(BUCKET).remove(stale);
        } catch (e) {
          console.warn('[PhotoCalendar] не вдалось прибрати старе фото:', e);
        }
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType });
      if (upErr) throw upErr;

      // cache-bust, щоб браузер не показав старе фото після заміни.
      const photo_url = `${publicUrl(BUCKET, path)}?t=${Date.now()}`;

      if (v.existingId != null) {
        const patch: { photo_url: string; comment?: string | null } = { photo_url };
        if (v.comment !== null) patch.comment = v.comment;
        const { error } = await supabase
          .from('photo_calendar')
          .update(patch)
          .eq('id', v.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('photo_calendar')
          .insert({ date: v.date, user_id: v.userId, photo_url, comment: v.comment });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка завантаження: ' + (e as Error).message),
  });

  // Збереження коментаря без заміни фото.
  const saveComment = useMutation({
    mutationFn: async (v: { photoId: number; comment: string | null }) => {
      const { error } = await supabase
        .from('photo_calendar')
        .update({ comment: v.comment })
        .eq('id', v.photoId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  return { upload, saveComment };
}
