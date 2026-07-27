import type { DateRow } from '@/types';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { fmtDatePlanDate } from './scheduleViewModel';

export function ScheduleDatePlans({ plans, meName, onConfirm, onRemove }: {
  plans: DateRow[];
  meName: string;
  onConfirm: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  if (plans.length === 0) return null;
  return (
    <div className="date-plans">
      <h2 className="date-plans-title">Заплановані побачення</h2>
      {plans.map((plan) => (
        <ProposalCard
          key={plan.id}
          pending={plan.status === 'pending'}
          proposedBy={plan.proposed_by}
          meName={meName}
          onConfirm={() => onConfirm(plan.id)}
          onReject={() => onRemove(plan.id)}
          onDelete={() => onRemove(plan.id)}
          deleteConfirmMessage="Видалити побачення?"
          info={
            <>
              <span className="date-plan-card-title">{plan.title}</span>
              <span className="date-plan-card-date">📅 {fmtDatePlanDate(plan.date)}{plan.time ? ` · ${plan.time.slice(0, 5)}` : ''}</span>
              {plan.place && <span className="date-plan-card-place">📍 {plan.place}</span>}
              {plan.description && <span className="date-plan-card-desc">{plan.description}</span>}
              {plan.url && <a className="date-plan-card-link" href={plan.url} target="_blank" rel="noopener noreferrer">🔗</a>}
            </>
          }
        />
      ))}
    </div>
  );
}
