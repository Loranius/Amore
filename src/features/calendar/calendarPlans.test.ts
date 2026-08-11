// ============================================================
// Тести розкладки планів по календарю.
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// Дата не заморожується: жодна з цих функцій не питає «сьогодні» —
// вони відповідають лише на «чи випадає план на цей день».
// ============================================================
import { describe, expect, it } from 'vitest';
import { planShowsInGrid, plansByDay } from './calendarPlans';
import type { PlanRow } from '@/types';

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'План', description: null, category: 'other', status: 'planning',
  cover_url: null, url: null, start_date: '2026-08-12', end_date: null, start_time: null,
  date_precision: 'day', location_name: null, place_id: null, budget: null, proposed_by: null,
  confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

describe('planShowsInGrid', () => {
  it('неточна дата в сітку не потрапляє — її нема де поставити чесно', () => {
    for (const p of ['month', 'season', 'year', 'none'] as const) {
      expect(planShowsInGrid(plan({ date_precision: p }))).toBe(false);
    }
  });

  it('виконаний план лишається: він таки відбувся того дня', () => {
    // Минула подія в сітці стоїть, і виконаний план нічим від неї не
    // відрізняється — прибрати його означало б стерти минулий місяць.
    expect(planShowsInGrid(plan({ status: 'done' }))).toBe(true);
  });

  it('скасований і відкладений зникають: їхня дата вже нічого не означає', () => {
    expect(planShowsInGrid(plan({ status: 'cancelled' }))).toBe(false);
    expect(planShowsInGrid(plan({ status: 'postponed' }))).toBe(false);
  });
});

describe('plansByDay', () => {
  it('план на конкретний день стоїть рівно в одному дні', () => {
    const byDay = plansByDay([plan()], 2026, 8);
    expect([...byDay.keys()]).toEqual([12]);
    expect(byDay.get(12)?.[0]?.id).toBe(1);
  });

  it('чужий місяць не бачить нічого', () => {
    expect(plansByDay([plan()], 2026, 9).size).toBe(0);
    expect(plansByDay([plan()], 2025, 8).size).toBe(0);
  });

  it('період займає кожен свій день, а не лише перший', () => {
    // Інакше 13 серпня виглядало б вільним посеред походу.
    const trip = plan({ date_precision: 'range', start_date: '2026-08-12', end_date: '2026-08-14' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([12, 13, 14]);
  });

  it('період через межу місяця відрізається по краях місяця', () => {
    const trip = plan({ date_precision: 'range', start_date: '2026-08-30', end_date: '2026-09-02' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([30, 31]);
    expect([...plansByDay([trip], 2026, 9).keys()]).toEqual([1, 2]);
  });

  it('період без кінця читається як один день', () => {
    const half = plan({ date_precision: 'range', end_date: null });
    expect([...plansByDay([half], 2026, 8).keys()]).toEqual([12]);
  });

  it('зіпсований діапазон не ковтає план', () => {
    // Кінець раніше початку — це помилка вводу, а не привід тихо
    // прибрати план із календаря.
    const broken = plan({ date_precision: 'range', start_date: '2026-08-12', end_date: '2026-08-01' });
    expect([...plansByDay([broken], 2026, 8).keys()]).toEqual([12]);
  });

  it('порядок усередині дня сталий — за id, а не за порядком у масиві', () => {
    const a = plan({ id: 7 });
    const b = plan({ id: 3 });
    expect(plansByDay([a, b], 2026, 8).get(12)?.map((p) => p.id)).toEqual([3, 7]);
  });
});

// Перевірка `plansByMonth` пішла разом із функцією — вона рахувала плани для
// річного огляду календаря, якого більше немає.
