// ============================================================
// LoginPage — вибір користувача + PIN («Pink Portal» дизайн)
// ------------------------------------------------------------
// Флоу: вибір → пін-пад → успіх (портал-вайп + конфеті) / помилка
// (shake) / locked. Сам вхід (auth-pin, rate-limit) — без змін у
// AuthProvider.login(). "Портал відкрито" встигає дограти завдяки
// короткій, суто косметичній затримці редіректу в
// RequireAuth.tsx → RedirectIfAuthed (SUCCESS_HOLD_MS) — вона не
// впливає на саму перевірку PIN, лише на момент, коли роутер
// фактично перемикає на /.
// ============================================================
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { PortalDecor, PortalConfetti } from './PortalDecor';
import type { AppUser } from '@/types';

type Screen = 'select' | 'pin' | 'portal';

export function LoginPage() {
  const { login } = useAuth();
  const { data: users, isPending, isError } = useUsers();

  const [screen, setScreen] = useState<Screen>('select');
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
    if (res.ok) {
      setScreen('portal'); // RequireAuth тримає нас тут ще мить, потім сам перемкне на /
      return;
    }
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

  const restart = () => {
    setScreen('select');
    setSelected(null);
    setPin('');
    setError(null);
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

  if (screen === 'select') {
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
                  setScreen('pin');
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

  if (screen === 'portal') {
    return (
      <div className="auth-screen">
        <PortalDecor />
        <PortalConfetti />
        <div className="auth-card">
          <div className="auth-success-heart" aria-hidden="true" />
          <h1 className="auth-success-title">Портал відкрито, {selected?.name} 💗</h1>
          <p className="auth-success-sub">Ласкаво просимо додому</p>
          <button type="button" className="auth-success-btn" onClick={restart}>
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <PortalDecor />
      <div className={`auth-card${shake ? ' shake' : ''}`}>
        <div className="auth-kicker">Amore</div>
        <h1 className="auth-title">{selected?.name}</h1>

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
              setScreen('select');
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
