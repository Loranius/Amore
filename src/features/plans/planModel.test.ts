// ============================================================
// Тести чистих функцій модуля «Плани».
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// Дата заморожена: «найближчий план» і сортування залежать від сьогодні,
// і без фіксованої точки ці тести ламались би раз на добу.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  daysUntilStart, hasPreciseDate, isClosed, nextPlan, nextTask, planDateLabel,
  readiness, showsInCalendar, sortPlans,
} from './planModel';
import type { PlanRow, PlanTaskRow } from '@/types';

const TODAY = new Date(2026, 6, 28); // 28 липня 2026, локальна північ

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'План', description: null, category: 'other', status: 'planning',
  cover_url: null, url: null, start_date: null, end_date: null, start_time: null,
  date_precision: 'none', location_name: null, place_id: null, proposed_by: null,
  confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

const task = (over: Partial<PlanTaskRow> = {}): PlanTaskRow => ({
  id: 1, plan_id: 1, title: 'Завдання', assigned_to: null, due_date: null,
  done: false, done_at: null, sort_order: 0, created_at: '2026-07-01T10:00:00Z',
  ...over,
});

describe('isClosed', () => {
  it('закритими вважаються лише виконані, відкладені й скасовані', () => {
    expect(isClosed(plan({ status: 'done' }))).toBe(true);
    expect(isClosed(plan({ status: 'postponed' }))).toBe(true);
    expect(isClosed(plan({ status: 'cancelled' }))).toBe(true);
    for (const status of ['idea', 'planning', 'preparing', 'ready'] as const) {
      expect(isClosed(plan({ status }))).toBe(false);
    }
  });
});

describe('showsInCalendar', () => {
  it('у календар потрапляють лише точний день і період', () => {
    expect(showsInCalendar(plan({ start_date: '2026-08-12', date_precision: 'day' }))).toBe(true);
    expect(showsInCalendar(plan({ start_date: '2026-08-12', date_precision: 'range' }))).toBe(true);
  });

  it('неточна дата в сітці не показується — її нема де поставити чесно', () => {
    for (const p of ['month', 'season', 'year'] as const) {
      expect(showsInCalendar(plan({ start_date: '2026-09-01', date_precision: p }))).toBe(false);
    }
    expect(showsInCalendar(plan({ start_date: null, date_precision: 'none' }))).toBe(false);
  });
});

describe('daysUntilStart', () => {
  it('без дати відповіді немає — це null, а не нуль', () => {
    expect(daysUntilStart(plan(), TODAY)).toBeNull();
  });

  it('сьогодні це нуль, майбутнє додатне, минуле від\'ємне', () => {
    expect(daysUntilStart(plan({ start_date: '2026-07-28' }), TODAY)).toBe(0);
    expect(daysUntilStart(plan({ start_date: '2026-08-12' }), TODAY)).toBe(15);
    expect(daysUntilStart(plan({ start_date: '2026-07-19' }), TODAY)).toBe(-9);
  });
});

describe('nextPlan', () => {
  it('обирає найближчий у майбутньому серед тих, що в роботі', () => {
    const near = plan({ id: 2, start_date: '2026-08-12', date_precision: 'day' });
    const far = plan({ id: 3, start_date: '2026-12-31', date_precision: 'day' });
    expect(nextPlan([far, near], TODAY)?.id).toBe(2);
  });

  it('сьогоднішній план — теж найближчий, а не вже минулий', () => {
    const today = plan({ id: 4, start_date: '2026-07-28', date_precision: 'day' });
    expect(nextPlan([today], TODAY)?.id).toBe(4);
  });

  it('закриті й прострочені в найближчі не потрапляють', () => {
    const done = plan({ id: 5, start_date: '2026-08-01', status: 'done' });
    const past = plan({ id: 6, start_date: '2026-07-01' });
    expect(nextPlan([done, past], TODAY)).toBeNull();
  });

  it('план без дати найближчим бути не може', () => {
    // «Колись наступного року» не має стояти попереду сьогоднішнього.
    expect(nextPlan([plan({ id: 7, start_date: null })], TODAY)).toBeNull();
  });

  it('неточна дата в акцентну картку не потрапляє', () => {
    // Картка друкує зворотний відлік, а для сезону його нема звідки
    // взяти чесно: 1 вересня там лише початок періоду.
    const season = plan({ id: 8, start_date: '2026-09-01', date_precision: 'season' });
    expect(nextPlan([season], TODAY)).toBeNull();
  });

  it('непідтверджена пропозиція найближчою не стає', () => {
    // Це ще питання до партнера, а не спільний план. Вона мусить
    // лишитись у списку, де є кнопка «Підтвердити» — в акцентній
    // картці такої кнопки немає, і підтвердити було б нічим.
    const proposal = plan({
      id: 9, start_date: '2026-08-01', date_precision: 'day', confirmed: false,
    });
    const agreed = plan({ id: 10, start_date: '2026-08-20', date_precision: 'day' });
    expect(nextPlan([proposal, agreed], TODAY)?.id).toBe(10);
  });
});

describe('hasPreciseDate', () => {
  it('точними вважаються лише день і період — так само, як для календаря', () => {
    expect(hasPreciseDate(plan({ start_date: '2026-08-12', date_precision: 'day' }))).toBe(true);
    expect(hasPreciseDate(plan({ start_date: '2026-08-12', date_precision: 'range' }))).toBe(true);
    expect(hasPreciseDate(plan({ start_date: '2026-09-01', date_precision: 'season' }))).toBe(false);
    expect(hasPreciseDate(plan())).toBe(false);
  });
});

describe('sortPlans', () => {
  it('датовані попереду бездатних, закриті — в кінці', () => {
    const dated = plan({ id: 1, start_date: '2026-08-12' });
    const undated = plan({ id: 2, start_date: null });
    const closed = plan({ id: 3, start_date: '2026-08-01', status: 'done' });
    expect(sortPlans([closed, undated, dated], TODAY).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('прострочений лишається серед датованих, але після майбутніх', () => {
    // Прострочений план не ховається: він саме той, що потребує уваги.
    const future = plan({ id: 1, start_date: '2026-08-12' });
    const overdue = plan({ id: 2, start_date: '2026-07-01' });
    expect(sortPlans([overdue, future], TODAY).map((p) => p.id)).toEqual([1, 2]);
  });

  it('не змінює вхідний масив — його віддає кеш React Query за посиланням', () => {
    const input = [plan({ id: 1, start_date: '2026-12-31' }), plan({ id: 2, start_date: '2026-08-01' })];
    const before = input.map((p) => p.id);
    sortPlans(input, TODAY);
    expect(input.map((p) => p.id)).toEqual(before);
  });
});

describe('readiness', () => {
  it('план без завдань — нуль відсотків, а не сто', () => {
    // Порожній список означає «підготовку не починали», інакше щойно
    // створена ідея виглядала б повністю готовою.
    expect(readiness([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('рахує частку виконаних і округлює до цілого', () => {
    const tasks = [task({ id: 1, done: true }), task({ id: 2 }), task({ id: 3 })];
    expect(readiness(tasks)).toEqual({ total: 3, done: 1, percent: 33 });
  });
});

describe('nextTask', () => {
  it('віддає перше невиконане за порядком, а не за id', () => {
    const tasks = [
      task({ id: 10, sort_order: 2, title: 'Друге' }),
      task({ id: 11, sort_order: 1, title: 'Перше' }),
    ];
    expect(nextTask(tasks)?.title).toBe('Перше');
  });

  it('коли все виконано — null', () => {
    expect(nextTask([task({ done: true, done_at: '2026-07-01T10:00:00Z' })])).toBeNull();
  });
});

describe('planDateLabel', () => {
  it('кожна точність читає той самий start_date по-своєму', () => {
    const at = (date_precision: PlanRow['date_precision'], over: Partial<PlanRow> = {}) =>
      planDateLabel(plan({ start_date: '2026-08-12', date_precision, ...over }));

    expect(at('day')).toBe('12 серпня 2026');
    expect(at('month')).toBe('серпня 2026');
    expect(at('year')).toBe('2026');
    expect(at('season')).toBe('літо 2026');
  });

  it('період в одному місяці не повторює назву місяця', () => {
    expect(planDateLabel(plan({
      start_date: '2026-08-12', end_date: '2026-08-14', date_precision: 'range',
    }))).toBe('12–14 серпня 2026');
  });

  it('період через межу місяця називає обидва', () => {
    expect(planDateLabel(plan({
      start_date: '2026-08-30', end_date: '2026-09-02', date_precision: 'range',
    }))).toBe('30 серпня – 2 вересня 2026');
  });

  it('сезон рахується від місяця початку: грудень — уже зима', () => {
    expect(planDateLabel(plan({ start_date: '2026-12-01', date_precision: 'season' })))
      .toBe('зима 2026');
    expect(planDateLabel(plan({ start_date: '2026-03-01', date_precision: 'season' })))
      .toBe('весна 2026');
  });

  it('без дати підпису немає', () => {
    expect(planDateLabel(plan())).toBeNull();
  });
});
