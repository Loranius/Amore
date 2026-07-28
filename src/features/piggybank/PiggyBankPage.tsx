// ============================================================
// PiggyBankPage — «Скарбничка».
// ------------------------------------------------------------
// Колишні «Фінанси». Модуль перейменований, СХЕМА — ні: таблиці
// savings_goal* і free_limit, усі finance_* RPC, Telegram-потік і
// realtime лишились як були. Кристал рахує накопичення на головній
// (useCrystal → goalsAchieved, totalSaved), і перейменування таблиць
// зламало б його заради косметики.
//
// Вільний ліміт живе тут же, під цілями: це не накопичення, але й не
// окремий розділ — домовленість пари про суму, яку можна витратити без
// узгодження, стоїть поруч із тим, на що вони збирають.
// ============================================================
import { FreeLimitCard } from './FreeLimitCard';
import { GoalsList } from './GoalsList';
import { PortalDecor } from '@/features/auth/PortalDecor';
import './budget.css';
import './financeLayoutFix.css';
import './goalDiscussionPolish.css';

export function PiggyBankPage() {
  return (
    <section className="budget pink-page">
      <PortalDecor density="light" parallax={false} />
      <h1 className="budget-title">Скарбничка</h1>
      <GoalsList />
      <FreeLimitCard />
    </section>
  );
}
