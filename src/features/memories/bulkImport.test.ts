// ============================================================
// Групування масового імпорту.
// ------------------------------------------------------------
// Правило, заради якого це існує: дата завантаження ніколи не стає датою
// спогаду мовчки. Файли без метаданих мусять опинитись в окремій купці
// й дочекатись рішення власника — інакше сотня старих фото одним махом
// осіла б у сьогоднішньому дні й перемішала хронологію назавжди.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  groupFilesByDay, importSummary, isImportReady, mergeGroupsByDate,
  type ImportGroup, type ScannedFile,
} from './bulkImport';

const f = (name: string, takenAt: string | null): ScannedFile => ({
  file: { name } as File,
  takenAt,
});

describe('groupFilesByDay', () => {
  it('складає знімки одного дня в одну групу', () => {
    const groups = groupFilesByDay([
      f('a', '2026-07-14T06:12:00Z'),
      f('b', '2026-07-14T20:41:00Z'),
      f('c', '2026-07-13T14:10:00Z'),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-14', '2026-07-13']);
    expect(groups[0]!.files).toHaveLength(2);
  });

  it('усередині дня шикує за часом зйомки', () => {
    const groups = groupFilesByDay([
      f('пізніше', '2026-07-14T20:41:00Z'),
      f('раніше', '2026-07-14T06:12:00Z'),
    ]);
    expect(groups[0]!.files.map((x) => x.file.name)).toEqual(['раніше', 'пізніше']);
  });

  it('групи з датою — від найновішої до найстарішої', () => {
    const groups = groupFilesByDay([
      f('a', '2024-01-05T10:00:00Z'),
      f('b', '2026-07-14T10:00:00Z'),
      f('c', '2025-03-20T10:00:00Z'),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-14', '2025-03-20', '2024-01-05']);
  });

  it('файли без метаданих ідуть окремою групою в кінець', () => {
    const groups = groupFilesByDay([
      f('без дати', null),
      f('з датою', '2026-07-14T06:12:00Z'),
      f('теж без', null),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.date).toBe('2026-07-14');
    expect(groups[1]!.date).toBeNull();
    expect(groups[1]!.files).toHaveLength(2);
  });

  it('коли всі файли з датами, купки «без дати» не існує', () => {
    const groups = groupFilesByDay([f('a', '2026-07-14T06:12:00Z')]);
    expect(groups.every((g) => g.date !== null)).toBe(true);
  });

  it('коли жоден не має дати, лишається одна купка на уточнення', () => {
    const groups = groupFilesByDay([f('a', null), f('b', null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBeNull();
  });

  it('порожній вибір дає порожню розкладку', () => {
    expect(groupFilesByDay([])).toEqual([]);
  });

  it('опівнічні знімки не перетікають у сусідній день', () => {
    // Настінний час читається як є; перетворення зон тут немає й бути не
    // може — інакше 23:50 поїхало б на наступну добу.
    const groups = groupFilesByDay([
      f('пізно', '2026-07-14T23:50:00Z'),
      f('рано', '2026-07-15T00:10:00Z'),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-15', '2026-07-14']);
  });
});

describe('mergeGroupsByDate', () => {
  const g = (date: string | null, precision: ImportGroup['precision'], ...names: string[]): ImportGroup =>
    ({ date, precision, files: names.map((n) => f(n, null)) });

  it('зводить купку, якій щойно вказали вже наявний день', () => {
    // Саме цей випадок і є причиною функції: інакше над трьома рядками
    // стояло б «2 дні», і власник бачив би той самий день двічі.
    const merged = mergeGroupsByDate([g('2026-07-14', 'day', 'a'), g('2026-07-14', 'day', 'b', 'c')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.files.map((x) => x.file.name)).toEqual(['a', 'b', 'c']);
  });

  it('різна точність — різні спогади про одну дату', () => {
    const merged = mergeGroupsByDate([g('2024-05-01', 'day', 'a'), g('2024-05-01', 'month', 'b')]);
    expect(merged).toHaveLength(2);
  });

  it('купки без дати не зливаються між собою', () => {
    // Їх і так рівно одна, але зливати null із null означало б
    // стверджувати, що вони про один день — а цього ніхто не знає.
    const merged = mergeGroupsByDate([g(null, 'day', 'a'), g(null, 'day', 'b')]);
    expect(merged).toHaveLength(2);
  });

  it('не мутує вхідні групи', () => {
    const src = [g('2026-07-14', 'day', 'a'), g('2026-07-14', 'day', 'b')];
    mergeGroupsByDate(src);
    expect(src[0]!.files).toHaveLength(1);
  });

  it('уточнена група стає на своє місце в хронології', () => {
    const merged = mergeGroupsByDate([
      g('2026-07-13', 'day', 'a'),
      g('2026-07-14', 'day', 'b'),
      g(null, 'day', 'c'),
    ]);
    expect(merged.map((x) => x.date)).toEqual(['2026-07-14', '2026-07-13', null]);
  });

  it('жоден файл не губиться', () => {
    const src = [g('2026-07-14', 'day', 'a'), g('2026-07-13', 'day', 'b'), g('2026-07-14', 'day', 'c')];
    const total = mergeGroupsByDate(src).reduce((n, x) => n + x.files.length, 0);
    expect(total).toBe(3);
  });
});

describe('importSummary', () => {
  it('рахує окремо готове й те, що чекає', () => {
    const groups = groupFilesByDay([
      f('a', '2026-07-14T06:00:00Z'),
      f('b', '2026-07-14T07:00:00Z'),
      f('c', '2026-07-13T07:00:00Z'),
      f('d', null),
    ]);
    expect(importSummary(groups)).toEqual({ total: 4, dated: 3, undated: 1, days: 2 });
  });
});

describe('isImportReady', () => {
  it('не готово, доки є купка без дати', () => {
    expect(isImportReady(groupFilesByDay([f('a', null)]))).toBe(false);
  });

  it('готово, коли кожна група має дату', () => {
    expect(isImportReady(groupFilesByDay([f('a', '2026-07-14T06:00:00Z')]))).toBe(true);
  });

  it('порожній вибір не готовий до завантаження', () => {
    expect(isImportReady([])).toBe(false);
  });
});
