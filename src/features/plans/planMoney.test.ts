// ============================================================
// Тести грошей плану.
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// Дата тут не потрібна: жодна з функцій не питає «сьогодні».
// ============================================================
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

describe('goalsOfPlan', () => {
  it('бере лише свої цілі — чужий план у підрахунок не потрапляє', () => {
    const mine = goal();
    const theirs = goal({ plan_id: 2 });
    const loose = goal({ plan_id: null });
    expect(goalsOfPlan(plan(), [mine, theirs, loose])).toEqual([mine]);
  });

  it('за статусом не фільтруємо: відхилена ціль у таблиці не лишається', () => {
    // finance_reject_savings_goal_v1 ВИДАЛЯЄ рядок, тож стану
    // «відхилена» не існує. Живі статуси — pending і confirmed, і
    // запропонована ціль так само чекає на гроші, як підтверджена.
    const mine = goal();
    expect(goalsOfPlan(plan(), [mine])).toEqual([mine]);
  });
});

describe('planMoney', () => {
  it('без бюджету й без цілей — нулі, а не сто відсотків', () => {
    // Те саме правило, що в readiness: порожньо означає «не починали».
    expect(planMoney(plan(), [])).toEqual({
      budget: null, target: 0, saved: 0, gap: null, percent: 0, goals: 0,
    });
  });

  it('відсоток рахується від бюджету — саме він відповідає «чи вистачає»', () => {
    // Ціль на 20 000 зібрана наполовину, але план коштує 40 000:
    // готовність — 25%, а не 50%.
    const money = planMoney(plan({ budget: 40_000 }), [
      goal({ target_amount: 20_000, saved_amount: 10_000 }),
    ]);
    expect(money.percent).toBe(25);
    expect(money.gap).toBe(30_000);
  });

  it('без бюджету мірка — сума цілей, іншої не лишається', () => {
    const money = planMoney(plan(), [goal({ target_amount: 10_000, saved_amount: 5_000 })]);
    expect(money.percent).toBe(50);
    expect(money.gap).toBeNull();
  });

  it('кілька цілей додаються, а не заміщують одна одну', () => {
    const money = planMoney(plan({ budget: 30_000 }), [
      goal({ target_amount: 10_000, saved_amount: 4_000 }),
      goal({ target_amount: 20_000, saved_amount: 5_000 }),
    ]);
    expect(money).toMatchObject({ target: 30_000, saved: 9_000, goals: 2, percent: 30 });
  });

  it('зібрано більше за бюджет: сто відсотків і нульова нестача, без мінусів', () => {
    const money = planMoney(plan({ budget: 5_000 }), [
      goal({ target_amount: 10_000, saved_amount: 8_000 }),
    ]);
    expect(money.percent).toBe(100);
    expect(money.gap).toBe(0);
  });

  it('нульовий бюджет не ділить на нуль', () => {
    // «Безкоштовний» план — легальний стан: пікнік коштує нуль.
    const money = planMoney(plan({ budget: 0 }), []);
    expect(money.percent).toBe(0);
    expect(money.gap).toBe(0);
  });

  it('порожні суми в базі читаються як нуль, а не як NaN', () => {
    const money = planMoney(plan({ budget: 1_000 }), [
      goal({ target_amount: null, saved_amount: null }),
    ]);
    expect(money.target).toBe(0);
    expect(money.saved).toBe(0);
    expect(money.percent).toBe(0);
  });
});

describe('hasMoney', () => {
  it('блок показується коли є бюджет АБО хоч одна ціль', () => {
    expect(hasMoney(planMoney(plan({ budget: 100 }), []))).toBe(true);
    expect(hasMoney(planMoney(plan(), [goal()]))).toBe(true);
  });

  it('порожньому плану блок грошей не потрібен', () => {
    expect(hasMoney(planMoney(plan(), []))).toBe(false);
  });
});
