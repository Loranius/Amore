// ============================================================
// PiggyBankPage — «Скарбничка».
// ------------------------------------------------------------
// Одна спільна сума відкладених грошей + домовленість про вільний ліміт.
// Старі savings_goal* таблиці лишаються в базі для історії та сумісності,
// але активний інтерфейс більше не перетворює скарбничку на список цілей.
// ============================================================
import { FreeLimitCard } from './FreeLimitCard';
import { PiggyBankCard } from './PiggyBankCard';
import './budget.css';
import './financeLayoutFix.css';
import './goalDiscussionPolish.css';

export function PiggyBankPage() {
  return (
    <section className="budget pink-page">
      <h1 className="budget-title">Скарбничка</h1>
      <PiggyBankCard />
      <FreeLimitCard />
    </section>
  );
}
