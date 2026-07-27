// ============================================================
// Дати «Спогадів». Головний інваріант: `memory_date` завжди зберігає
// ПОЧАТОК періоду, а `precision` каже, як його прочитати. Саме завдяки
// цьому хронологія сортується звичайним порівнянням дат, без окремої
// гілки для неточних спогадів — і саме це тут стережеться.
//
// Той самий контракт продубльований у базі констрейнтом
// `memories_date_matches_precision`; якщо ці тести й він розійдуться,
// вставка почне падати.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatMemoryDate,
  groupMemoriesByDate,
  memoryDayLabel,
  memoryTime,
  normalizeMemoryDate,
  splitByTimeOfDay,
  timeBucketOf,
} from './memoriesDate';
import type { MemoryRow } from '@/types';

const originalTZ = process.env.TZ;
beforeEach(() => { process.env.TZ = 'Europe/Kyiv'; });
afterEach(() => { process.env.TZ = originalTZ; vi.useRealTimers(); });

const photo = (over: Partial<MemoryRow> & { id: number }): MemoryRow => ({
  photo_url: `https://example/${over.id}.jpg`,
  storage_bucket: null,
  storage_path: null,
  memory_date: '2026-07-14',
  date_precision: 'day',
  taken_at: null,
  caption: null,
  uploaded_by: 1,
  sort_order: 0,
  created_at: '2026-07-14T10:00:00Z',
  ...over,
});

describe('normalizeMemoryDate', () => {
  it('точний день лишається собою', () => {
    expect(normalizeMemoryDate('2026-07-14', 'day')).toBe('2026-07-14');
  });

  it('місяць приводиться до першого числа', () => {
    expect(normalizeMemoryDate('2024-05-17', 'month')).toBe('2024-05-01');
  });

  it('рік і «приблизно» приводяться до 1 січня', () => {
    expect(normalizeMemoryDate('2023-08-09', 'year')).toBe('2023-01-01');
    expect(normalizeMemoryDate('2019-11-30', 'approx')).toBe('2019-01-01');
  });

  it('результат задовольняє констрейнт бази для своєї точності', () => {
    // Дзеркало memories_date_matches_precision: 'month' → день = 1,
    // 'year'/'approx' → день = 1 і місяць = 1.
    for (const iso of ['2024-05-17', '2020-02-29', '2026-12-31']) {
      expect(normalizeMemoryDate(iso, 'month').slice(8)).toBe('01');
      expect(normalizeMemoryDate(iso, 'year').slice(5)).toBe('01-01');
      expect(normalizeMemoryDate(iso, 'approx').slice(5)).toBe('01-01');
    }
  });

  // Регресія на клас багів, який уже кусав календар: рядок дати,
  // розібраний як UTC, у від'ємних зонах з'їжджає на день назад.
  it.each(['Europe/Kyiv', 'America/New_York', 'America/Los_Angeles'])(
    'не залежить від часового поясу (%s)',
    (tz) => {
      process.env.TZ = tz;
      expect(normalizeMemoryDate('2024-05-01', 'day')).toBe('2024-05-01');
      expect(normalizeMemoryDate('2024-05-17', 'month')).toBe('2024-05-01');
    },
  );
});

describe('formatMemoryDate', () => {
  it('підписує рівно тим, що відомо', () => {
    expect(formatMemoryDate('2026-07-14', 'day')).toBe('14 липня 2026');
    expect(formatMemoryDate('2024-05-01', 'month')).toBe('Травень 2024');
    expect(formatMemoryDate('2023-01-01', 'year')).toBe('2023 рік');
    expect(formatMemoryDate('2019-01-01', 'approx')).toBe('приблизно 2019');
  });

  it('короткий підпис дня не вигадує числа для неточної дати', () => {
    expect(memoryDayLabel('2026-07-14', 'day')).toBe('14 липня');
    expect(memoryDayLabel('2024-05-01', 'month')).toBe('Травень 2024');
  });
});

describe('час зйомки', () => {
  it('розкладає години по частинах доби', () => {
    expect(timeBucketOf('2026-07-14T06:12:00Z')).toBe('morning');
    expect(timeBucketOf('2026-07-14T13:30:00Z')).toBe('afternoon');
    expect(timeBucketOf('2026-07-14T20:41:00Z')).toBe('evening');
  });

  it('без часу — жодної частини доби, а не вигаданий ранок', () => {
    expect(timeBucketOf(null)).toBeNull();
    expect(timeBucketOf('не дата')).toBeNull();
    expect(memoryTime(null)).toBeNull();
  });

  it('межі 12:00 і 17:00 належать наступній частині', () => {
    expect(timeBucketOf('2026-07-14T11:59:00Z')).toBe('morning');
    expect(timeBucketOf('2026-07-14T12:00:00Z')).toBe('afternoon');
    expect(timeBucketOf('2026-07-14T16:59:00Z')).toBe('afternoon');
    expect(timeBucketOf('2026-07-14T17:00:00Z')).toBe('evening');
  });
});

describe('groupMemoriesByDate', () => {
  it('групує днями, найновіше зверху', () => {
    const groups = groupMemoriesByDate([
      photo({ id: 1, memory_date: '2026-06-17' }),
      photo({ id: 2, memory_date: '2026-07-14' }),
      photo({ id: 3, memory_date: '2026-06-17' }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-14', '2026-06-17']);
    expect(groups[1]!.photos).toHaveLength(2);
  });

  it('ручний порядок перемагає час зйомки', () => {
    // Інакше перестановка знімків користувачем нічого б не давала:
    // EXIF повертав би їх на місце при кожному перемальовуванні.
    const groups = groupMemoriesByDate([
      photo({ id: 1, sort_order: 2, taken_at: '2026-07-14T06:00:00Z' }),
      photo({ id: 2, sort_order: 1, taken_at: '2026-07-14T20:00:00Z' }),
    ]);
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([2, 1]);
  });

  it('за рівного порядку вирішує час зйомки, потім id', () => {
    const groups = groupMemoriesByDate([
      photo({ id: 9, taken_at: '2026-07-14T20:00:00Z' }),
      photo({ id: 3, taken_at: '2026-07-14T06:00:00Z' }),
      photo({ id: 5, taken_at: null }),
    ]);
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([5, 3, 9]);
  });

  it('порожній архів дає порожній список, а не виняток', () => {
    expect(groupMemoriesByDate([])).toEqual([]);
  });
});

describe('splitByTimeOfDay', () => {
  it('повертає лише непорожні частини, у порядку доби', () => {
    const groups = splitByTimeOfDay([
      photo({ id: 1, taken_at: '2026-07-14T20:41:00Z' }),
      photo({ id: 2, taken_at: '2026-07-14T06:12:00Z' }),
      photo({ id: 3, taken_at: null }),
    ]);
    expect(groups.map((g) => g.bucket)).toEqual(['morning', 'evening', null]);
  });

  it('усі знімки лишаються рівно в одній частині', () => {
    const photos = [
      photo({ id: 1, taken_at: '2026-07-14T06:00:00Z' }),
      photo({ id: 2, taken_at: '2026-07-14T13:00:00Z' }),
      photo({ id: 3, taken_at: '2026-07-14T21:00:00Z' }),
      photo({ id: 4, taken_at: null }),
    ];
    const total = splitByTimeOfDay(photos).reduce((n, g) => n + g.photos.length, 0);
    expect(total).toBe(photos.length);
  });
});
