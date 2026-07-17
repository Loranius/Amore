// ============================================================
// RequireAuth — захист внутрішніх роутів
// ------------------------------------------------------------
// Не пускає на внутрішні сторінки без валідної Supabase-сесії та
// обраного профілю (як робив старий auth.js через приховування DOM,
// але тепер — редіректом на /login). Поки триває авто-логін —
// показуємо boot-екран, щоб не мигнути /login при живій сесії на F5.
// ============================================================
import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { BootScreen } from '@/components/ui/BootScreen';

export function RequireAuth() {
  const { status } = useAuth();

  if (status === 'loading') return <BootScreen />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;

  return <Outlet />;
}

/**
 * Зворотний бік: /login недоступний уже залогіненому — редірект на
 * головну (інакше кнопка «назад» кидала б на екран входу).
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <BootScreen />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  return <>{children}</>;
}
