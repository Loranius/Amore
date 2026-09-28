// ============================================================
// Шлях файлу в сховищі — під префіксом своєї пари (ADR-0229).
// ------------------------------------------------------------
// Кошики сховища спільні для всіх пар, а імена файлів угадувані (дата,
// номер запису). Без префікса фото календаря двох пар за один день лягли
// б в один файл і перезаписали одне одного. Політика `storage_couple_scope`
// пускає писати лише під `c<своя пара>/`; файли без префікса — старі, пари,
// що була в базі до ADR-0229.
//
// Пару питаємо в бази в момент завантаження (`portal_me`), а не тримаємо в
// модулі: завантаження рідкісні, а схований стан на рівні модуля — ні.
// ============================================================
import { supabase } from '@/lib/supabase';

/** `c<пара>/<шлях>` — та сама форма, яку розбирає `storage_object_couple`. */
export function prefixForCouple(coupleId: number, path: string): string {
  if (!Number.isInteger(coupleId) || coupleId <= 0) throw new Error(`Невірний номер пари: ${coupleId}`);
  return `c${coupleId}/${path.replace(/^\/+/, '')}`;
}

async function currentCoupleId(): Promise<number> {
  const { data, error } = await supabase.rpc('portal_me');
  const row = Array.isArray(data) ? (data[0] as { couple_id?: number } | undefined) : undefined;
  if (error || typeof row?.couple_id !== 'number') {
    throw new Error('Не вдалося визначити пару для файлу — увійди ще раз.');
  }
  return row.couple_id;
}

/** Шлях для нового файлу; кидає, якщо пару визначити не вдалося. */
export async function couplePath(path: string): Promise<string> {
  return prefixForCouple(await currentCoupleId(), path);
}

/** Файл кореня пари: повний шлях у кошику й дата створення. */
export interface CoupleRootFile {
  path: string;
  created_at: string | null;
}

interface ListedFile {
  name: string;
  created_at?: string | null;
}

/**
 * Зводить два лістинги «кореня» пари в один: корінь кошика (старі файли без
 * префікса — пара, що була до ADR-0229; іншим парам їх ховає політика
 * сховища) і папку `c<пара>/`. Новіші — першими, не більше `limit`.
 * Підпапки (`profile/`) приходять записом без розширення й відсіюються тим
 * самим фільтром, що й раніше, — межа з портретами профілю не зсувається.
 */
export function mergeCoupleRoot(
  root: readonly ListedFile[],
  own: readonly ListedFile[],
  folder: string,
  limit: number,
): CoupleRootFile[] {
  const image = (f: ListedFile) => /\.(jpe?g|png|webp|gif)$/i.test(f.name);
  const at = (f: ListedFile) => (typeof f.created_at === 'string' ? f.created_at : null);
  const files: CoupleRootFile[] = [
    ...root.filter(image).map((f) => ({ path: f.name, created_at: at(f) })),
    ...own.filter(image).map((f) => ({ path: `${folder}/${f.name}`, created_at: at(f) })),
  ];
  // ISO-рядки порівнюються як рядки; без дати — у кінець, далі за шляхом,
  // щоб порядок не залежав від того, який лістинг прийшов першим.
  files.sort((a, b) =>
    a.created_at === b.created_at
      ? (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
      : a.created_at === null ? 1 : b.created_at === null ? -1 : a.created_at < b.created_at ? 1 : -1,
  );
  return files.slice(0, limit);
}

/**
 * Фото «кореня» кошика для пари, що дивиться: те, що до ADR-0229 було
 * `list('')`. Самого кореня тепер мало — нові файли лягають у `c<пара>/`,
 * і без цього завантажене фото ніколи не дійшло б ні до острова, ні до
 * кристала.
 */
export async function listCoupleRoot(bucket: string, limit: number): Promise<CoupleRootFile[]> {
  const folder = `c${await currentCoupleId()}`;
  const options = { limit, sortBy: { column: 'created_at', order: 'desc' } } as const;
  const [root, own] = await Promise.all([
    supabase.storage.from(bucket).list('', options),
    supabase.storage.from(bucket).list(folder, options),
  ]);
  if (root.error) throw root.error;
  if (own.error) throw own.error;
  return mergeCoupleRoot(root.data ?? [], own.data ?? [], folder, limit);
}
