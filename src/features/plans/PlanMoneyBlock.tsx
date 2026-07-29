// ============================================================
// Гроші плану: очікувана вартість + загальна скарбничка.
// ------------------------------------------------------------
// План більше не створює фінансову «ціль» і не резервує гроші. Він лише
// зберігає, скільки може коштувати, та показує поточну спільну заначку
// для орієнтиру.
// ============================================================
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBankIcon } from '@/components/icons/NavIcon';
import { fmtMoney } from '@/features/piggybank/useBudget';
import { usePiggyBank } from '@/features/piggybank/usePiggyBank';
import { usePlanMutations } from './usePlans';
import './planMoneyBalance.css';
import type { PlanRow } from '@/types';

export function PlanMoneyBlock({ plan, accent, embedded = false }: {
  plan: PlanRow;
  accent: string;
  embedded?: boolean;
}) {
  const { data: piggyBank, isPending: piggyPending } = usePiggyBank();
  const { updatePlan } = usePlanMutations();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  const budget = plan.budget === null ? null : Math.max(0, Number(plan.budget));
  const saved = Math.max(0, Number(piggyBank?.balance ?? 0));
  const gap = budget === null ? null : Math.max(0, budget - saved);
  const enough = budget !== null && saved >= budget;
  const comparisonStyle = { '--plan-money-accent': accent } as CSSProperties;

  const saveBudget = () => {
    const raw = budgetDraft.trim().replace(/\s/g, '').replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    updatePlan.mutate({ id: plan.id, patch: { budget: value } });
    setEditingBudget(false);
  };

  return (
    <section className={`plan-money${embedded ? ' plan-money--embedded' : ''}`}>
      <header className="plan-money-head">
        {!embedded && <h3>Гроші</h3>}
        {!editingBudget && (
          <button
            type="button"
            className="plan-money-budget-btn"
            onClick={() => {
              setBudgetDraft(plan.budget === null ? '' : String(plan.budget));
              setEditingBudget(true);
            }}
          >
            {plan.budget === null ? 'Додати бюджет' : `Змінити бюджет · ${fmtMoney(plan.budget)}`}
          </button>
        )}
      </header>

      {editingBudget && (
        <div className="plan-money-editor">
          <label className="form-field">
            <span>Скільки це може коштувати</span>
            <input
              id={`plan-budget-${plan.id}`}
              name="budget"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={budgetDraft}
              placeholder="Порожньо — ще не рахували"
              onChange={(event) => setBudgetDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') saveBudget(); }}
            />
          </label>
          <div className="plan-money-editor-actions">
            <button type="button" className="btn" onClick={saveBudget} disabled={updatePlan.isPending}>
              {updatePlan.isPending ? 'Зберігаю…' : 'Зберегти'}
            </button>
            <button type="button" className="plan-money-cancel" onClick={() => setEditingBudget(false)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      <Link className="plan-money-piggy" to="/piggybank" style={comparisonStyle}>
        <span className="plan-money-piggy-icon" aria-hidden="true"><PiggyBankIcon size={20} /></span>
        <span>
          <small>Зараз у скарбничці</small>
          <strong>{piggyPending ? 'Завантаження…' : fmtMoney(saved)}</strong>
        </span>
      </Link>

      {budget === null ? (
        <p className="plan-money-empty">Вкажи приблизну вартість плану, коли вона стане зрозумілою.</p>
      ) : (
        <div className={`plan-money-comparison${enough ? ' is-enough' : ''}`}>
          <div className="plan-money-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, budget > 0 ? (saved / budget) * 100 : 100)}%`, background: accent }} />
          </div>
          <p className="plan-money-sum">
            План: <b>{fmtMoney(budget)}</b>
            {enough ? <> · у скарбничці достатньо</> : gap !== null ? <> · не вистачає {fmtMoney(gap)}</> : null}
          </p>
        </div>
      )}

      <p className="plan-money-hint">
        Сума зі скарбнички показана лише для орієнтиру й не резервується під цей план автоматично.
      </p>
    </section>
  );
}
