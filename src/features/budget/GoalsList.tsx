// ============================================================
// GoalsList — спільні цілі (порт renderGlobalGoals/paintGoals)
// ------------------------------------------------------------
// pending: очікує голосу партнера (він бачить ✓/✕). confirmed:
// прогрес-бар + «Внести». Видалення — своя pending або будь-яка
// підтверджена.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { fmtMoney, useGoals, useGoalMutations, type NewGoalInput } from './useBudget';
import type { SavingsGoalRow } from '@/types';

export function GoalsList() {
  const me = useCurrentUser();
  const { data: goals = [], isPending } = useGoals();
  const { add, confirm, remove, addFunds } = useGoalMutations();

  const [adding, setAdding] = useState(false);
  const [funding, setFunding] = useState<SavingsGoalRow | null>(null);

  const partnerGen = me.name === 'Діма' ? 'Лєни' : 'Діми';

  return (
    <div className="fin-card">
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
            const canVote = pending && g.proposed_by !== me.name;
            const target = g.target_amount ?? 0;
            const saved = Math.max(0, g.saved_amount ?? 0);
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            const canDelete = !pending || g.proposed_by === me.name;

            return (
              <div key={g.id} className={`goal-row${pending ? ' goal-pending' : ''}`}>
                <div className="goal-row-info">
                  <span className="goal-row-name">{g.name}</span>
                  {g.description && <span className="goal-row-desc">{g.description}</span>}
                  {g.url && (
                    <a className="goal-row-link" href={g.url} target="_blank" rel="noopener noreferrer">
                      🔗
                    </a>
                  )}
                  {pending && <span className="goal-status-badge">⏳ Очікує {partnerGen}</span>}
                  {g.status === 'confirmed' && (
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
                  )}
                </div>

                <div className="goal-row-right">
                  <span className="goal-row-price">{fmtMoney(target)}</span>
                  {canVote && (
                    <div className="goal-vote-btns">
                      <button type="button" className="btn goal-vote-yes" onClick={() => confirm.mutate(g.id)}>
                        ✓
                      </button>
                      <button
                        type="button"
                        className="btn-secondary goal-vote-no"
                        onClick={() => window.confirm('Відхилити?') && remove.mutate(g.id)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {g.status === 'confirmed' && (
                    <button type="button" className="btn-secondary goal-add-funds-btn" onClick={() => setFunding(g)}>
                      + Внести
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="fin-del-btn"
                      onClick={() => window.confirm('Видалити?') && remove.mutate(g.id)}
                      aria-label="Видалити"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddGoalModal onClose={() => setAdding(false)} onSubmit={(v) => add.mutate(v)} />}
      {funding && (
        <AddFundsModal
          goal={funding}
          onClose={() => setFunding(null)}
          onSubmit={(amount) =>
            addFunds.mutate({ id: funding.id, current: Math.max(0, funding.saved_amount ?? 0), amount })
          }
        />
      )}
    </div>
  );
}

// ── Модалка: нова ціль ───────────────────────────────────────
function AddGoalModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (v: NewGoalInput) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');

  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSubmit({
      name: n,
      description: description.trim() || null,
      target_amount: parseFloat(price) || 0,
      url: url.trim() || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Спільна ціль</h2>
        <label className="form-field">
          <span>Назва</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Що плануємо?" autoFocus />
        </label>
        <label className="form-field">
          <span>Навіщо</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опис" />
        </label>
        <label className="form-field">
          <span>Вартість, ₴</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </label>
        <label className="form-field">
          <span>Посилання</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!name.trim()}>
            Відправити →
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
  goal: SavingsGoalRow;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const saved = Math.max(0, goal.saved_amount ?? 0);

  const save = () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    onSubmit(v);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Внесок у ціль</h2>
        <p className="fin-hint">
          «{goal.name}» — накопичено {fmtMoney(saved)} з {fmtMoney(goal.target_amount)}
        </p>
        <label className="form-field">
          <span>Сума внеску, ₴</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0 ₴"
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!parseFloat(amount)}>
            Додати
          </button>
        </div>
      </div>
    </div>
  );
}
