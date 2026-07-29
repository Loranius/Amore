// ============================================================
// Гроші плану: лише його очікувана вартість.
// ------------------------------------------------------------
// Спільна заначка тепер є однією сумою в «Скарбничці», а фінансові цілі
// більше не прив'язуються до планів. Legacy-тип і сигнатура з масивом
// цілей тимчасово збережені, щоб старі імпорти не ламали міграцію.
// ============================================================
import type { PlanRow } from '@/types';

/** Історичний контракт старих savings_goals. Новий UI його не використовує. */
export interface LinkedGoal {
  plan_id: number | null;
  target_amount: number | null;
  saved_amount: number | null;
}

export interface PlanMoney {
  budget: number | null;
  target: number;
  saved: number;
  gap: number | null;
  percent: number;
  goals: number;
}

/** Залишено лише для безпечного читання старих даних і тестів міграції. */
export function goalsOfPlan<T extends LinkedGoal>(plan: PlanRow, goals: readonly T[]): T[] {
  return goals.filter((goal) => goal.plan_id === plan.id);
}

function normalizedBudget(value: number | null): number | null {
  if (value === null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

/**
 * Активне зведення більше не рахує savings_goals: призначення грошей живе
 * у самому плані, а загальна сума скарбнички приходить через usePiggyBank.
 */
export function planMoney(plan: PlanRow, _legacyGoals: readonly LinkedGoal[]): PlanMoney {
  const budget = normalizedBudget(plan.budget);
  return {
    budget,
    target: 0,
    saved: 0,
    gap: budget,
    percent: 0,
    goals: 0,
  };
}

export function hasMoney(money: PlanMoney): boolean {
  return money.budget !== null;
}
