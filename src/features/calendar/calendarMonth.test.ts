// ============================================================
// Сітка місяця й річний огляд.
// ------------------------------------------------------------
// Інваріант, який відрізняє це від `nextOccurrence`: питання не «коли
// подія буде найближче», а «чи випадає вона на ЦЕЙ місяць». Переглядаючи
// березень 2028-го, треба бачити 8 березня — попри те, що найближче
// настання давно позаду.
//
// Регресія на 29 лютого: конвенція модуля — затискати до останнього дня
// ТОГО САМОГО місяця, а не переливатись у наступний. Тут вона мусить
// збігатись із `nextOccurrence`, інакше сітка й список показуватимуть
// одну подію в різні дні.
// ============================================================
import { describe, expect, it } from 'vitest';
import { dayInMonth, eventsByDay, yearHeat, yearSummary } from './calendarMonth';
import type { EventRow } from '@/types';

let nextId = 1;
const event = (
  date: string,
  yearly: boolean,
  type: EventRow['type'] = 'birthday',
): EventRow => ({
  id: nextId++, title: 'Подія', description: null, date, created_by: 1,
  type, yearly, metadata: null, is_milestone: false, person_user_id: null,
} as EventRow);

describe('dayInMonth', () => {
  it('щорічна подія випадає у свій місяць будь-якого року', () => {
    const ev = event('1963-07-05', true);
    expect(dayInMonth(ev, 2026, 7)).toBe(5);
    expect(dayInMonth(ev, 2030, 7)).toBe(5);
    // ...і не випадає в жоден інший місяць.
    expect(dayInMonth(ev, 2026, 8)).toBeNull();
  });

  it('разова подія існує рівно в своєму місяці свого року', () => {
    const ev = event('2026-03-14', false);
    expect(dayInMonth(ev, 2026, 3)).toBe(14);
    expect(dayInMonth(ev, 2027, 3)).toBeNull();
  });

  it('29 лютого в невисокосному році стає 28-м, а не 1 березня', () => {
    const ev = event('2024-02-29', true);
    expect(dayInMonth(ev, 2024, 2)).toBe(29);
    expect(dayInMonth(ev, 2027, 2)).toBe(28);
    // Головне: у березні його немає.
    expect(dayInMonth(ev, 2027, 3)).toBeNull();
  });

  it('31-е число в короткому місяці не з’їжджає', () => {
    // Щорічна подія 31 січня в лютому не існує взагалі.
    expect(dayInMonth(event('2020-01-31', true), 2026, 2)).toBeNull();
  });

  it('несправна дата не ламає сітку', () => {
    expect(dayInMonth(event('не дата', true), 2026, 7)).toBeNull();
  });
});

describe('eventsByDay', () => {
  it('збирає події одного дня разом', () => {
    const map = eventsByDay(
      [event('1963-07-05', true), event('2000-07-05', true), event('1990-07-14', true)],
      2026, 7,
    );
    expect(map.get(5)).toHaveLength(2);
    expect(map.get(14)).toHaveLength(1);
    expect(map.has(6)).toBe(false);
  });

  it('події чужих місяців не потрапляють', () => {
    expect(eventsByDay([event('2026-08-24', false)], 2026, 7).size).toBe(0);
  });

  it('порядок усередині дня сталий, а не залежить від входу', () => {
    const a = event('2000-07-05', true);
    const b = event('2001-07-05', true);
    const one = eventsByDay([a, b], 2026, 7).get(5)!.map((e) => e.id);
    const two = eventsByDay([b, a], 2026, 7).get(5)!.map((e) => e.id);
    expect(one).toEqual(two);
  });

  it('порожній список дає порожню сітку', () => {
    expect(eventsByDay([], 2026, 7).size).toBe(0);
  });
});

describe('yearSummary', () => {
  it('дає рівно дванадцять місяців', () => {
    const months = yearSummary([], 2026);
    expect(months).toHaveLength(12);
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('рахує події місяця й перелічує їхні типи без повторів', () => {
    const summary = yearSummary([
      event('1963-07-05', true, 'birthday'),
      event('2000-07-14', true, 'birthday'),
      event('2022-07-13', true, 'anniversary'),
      event('2026-12-25', true, 'holiday'),
    ], 2026);

    const july = summary[6]!;
    expect(july.count).toBe(3);
    expect(july.types.sort()).toEqual(['anniversary', 'birthday']);

    expect(summary[11]!.count).toBe(1);
    expect(summary[0]!.count).toBe(0);
    expect(summary[0]!.types).toEqual([]);
  });

  it('щорічні події однакові в будь-якому році, разові — ні', () => {
    const events = [event('2020-05-10', true), event('2026-05-11', false)];
    expect(yearSummary(events, 2026)[4]!.count).toBe(2);
    expect(yearSummary(events, 2027)[4]!.count).toBe(1);
  });
});

describe('yearHeat', () => {
  const months = (...counts: number[]) =>
    counts.map((count, i) => ({ month: i + 1, count, types: [] }));

  it('порожній місяць має рівно нуль, а не «трохи»', () => {
    const heat = yearHeat(months(0, 3));
    expect(heat[0]!.heat).toBe(0);
    expect(heat[1]!.heat).toBeGreaterThan(0);
  });

  it('рік без подій не ділить на нуль', () => {
    expect(yearHeat(months(0, 0, 0)).every((m) => m.heat === 0)).toBe(true);
  });

  it('найгустіший місяць — одиниця, решта пропорційно', () => {
    const heat = yearHeat(months(0, 1, 2, 4));
    expect(heat[3]!.heat).toBeCloseTo(1);
    expect(heat[2]!.heat).toBeCloseTo(0.35 + 0.65 * 0.5);
    expect(heat[1]!.heat).toBeCloseTo(0.35 + 0.65 * 0.25);
  });

  it('ненульова насиченість не опускається нижче 0.35 — інакше місяць з '
    + 'однією подією не відрізнити від порожнього', () => {
    // Рік, де є місяць із двадцятьма подіями й місяць з однією.
    const heat = yearHeat(months(20, 1));
    expect(heat[1]!.heat).toBeGreaterThanOrEqual(0.35);
  });

  it('не змінює вихідні поля місяця', () => {
    const src = [{ month: 7, count: 2, types: ['birthday'] }];
    expect(yearHeat(src)[0]).toMatchObject({ month: 7, count: 2, types: ['birthday'] });
  });
});
