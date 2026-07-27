// ============================================================
// «Спогади» — доступ до архіву.
// ------------------------------------------------------------
// Замінює usePhotoCalendar, у якого модель була «одне фото на користувача
// на день». Тут дата — контейнер, а атомарна одиниця — знімок.
//
// Файл ніколи не копіюється між модулями (§13): архів зберігає посилання,
// а `storage_bucket`/`storage_path` заповнені лише для файлів, які він
// завантажив сам. Для фото мітки чи реакції на подарунок вони null — і це
// те, що не дає архіву видалити чужий файл.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import { normalizeMemoryDate } from './memoriesDate';
import type { MemoryDayRow, MemoryLinkRow, MemoryPrecision, MemoryRow, MemorySource } from '@/types';

export const MEMORIES_BUCKET = 'photo-calendar';

const COLUMNS = 'id,photo_url,storage_bucket,storage_path,memory_date,date_precision,taken_at,caption,uploaded_by,sort_order,created_at';

/** Зв'язки, згруповані по спогаду — щоб позначку джерела малювати без другого запиту. */
export type MemoryLinksById = Record<number, MemorySource[]>;

export interface MemoriesArchive {
  photos: MemoryRow[];
  links: MemoryLinksById;
  days: Record<string, string>;
}

function groupLinks(rows: readonly MemoryLinkRow[]): MemoryLinksById {
  const out: MemoryLinksById = {};
  for (const row of rows) (out[row.memory_id] ??= []).push(row.source_type);
  return out;
}

/**
 * Увесь архів однією вибіркою.
 *
 * Так, це «завантажити все». На поточних 45 рядках це десятки кілобайт, а
 * стрічці (головний вигляд) усе одно потрібна суцільна хронологія. Коли
 * архів виросте до тисяч, тут з'явиться курсор по `memory_date` — і саме
 * тому запит уже відсортований і має індекс `memories_timeline_idx`.
 */
export function useMemories() {
  return useQuery({
    queryKey: qk.memories(),
    queryFn: async (): Promise<MemoriesArchive> => {
      const [photos, links, days] = await Promise.all([
        supabase.from('memories').select(COLUMNS).order('memory_date', { ascending: false }),
        supabase.from('memory_links').select('memory_id,source_type,source_id'),
        supabase.from('memory_days').select('memory_date,description,updated_by'),
      ]);
      if (photos.error) throw photos.error;
      if (links.error) throw links.error;
      if (days.error) throw days.error;

      const descriptions: Record<string, string> = {};
      for (const d of (days.data ?? []) as MemoryDayRow[]) {
        if (d.description) descriptions[d.memory_date] = d.description;
      }
      return {
        photos: (photos.data ?? []) as MemoryRow[],
        links: groupLinks((links.data ?? []) as MemoryLinkRow[]),
        days: descriptions,
      };
    },
  });
}

export interface UploadMemoryInput {
  file: File;
  /** Дата, яку вказав користувач; буде приведена до початку періоду. */
  date: string;
  precision: MemoryPrecision;
  caption: string | null;
  userId: number;
  /** Час зйомки з метаданих, якщо відомий (етап 3). */
  takenAt?: string | null;
}

export function useMemoriesMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.memories() });

  const upload = useMutation({
    mutationFn: async (input: UploadMemoryInput) => {
      let blob: Blob = input.file;
      let ext = 'jpg';
      let contentType = 'image/jpeg';
      try {
        const out = await compress(input.file, 1600, 0.84);
        blob = out.blob;
        ext = out.ext;
        contentType = out.contentType;
      } catch (e) {
        console.warn('[Спогади] стиснення не вдалося, вантажу оригінал:', e);
      }

      const memoryDate = normalizeMemoryDate(input.date, input.precision);
      const [y, m] = memoryDate.split('-');
      // Унікальне ім'я замість `date_userId`: на одну дату тепер може
      // припадати скільки завгодно знімків, і старий шлях їх би затирав.
      const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const path = `${y}/${m}/${memoryDate}_${input.userId}_${unique}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(MEMORIES_BUCKET)
        .upload(path, blob, { upsert: false, contentType });
      if (upErr) throw upErr;

      const { error } = await supabase.from('memories').insert({
        photo_url: publicUrl(MEMORIES_BUCKET, path),
        storage_bucket: MEMORIES_BUCKET,
        storage_path: path,
        memory_date: memoryDate,
        date_precision: input.precision,
        caption: input.caption,
        uploaded_by: input.userId,
        taken_at: input.takenAt ?? null,
      });
      if (error) {
        // Рядок не створився — файл у сховищі став сиротою. Прибираємо,
        // інакше кожна невдала спроба лишає сміття, за яке платить власник.
        await supabase.storage.from(MEMORIES_BUCKET).remove([path]).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось додати спогад: ' + (e as Error).message),
  });

  const saveCaption = useMutation({
    mutationFn: async (v: { id: number; caption: string | null }) => {
      const { error } = await supabase.from('memories').update({ caption: v.caption }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  const saveDayDescription = useMutation({
    mutationFn: async (v: { date: string; description: string | null; userId: number }) => {
      const { error } = await supabase.from('memory_days').upsert(
        { memory_date: v.date, description: v.description, updated_by: v.userId },
        { onConflict: 'memory_date' },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  /**
   * Відв'язати спогад від модуля (§16), не видаляючи його.
   *
   * Фото лишається в архіві й стає «доданим вручну» — просто зникає
   * зв'язок. Це половина вибору, який архів зобов'язаний давати замість
   * мовчазного видалення.
   */
  const unlink = useMutation({
    mutationFn: async (v: { memoryId: number; source: MemorySource }) => {
      const { error } = await supabase
        .from('memory_links')
        .delete()
        .eq('memory_id', v.memoryId)
        .eq('source_type', v.source);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось відв\'язати: ' + (e as Error).message),
  });

  /**
   * Видалення спогаду з архіву.
   *
   * Файл зі сховища прибирається ЛИШЕ якщо архів ним володіє
   * (`storage_path` заповнений). Фото мітки карти належить карті — архів
   * забирає його зі своєї хронології, але не стирає з диска (§16).
   */
  const remove = useMutation({
    mutationFn: async (memory: MemoryRow) => {
      const { error } = await supabase.from('memories').delete().eq('id', memory.id);
      if (error) throw error;
      if (memory.storage_bucket && memory.storage_path) {
        await supabase.storage
          .from(memory.storage_bucket)
          .remove([memory.storage_path])
          .catch((e) => console.warn('[Спогади] файл не прибрався:', e));
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось видалити: ' + (e as Error).message),
  });

  return { upload, saveCaption, saveDayDescription, unlink, remove };
}
