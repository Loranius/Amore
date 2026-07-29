import { describe, expect, it } from 'vitest';
import { goalsOfPlan, hasMoney, planMoney, type LinkedGoal } from './planMoney';
import type { PlanRow } from '@/types';

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'Вікенд у Карпатах', description: null, category: 'trip', status: 'planning',
  cover_url: null, url: null, start_date: null, end_date: null, start_time: null,
  date_precision: 'none', location_name: null, place_id: null, budget: null,
  proposed_by: null, confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

const goal = (over: Partial<LinkedGoal> = {}): LinkedGoal => ({
  plan_id: 1, target_amount: 10_000, saved_amount: 2_500, ...over,
});

describe('goalsOfPlan legacy helper', () => {
  it('усе ще може прочитати старі зв’язки під час міграції', () => {
    const mine = goal();
    const theirs = goal({ plan_id: 2 });
    const loose = goal({ plan_id: null });
    expect(goalsOfPlan(plan(), [mine, theirs, loose])).toEqual([mine]);
  });
});

describe('planMoney', () => {
  it('без бюджету повертає порожній стан', () => {
    expect(planMoney(plan(), [])).toEqual({
      budget: null, target: 0, saved: 0, gap: null, percent: 0, goals: 0,
    });
  });

  it('зберігає лише очікувану вартість плану', () => {
    expect(planMoney(plan({ budget: 40_000 }), [])).toEqual({
      budget: 40_000, target: 0, saved: 0, gap: 40_000, percent: 0, goals: 0,
    });
  });

  it('ігнорує старі savings goals у новій моделі', () => {
    const money = planMoney(plan({ budget: 40_000 }), [
      goal({ target_amount: 20_000, saved_amount: 10_000 }),
    ]);
    expect(money).toEqual({
      budget: 40_000, target: 0, saved: 0, gap: 40_000, percent: 0, goals: 0,
    });
  });

  it('нульовий бюджет лишається легальним', () => {
    expect(planMoney(plan({ budget: 0 }), [])).toEqual({
      budget: 0, target: 0, saved: 0, gap: 0, percent: 0, goals: 0,
    });
  });

  it('некоректна сума не перетворює UI на NaN', () => {
    const invalid = plan({ budget: Number.NaN });
    expect(planMoney(invalid, []).budget).toBe(0);
  });
});

describe('hasMoney', () => {
  it('блок показується, коли в плані визначено бюджет', () => {
    expect(hasMoney(planMoney(plan({ budget: 100 }), []))).toBe(true);
  });

  it('старі цілі самі по собі більше не вмикають блок', () => {
    expect(hasMoney(planMoney(plan(), [goal()]))).toBe(false);
  });
});
