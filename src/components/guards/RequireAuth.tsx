// ============================================================
// RequireAuth — захист внутрішніх роутів
// ------------------------------------------------------------
// Не пускає на внутрішні сторінки без валідної Supabase-сесії та
// обраного профілю (як робив старий auth.js через приховування DOM,
// але тепер — редіректом на /login). Поки триває авто-логін —
// показуємо boot-екран, щоб не мигнути /login при живій сесії на F5.
// ============================================================
import { useRef, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type AuthStatus } from '@/providers/AuthProvider';
import { BootScreen } from '@/components/ui/BootScreen';

export function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') return <BootScreen />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;

  return <Outlet />;
}

/** Скільки тримаємо LoginPage на екрані після успіху, щоб дограти
 * "портал відкрито"-анімацію, перш ніж реально редіректнути на /. */
const SUCCESS_HOLD_MS = 900;

/**
 * Зворотний бік: /login недоступний уже залогіненому — редірект на
 * головну (інакше кнопка «назад» кидала б на екран входу).
 *
 * Виняток: щойно СЬОГОДНІ (в цьому монтуванні) відбувся живий перехід
 * unauthenticated → authenticated (реальний вхід за PIN, не авто-логін
 * за старою сесією й не вже залогінений на монтуванні) — тримаємо
 * LoginPage ще SUCCESS_HOLD_MS, щоб її локальний "портал відкрито"-екран
 * встиг дограти. Сама перевірка PIN (auth-pin, rate-limit) у
 * AuthProvider.login() при цьому НЕ змінюється й НЕ затримується —
 * затримка лише тут, суто косметична, для UI-переходу.
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const prevStatusRef = useRef<AuthStatus>(status);
  const authedAtRef = useRef<number | null>(null);
  const [, forceRerender] = useState(0);

  const prevStatus = prevStatusRef.current;
  if (status === 'authenticated' && prevStatus === 'unauthenticated' && authedAtRef.current === null) {
    authedAtRef.current = Date.now();
    setTimeout(() => forceRerender((n) => n + 1), SUCCESS_HOLD_MS);
  }
  prevStatusRef.current = status;

  if (status === 'loading') return <BootScreen />;

  const holding =
    status === 'authenticated' &&
    authedAtRef.current !== null &&
    Date.now() - authedAtRef.current < SUCCESS_HOLD_MS;

  if (status === 'authenticated' && !holding) return <Navigate to="/" replace />;

  return <>{children}</>;
}
