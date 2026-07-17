// ============================================================
// BudgetPage — «Фінанси» (порт budget.js UI)
// ============================================================
import { FreeLimitCard } from './FreeLimitCard';
import { GoalsList } from './GoalsList';

export function BudgetPage() {
  return (
    <section className="budget">
      <h1 className="budget-title">Фінанси</h1>
      <FreeLimitCard />
      <GoalsList />
    </section>
  );
}
