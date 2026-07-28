// ============================================================
// Гроші плану: бюджет проти зібраного у скарбничці.
// ------------------------------------------------------------
// Чиста функція без React і Supabase, як решта planModel. Питання, на
// яке вона відповідає, одне: «чи вистачає нам на це» — і воно має два
// різні джерела, які легко переплутати. Ціль накопичення знає СВОЮ
// суму (`target_amount`), план знає свою (`budget`), і вони не
// зобов'язані збігатись: можна збирати 20 000 на подорож, яка
// коштуватиме 35 000, і решту доплатити з поточних грошей.
// ============================================================
import type { PlanRow } from '@/types';

/** Мінімум із BudgetGoalRow, що потрібен для підрахунку. Тримаємо
 *  структурно, а не імпортом: модуль планів не має залежати від
 *  внутрішніх типів скарбнички. */
export interface LinkedGoal {
  plan_id: number | null;
  target_amount: number | null;
  saved_amount: number | null;
}

export interface PlanMoney {
  /** Скільки план коштуватиме; null — не рахували. */
  budget: number | null;
  /** Скільки під нього збирають — сума цілей. */
  target: number;
  /** Скільки вже зібрано. */
  saved: number;
  /** Скільки ще треба до бюджету; null коли бюджету немає. */
  gap: number | null;
  /** 0…100 від бюджету, або від суми цілей, коли бюджету немає. */
  percent: number;
  /** Скільки цілей прив'язано (враховуються лише не відхилені). */
  goals: number;
}

/**
 * Цілі, прив'язані саме до цього плану.
 *
 * За статусом НЕ фільтруємо, і це не недогляд: відхилення цілі у
 * скарбничці ВИДАЛЯЄ рядок (`finance_reject_savings_goal_v1`), тож
 * стану «відхилена» в таблиці не існує. Лишаються запропонована й
 * підтверджена — обидві живі, обидві рахуються.
 */
export function goalsOfPlan<T extends LinkedGoal>(plan: PlanRow, goals: readonly T[]): T[] {
  return goals.filter((g) => g.plan_id === plan.id);
}

const num = (v: number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Зведення грошей плану.
 *
 * Відсоток рахується від БЮДЖЕТУ, коли він є: саме бюджет відповідає на
 * «чи вистачає». Коли бюджету немає — від суми цілей, бо іншої мірки
 * не лишається. План без бюджету і без цілей — нуль, а не сто: нічого
 * не зібрано, а не «все готово» (те саме правило, що в `readiness`).
 */
export function planMoney(plan: PlanRow, goals: readonly LinkedGoal[]): PlanMoney {
  const mine = goalsOfPlan(plan, goals);
  const target = mine.reduce((n, g) => n + num(g.target_amount), 0);
  const saved = mine.reduce((n, g) => n + num(g.saved_amount), 0);
  const budget = plan.budget === null ? null : num(plan.budget);

  const base = budget !== null && budget > 0 ? budget : target;
  return {
    budget,
    target,
    saved,
    gap: budget === null ? null : Math.max(budget - saved, 0),
    percent: base > 0 ? Math.min(Math.round((saved / base) * 100), 100) : 0,
    goals: mine.length,
  };
}

/** Чи є про що показувати блок грошей узагалі. */
export function hasMoney(money: PlanMoney): boolean {
  return money.budget !== null || money.goals > 0;
}
