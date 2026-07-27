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

/**
 * Спогад → джерело → id сутності. Окремо від `links`, бо позначку
 * малюють десятки місць, а сам id потрібен рівно одному — переходу за
 * позначкою. Зміна форми `links` зачепила б усі ті місця даремно.
 */
export type MemoryLinkIds = Record<number, Partial<Record<MemorySource, number>>>;

export interface MemoriesArchive {
  photos: MemoryRow[];
  links: MemoryLinksById;
  linkIds: MemoryLinkIds;
  days: Record<string, string>;
}

function groupLinks(rows: readonly MemoryLinkRow[]): MemoryLinksById {
  const out: MemoryLinksById = {};
  for (const row of rows) (out[row.memory_id] ??= []).push(row.source_type);
  return out;
}

function groupLinkIds(rows: readonly MemoryLinkRow[]): MemoryLinkIds {
  const out: MemoryLinkIds = {};
  // Якщо фото прив'язане до двох сутностей одного типу, перемагає перша:
  // позначка все одно одна, і вести їй треба кудись певно.
  for (const row of rows) {
    const entry = (out[row.memory_id] ??= {});
    entry[row.source_type] ??= row.source_id;
  }
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
      const linkRows = (links.data ?? []) as MemoryLinkRow[];
      return {
        photos: (photos.data ?? []) as MemoryRow[],
        links: groupLinks(linkRows),
        linkIds: groupLinkIds(linkRows),
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

/**
 * Один знімок: стиснути → у сховище → рядок в архіві.
 * Винесено з хука, бо цим шляхом ідуть і поодинокі додавання, і кожен
 * файл масового імпорту — дві копії розійшлися б.
 */
async function uploadOne(input: UploadMemoryInput): Promise<void> {
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
}

export function useMemoriesMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.memories() });

  const upload = useMutation({
    mutationFn: uploadOne,
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось додати спогад: ' + (e as Error).message),
  });

  /**
   * Масовий імпорт: групи вантажаться послідовно, а не всі одразу.
   *
   * Паралельний Promise.all на сотні файлів кладе і мережу телефона, і
   * ліміти Storage; послідовність повільніша, зате доходить. Прогрес
   * повідомляється назад, щоб екран не виглядав завислим.
   */
  const uploadMany = useMutation({
    mutationFn: async (v: {
      items: Array<{ file: File; date: string; precision: MemoryPrecision; takenAt: string | null }>;
      userId: number;
      onProgress?: (done: number, total: number) => void;
    }) => {
      const failed: string[] = [];
      for (let i = 0; i < v.items.length; i += 1) {
        const item = v.items[i]!;
        try {
          await uploadOne({ ...item, caption: null, userId: v.userId });
        } catch (e) {
          // Один битий файл не має зупиняти решту дев'яноста дев'яти.
          console.warn('[Спогади] не вдалось завантажити', item.file.name, e);
          failed.push(item.file.name);
        }
        v.onProgress?.(i + 1, v.items.length);
      }
      return failed;
    },
    onSuccess: (failed) => {
      invalidate();
      if (failed.length > 0) {
        toast.show(`Не вдалось завантажити ${failed.length} з файлів — спробуйте ще раз`);
      }
    },
    onError: (e) => toast.show('Імпорт зірвався: ' + (e as Error).message),
  });

  /**
   * Записати ручний порядок дня (§8).
   *
   * `patch` уже містить лише ті рядки, що поїхали з місця (orderPatch),
   * тож на перестановку двох сусідів іде два запити, а не тридцять.
   * Оновлення йдуть паралельно: це один день, десятки рядків максимум, і
   * послідовність тут дала б лише помітну затримку без жодної користі.
   */
  const saveOrder = useMutation({
    mutationFn: async (patch: ReadonlyArray<{ id: number; sort_order: number }>) => {
      if (patch.length === 0) return;
      const results = await Promise.all(
        patch.map((row) =>
          supabase.from('memories').update({ sort_order: row.sort_order }).eq('id', row.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Порядок не зберігся: ' + (e as Error).message),
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

  return { upload, uploadMany, saveOrder, saveCaption, saveDayDescription, unlink, remove };
}
