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
import { dayInMonth, eventsByDay } from './calendarMonth';
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

// Перевірки `yearSummary` і `yearHeat` пішли разом із самими функціями: річний
// огляд жив на сторінці календаря, а сторінки не стало — календар тепер
// вкладка «Планів». Тест, що переживає свій предмет, стереже порожнечу.
