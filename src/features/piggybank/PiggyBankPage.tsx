// ============================================================
// PiggyBankPage — «Скарбничка».
// ------------------------------------------------------------
// Одна спільна сума відкладених грошей + домовленість про вільний ліміт.
// Старі savings_goal* таблиці лишаються в базі для історії та сумісності,
// але активний інтерфейс більше не перетворює скарбничку на список цілей.
// ============================================================
import { PageHeader } from '@/components/ui/PageHeader';
import { FreeLimitCard } from './FreeLimitCard';
import { PiggyBankCard } from './PiggyBankCard';
import './budget.css';
import './financeLayoutFix.css';

export function PiggyBankPage() {
  return (
    <section className="budget pink-page">
      <PageHeader
        title="Скарбничка"
        eyebrow="Спільні гроші"
        meta="Скільки ви разом відклали й скільки кожен може витратити без узгодження."
      />
      <PiggyBankCard />
      <FreeLimitCard />
    </section>
  );
}
