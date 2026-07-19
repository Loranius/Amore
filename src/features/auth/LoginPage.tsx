// ============================================================
// LoginPage — вибір користувача + PIN («Pink Portal» дизайн)
// ------------------------------------------------------------
// Флоу лишається тим самим (вибір → 8 цифр → успіх/помилка/locked),
// лише візуал: градієнтний рожевий фон з декором (PortalDecor),
// картка зі склом, Fredoka/Nunito. "Портал відкрито"-екран з
// хендофу свідомо не реалізований: RedirectIfAuthed одразу
// перемикає на / щойно useAuth().status стає 'authenticated' —
// щоб показати проміжний celebratory-екран, довелось би штучно
// затримувати сам редірект в auth-гварді, а це вже зміна
// безпекочутливого флоу входу, не суто візуальна правка.
// ============================================================
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { PortalDecor } from './PortalDecor';
import type { AppUser } from '@/types';

export function LoginPage() {
  const { login } = useAuth();
  const { data: users, isPending, isError } = useUsers();

  const [selected, setSelected] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const submit = async (userId: number, fullPin: string) => {
    const res = await login(userId, fullPin);
    if (res.ok) return; // RequireAuth перемкне на /
    if (res.reason === 'locked') {
      const mins = Math.max(1, Math.ceil(res.retryAfterSeconds / 60));
      setError(`Забагато спроб, спробуй через ${mins} хв`);
    } else {
      setError('Невірний PIN, спробуй ще');
    }
    setShake(true);
    setPin('');
  };

  const press = (digit: string) => {
    if (!selected || pin.length >= 8) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 8) void submit(selected.id, next);
  };

  if (isPending) {
    return (
      <div className="auth-screen">
        <div className="auth-card">Завантаження…</div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="empty-state">Не вдалось завантажити користувачів. Перевір Supabase.</p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="auth-screen">
        <PortalDecor />
        <div className="auth-card">
          <div className="auth-kicker">Amore</div>
          <h1 className="auth-title">Хто сьогодні заходить у портал? 💗</h1>
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
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <PortalDecor />
      <div className={`auth-card${shake ? ' shake' : ''}`}>
        <div className="auth-kicker">Amore</div>
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
            className="pin-key pin-key--dim"
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
            className="pin-key pin-key--dim"
            onClick={() => {
              setPin('');
              setError(null);
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
