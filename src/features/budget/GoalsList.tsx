// ============================================================
// GoalsList — спільні цілі
// ------------------------------------------------------------
// pending: очікує голосу партнера. confirmed: прогрес + внесок.
// Модалки закриваються лише після успішної відповіді сервера.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { ProposalCard } from '@/components/ui/ProposalCard';
import {
  fmtMoney,
  useGoals,
  useGoalMutations,
  type BudgetGoalRow,
  type NewGoalInput,
} from './useBudget';

export function GoalsList() {
  const me = useCurrentUser();
  const { data: goals = [], isPending } = useGoals();
  const { add, confirm, reject, remove, addFunds } = useGoalMutations();

  const [adding, setAdding] = useState(false);
  const [funding, setFunding] = useState<BudgetGoalRow | null>(null);

  return (
    <Card className="fin-card">
      <div className="fin-card-hdr">
        <span className="fin-card-title">🎯 Спільні цілі</span>
        <button type="button" className="btn fin-add-goal-btn" onClick={() => setAdding(true)}>
          + Ціль
        </button>
      </div>

      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : goals.length === 0 ? (
        <p className="empty-state">Спільних цілей ще немає.</p>
      ) : (
        <div className="goals-list">
          {goals.map((g) => {
            const pending = g.status === 'pending';
            const target = Number(g.target_amount ?? 0);
            const saved = Math.max(0, Number(g.saved_amount ?? 0));
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

            return (
              <ProposalCard
                key={g.id}
                pending={pending}
                proposedBy={g.proposed_by ?? ''}
                meName={me.name}
                onConfirm={() => confirm.mutate(g.id)}
                onReject={() => reject.mutate(g.id)}
                onDelete={() => remove.mutate(g.id)}
                info={
                  <>
                    <span className="goal-row-name">{g.name}</span>
                    {g.description && <span className="goal-row-desc">{g.description}</span>}
                    {g.url && (
                      <a className="goal-row-link" href={g.url} target="_blank" rel="noopener noreferrer">
                        🔗
                      </a>
                    )}
                  </>
                }
                badge={
                  g.status === 'confirmed' ? (
                    <>
                      <span className="goal-status-badge goal-confirmed">✅ Підтверджено</span>
                      <div className="goal-progress-wrap">
                        <div className="goal-progress-bar">
                          <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="goal-progress-meta">
                          <span>
                            {fmtMoney(saved)} / {fmtMoney(target)}
                          </span>
                          <span className="goal-progress-pct">{pct}%</span>
                        </div>
                      </div>
                    </>
                  ) : undefined
                }
                extraActions={
                  <>
                    <span className="goal-row-price">{fmtMoney(target)}</span>
                    {g.status === 'confirmed' && (
                      <button
                        type="button"
                        className="btn-secondary goal-add-funds-btn"
                        onClick={() => setFunding(g)}
                      >
                        + Внести
                      </button>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {adding && (
        <AddGoalModal
          onClose={() => setAdding(false)}
          onSubmit={(value) => add.mutateAsync(value)}
        />
      )}
      {funding && (
        <AddFundsModal
          goal={funding}
          onClose={() => setFunding(null)}
          onSubmit={(amount) => addFunds.mutateAsync({ id: funding.id, amount })}
        />
      )}
    </Card>
  );
}

// ── Модалка: нова ціль ───────────────────────────────────────
function AddGoalModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (value: NewGoalInput) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetAmount = Number(price);
  const validTarget = Number.isFinite(targetAmount) && targetAmount > 0;

  const save = async () => {
    const normalizedName = name.trim();
    if (!normalizedName || !validTarget || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: normalizedName,
        description: description.trim() || null,
        target_amount: targetAmount,
        url: url.trim() || null,
      });
      onClose();
    } catch {
      // useGoalMutations уже показує тост; дані форми лишаються на місці.
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Спільна ціль</h2>
        <label className="form-field">
          <span>Назва</span>
          <input
            id="goal-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Що плануємо?"
            autoFocus
          />
        </label>
        <label className="form-field">
          <span>Навіщо</span>
          <input
            id="goal-description"
            name="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опис"
          />
        </label>
        <label className="form-field">
          <span>Вартість, ₴</span>
          <input
            id="goal-price"
            name="price"
            type="number"
            min={1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="form-field">
          <span>Посилання</span>
          <input
            id="goal-url"
            name="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={submitting || !name.trim() || !validTarget}
          >
            {submitting ? 'Надсилаємо…' : 'Відправити →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Модалка: внесок ──────────────────────────────────────────
function AddFundsModal({
  goal,
  onClose,
  onSubmit,
}: {
  goal: BudgetGoalRow;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const saved = Math.max(0, Number(goal.saved_amount ?? 0));
  const contribution = Number(amount);
  const validContribution = Number.isFinite(contribution) && contribution > 0;

  const save = async () => {
    if (!validContribution || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(contribution);
      onClose();
    } catch {
      // Тост показує mutation; поле не очищаємо, щоб суму можна було повторити.
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Внесок у ціль</h2>
        <p className="fin-hint">
          «{goal.name}» — накопичено {fmtMoney(saved)} з {fmtMoney(goal.target_amount)}
        </p>
        <label className="form-field">
          <span>Сума внеску, ₴</span>
          <input
            id="goal-funds-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0 ₴"
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={submitting || !validContribution}
          >
            {submitting ? 'Додаємо…' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}
