import { useEffect, useState } from 'react';
import { PiggyBankIcon } from '@/components/icons/NavIcon';
import { fmtMoney } from './useBudget';
import { usePiggyBank, usePiggyBankMutations } from './usePiggyBank';
import './piggyBankBalance.css';

export function PiggyBankCard() {
  const { data, isPending, isError, refetch } = usePiggyBank();
  const { setBalance } = usePiggyBankMutations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) return;
    setDraft(data ? String(data.balance) : '0');
  }, [editing, data]);

  const amount = Number(draft.trim().replace(/\s/g, '').replace(',', '.'));
  const valid = Number.isFinite(amount) && amount >= 0;

  const save = () => {
    if (!valid || setBalance.isPending) return;
    setBalance.mutate(
      { balance: amount, expectedUpdatedAt: data?.updatedAt ?? null },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <section className="piggy-balance" aria-labelledby="piggy-balance-title">
      <header className="piggy-balance-head">
        <span className="piggy-balance-icon" aria-hidden="true"><PiggyBankIcon size={28} /></span>
        <div>
          <span className="piggy-balance-eyebrow">Спільні відкладені гроші</span>
          <h2 id="piggy-balance-title">Скарбничка</h2>
        </div>
      </header>

      {isPending ? (
        <div className="piggy-balance-state">Завантаження…</div>
      ) : isError ? (
        <div className="piggy-balance-state" role="alert">
          <span>Не вдалося завантажити суму.</span>
          <button type="button" onClick={() => void refetch()}>Спробувати ще</button>
        </div>
      ) : (
        <>
          <strong className="piggy-balance-amount">{fmtMoney(data?.balance ?? 0)}</strong>
          <p className="piggy-balance-copy">
            Це всі гроші, які ви разом відклали. Конкретні подорожі, покупки й інші цілі живуть у «Планах».
          </p>
          {data?.updatedByName && (
            <small className="piggy-balance-updated">Остання зміна: {data.updatedByName}</small>
          )}
          <button type="button" className="piggy-balance-edit" onClick={() => setEditing(true)}>
            Змінити суму
          </button>
        </>
      )}

      {editing && (
        <div
          className="modal-overlay piggy-balance-overlay"
          onClick={(event) => event.target === event.currentTarget && !setBalance.isPending && setEditing(false)}
        >
          <div className="modal-sheet piggy-balance-sheet" role="dialog" aria-modal="true" aria-labelledby="piggy-edit-title">
            <span className="piggy-balance-modal-icon" aria-hidden="true"><PiggyBankIcon size={26} /></span>
            <h2 id="piggy-edit-title" className="modal-title">Скільки зараз у скарбничці?</h2>
            <p>Вкажи загальну суму всіх спільних відкладених грошей.</p>
            <label className="form-field">
              <span>Загальна сума, ₴</span>
              <input
                id="piggy-bank-balance"
                name="balance"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') save(); }}
                placeholder="0"
                autoFocus
                disabled={setBalance.isPending}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={setBalance.isPending}>
                Скасувати
              </button>
              <button type="button" className="btn" onClick={save} disabled={!valid || setBalance.isPending}>
                {setBalance.isPending ? 'Зберігаю…' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
