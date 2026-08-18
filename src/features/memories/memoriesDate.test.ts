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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatMemoryDate, memoryDayLabel, normalizeMemoryDate } from './memoriesDate';

const originalTZ = process.env.TZ;
beforeEach(() => { process.env.TZ = 'Europe/Kyiv'; });
afterEach(() => { process.env.TZ = originalTZ; });

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
