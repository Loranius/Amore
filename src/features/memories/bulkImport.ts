// ============================================================
// Масовий імпорт: розкладка вибраних файлів по днях (§8).
// ------------------------------------------------------------
// Чиста частина, без DOM і без запитів — щоб групування можна було
// перевірити тестами, а не «на очі» після завантаження сотні фото.
//
// Головне правило специфікації, яке тут закодоване: дата завантаження
// НІКОЛИ не стає датою спогаду мовчки. Файл без метаданих потрапляє в
// окрему групу «без дати» й чекає, доки власник скаже, коли це було.
// ============================================================
import type { MemoryPrecision } from '@/types';

export interface ScannedFile {
  file: File;
  /** Настінний час зйомки з EXIF ('…Z') або null. */
  takenAt: string | null;
}

export interface ImportGroup {
  /** 'YYYY-MM-DD' або null для купки без метаданих. */
  date: string | null;
  precision: MemoryPrecision;
  files: ScannedFile[];
}

/** Найраніший час у групі — за ним групи шикуються в хронологію. */
function earliest(files: readonly ScannedFile[]): string {
  return files.reduce<string>(
    (min, f) => (f.takenAt && (min === '' || f.takenAt < min) ? f.takenAt : min),
    '',
  );
}

/**
 * Розкласти вибрані файли по днях зйомки.
 *
 * Групи з датою йдуть від найновішої до найстарішої — так само, як
 * виглядає сама стрічка архіву. Група «без дати» завжди остання: це
 * робота, яку ще треба зробити, і вона має бути в кінці списку, а не
 * загубитись поміж готових днів.
 */
export function groupFilesByDay(scanned: readonly ScannedFile[]): ImportGroup[] {
  const byDay = new Map<string, ScannedFile[]>();
  const undated: ScannedFile[] = [];

  for (const item of scanned) {
    if (!item.takenAt) {
      undated.push(item);
      continue;
    }
    const day = item.takenAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(item);
    else byDay.set(day, [item]);
  }

  const dated: ImportGroup[] = [...byDay.entries()]
    .map(([date, files]) => ({
      date,
      precision: 'day' as const,
      // Усередині дня — за часом зйомки: саме так пара переживала той день.
      files: files.sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? '')),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return undated.length > 0
    ? [...dated, { date: null, precision: 'day' as const, files: undated }]
    : dated;
}

/**
 * Звести групи з однаковою датою й точністю в одну.
 *
 * Потрібно після того, як власник вказав дату купці «без дати»: якщо він
 * вибрав день, який у розкладці вже є, лишити два окремі рядки з тим
 * самим підписом означало б показувати «2 дні» над трьома групами.
 * Точність теж мусить збігтися — «14 липня» і «липень» це різні спогади
 * про одну дату, а не один.
 */
export function mergeGroupsByDate(groups: readonly ImportGroup[]): ImportGroup[] {
  const out: ImportGroup[] = [];
  for (const group of groups) {
    const twin =
      group.date === null
        ? undefined
        : out.find((g) => g.date === group.date && g.precision === group.precision);
    if (twin) twin.files = [...twin.files, ...group.files];
    else out.push({ ...group, files: [...group.files] });
  }
  // Той самий порядок, що й у groupFilesByDay: щойно уточнена група має
  // стати на своє місце в хронології, а не лишитись у хвості списку.
  return out.sort((a, b) => {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

/** Скільки файлів у розкладці має дату, а скільки чекає на уточнення. */
export function importSummary(groups: readonly ImportGroup[]): {
  total: number;
  dated: number;
  undated: number;
  days: number;
} {
  let dated = 0;
  let undated = 0;
  let days = 0;
  for (const g of groups) {
    if (g.date === null) undated += g.files.length;
    else {
      dated += g.files.length;
      days += 1;
    }
  }
  return { total: dated + undated, dated, undated, days };
}

/** Чи можна вантажити: кожна група мусить мати дату. */
export function isImportReady(groups: readonly ImportGroup[]): boolean {
  return groups.length > 0 && groups.every((g) => g.date !== null);
}

/** Порядок сортування всередині групи — для поля sort_order. */
export { earliest as earliestTakenAt };
