// ============================================================
// LoginPage — вибір користувача + PIN (порт auth-екрану)
// ------------------------------------------------------------
// Робочий каркас Кроку 3: тягне список користувачів через React
// Query, викликає useAuth().login(). Візуальне полірування пін-паду —
// у Кроці 4, але флоу (вибір → 8 цифр → locked/invalid) уже живий.
// ============================================================
import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import type { AppUser } from '@/types';

export function LoginPage() {
  const { login } = useAuth();
  const { data: users, isPending, isError } = useUsers();

  const [selected, setSelected] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (userId: number, fullPin: string) => {
    const res = await login(userId, fullPin);
    if (res.ok) return; // RequireAuth перемкне на /
    if (res.reason === 'locked') {
      const mins = Math.max(1, Math.ceil(res.retryAfterSeconds / 60));
      setError(`Забагато спроб, спробуй через ${mins} хв`);
    } else {
      setError('Невірний PIN, спробуй ще');
    }
    setPin('');
  };

  const press = (digit: string) => {
    if (!selected || pin.length >= 8) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 8) void submit(selected.id, next);
  };

  if (isPending) return <div className="auth-screen">Завантаження…</div>;
  if (isError) {
    return (
      <div className="auth-screen">
        <p className="empty-state">Не вдалось завантажити користувачів. Перевір Supabase.</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="auth-screen">
        <h1 className="auth-title">Хто ти?</h1>
        <div className="user-select">
          {users?.map((u) => (
            <button
              key={u.id}
              type="button"
              className="user-btn"
              onClick={() => {
                setSelected(u);
                setPin('');
                setError(null);
              }}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <h1 className="auth-title">{selected.name}</h1>

      <div className="pin-dots" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`pin-dot${i < pin.length ? ' filled' : ''}${error ? ' error' : ''}`}
          />
        ))}
      </div>
      {error && <p className="pin-error">{error}</p>}

      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="pin-key"
          onClick={() => {
            setSelected(null);
            setPin('');
            setError(null);
          }}
        >
          ‹
        </button>
        <button type="button" className="pin-key" onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className="pin-key"
          onClick={() => {
            setPin('');
            setError(null);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
