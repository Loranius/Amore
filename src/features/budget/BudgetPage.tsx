// ============================================================
// BudgetPage — «Фінанси»
// ============================================================
import { FreeLimitCard } from './FreeLimitCard';
import { GoalsList } from './GoalsList';
import { PortalDecor } from '@/features/auth/PortalDecor';
import './budget.css';
import './financeLayoutFix.css';

export function BudgetPage() {
  return (
    <section className="budget pink-page">
      <PortalDecor density="light" parallax={false} />
      <h1 className="budget-title">Фінанси</h1>
      <GoalsList />
      <FreeLimitCard />
    </section>
  );
}
