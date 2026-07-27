// ============================================================
// Дати календаря — чисті функції, від яких залежить увесь модуль.
// ------------------------------------------------------------
// Модуль про дати не мав жодного тесту, і обидві помилки, які тут
// зафіксовані, знайшлись саме тому. Кожен блок нижче називає інваріант,
// який стереже.
//
// Час зупинений (`vi.setSystemTime`): «через скільки днів» без фіксованого
// «сьогодні» — це тест, який зеленіє й червоніє від календаря, а не від коду.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  daysLabel,
  daysUntil,
  formatUaDate,
  nextOccurrence,
  sortEnriched,
} from './calendarUtils';
import type { EnrichedEvent, EventRow } from '@/types';

/** Понеділок, 27 липня 2026, 09:00 за Києвом. */
const NOW = new Date('2026-07-27T09:00:00+03:00');

const HOME_TZ = 'Europe/Kyiv';
const originalTZ = process.env.TZ;

function event(date: string, yearly: boolean): EventRow {
  return {
    id: 1,
    title: 'Подія',
    description: null,
    date,
    created_by: 1,
    type: 'anniversary',
    yearly,
    metadata: null,
    is_milestone: false,
  } as EventRow;
}

/** 'YYYY-MM-DD' локальної дати — щоб не порівнювати Date з Date. */
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

beforeEach(() => {
  process.env.TZ = HOME_TZ;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTZ;
});

describe('nextOccurrence', () => {
  it('щорічна подія, дата якої цього року вже минула, переходить на наступний рік', () => {
    const { date, passed } = nextOccurrence(event('2022-05-22', true));
    expect(ymd(date)).toBe('2027-05-22');
    // Щорічна подія не буває «минулою»: вона завжди попереду.
    expect(passed).toBe(false);
  });

  it('щорічна подія, дата якої цього року ще попереду, лишається в цьому році', () => {
    const { date, passed } = nextOccurrence(event('2022-12-26', true));
    expect(ymd(date)).toBe('2026-12-26');
    expect(passed).toBe(false);
  });

  it('щорічна подія сьогодні — це сьогодні, а не наступний рік', () => {
    const { date } = nextOccurrence(event('2019-07-27', true));
    expect(ymd(date)).toBe('2026-07-27');
    expect(daysUntil(date)).toBe(0);
  });

  it('разова майбутня подія лишається собою і не позначається минулою', () => {
    const { date, passed } = nextOccurrence(event('2026-12-31', false));
    expect(ymd(date)).toBe('2026-12-31');
    expect(passed).toBe(false);
  });

  it('разова минула подія позначається минулою', () => {
    const { date, passed } = nextOccurrence(event('2026-07-02', false));
    expect(ymd(date)).toBe('2026-07-02');
    expect(passed).toBe(true);
    expect(daysUntil(date)).toBe(-25);
  });

  // РЕГРЕСІЯ. `new Date(2027, 1, 29)` — це 1 березня: у Date переповнення
  // дня мовчки переливається в наступний місяць. Тому щорічна подія
  // 29 лютого показувалась 1 березня, а крон-нагадування (яке звіряє
  // 'MM-DD') не спрацьовувало взагалі три роки з чотирьох.
  // Конвенція: затискаємо до останнього дня того самого місяця.
  it('29 лютого у невисокосний рік стає 28 лютого, а не 1 березня', () => {
    const { date } = nextOccurrence(event('2020-02-29', true));
    expect(ymd(date)).toBe('2027-02-28');
  });

  it('29 лютого у високосний рік лишається 29 лютого', () => {
    vi.setSystemTime(new Date('2028-01-10T09:00:00+02:00'));
    const { date } = nextOccurrence(event('2020-02-29', true));
    expect(ymd(date)).toBe('2028-02-29');
  });
});

// РЕГРЕСІЯ. `new Date('2022-05-22')` — це опівніч UTC, а `.getDate()` читає
// локально: у від'ємних зсувах кожна дата модуля з'їжджала на день назад
// (виміряно: «21 травня» у New York і Los Angeles). Застосунок — PWA, який
// пара носить із собою, тож це не гіпотетична подорож.
describe('formatUaDate не залежить від часового поясу', () => {
  it.each(['Europe/Kyiv', 'America/New_York', 'America/Los_Angeles', 'Pacific/Kiritimati'])(
    'у %s',
    (tz) => {
      process.env.TZ = tz;
      expect(formatUaDate('2022-05-22')).toBe('22 травня 2022 р.');
      expect(formatUaDate('2026-01-01')).toBe('1 січня 2026 р.');
      expect(formatUaDate('2026-12-31')).toBe('31 грудня 2026 р.');
    },
  );
});

describe('nextOccurrence не залежить від часового поясу', () => {
  it.each(['Europe/Kyiv', 'America/New_York', 'America/Los_Angeles'])('у %s', (tz) => {
    process.env.TZ = tz;
    // Дата події читається як календарна, а не як мить у часі.
    expect(ymd(nextOccurrence(event('2026-12-31', false)).date)).toBe('2026-12-31');
  });
});

describe('daysLabel', () => {
  it.each([
    [0, '🎊 Сьогодні!'],
    [1, 'завтра'],
    [-1, '1 дн. тому'],
    [-25, '25 дн. тому'],
    [6, 'через 6 дн.'],
    [7, 'через 1 тиж.'],
    [29, 'через 4 тиж.'],
    [30, 'через 1 міс.'],
    [364, 'через 12 міс.'],
    [365, 'через 1 р.'],
  ])('%i → %s', (days, label) => {
    expect(daysLabel(days)).toBe(label);
  });
});

describe('sortEnriched', () => {
  const enriched = (id: number, days: number, passed: boolean): EnrichedEvent =>
    ({ ...event('2026-01-01', false), id, days, passed, nextDate: new Date() }) as EnrichedEvent;

  it('минулі йдуть у кінець, майбутні — за близькістю', () => {
    const order = [
      enriched(1, -5, true),
      enriched(2, 30, false),
      enriched(3, 2, false),
      enriched(4, -1, true),
    ]
      .sort(sortEnriched)
      .map((e) => e.id);
    expect(order).toEqual([3, 2, 1, 4]);
  });
});
