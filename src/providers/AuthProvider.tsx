// ============================================================
// AUTH PROVIDER — вибір користувача + PIN + тиха Supabase-сесія
// ------------------------------------------------------------
// Порт modules/auth.js у React-контекст. Логіка входу незмінна:
//   1) invokeFn('auth-pin', {user_id, pin}) — сервер звіряє PIN
//      (клієнт не бачить pin_hash) і рахує невдалі спроби;
//   2) на успіх — тихий signInWithPassword(email, sha256(pin)) для RLS;
//   3) стан користувача тримаємо тут, а не в DOM.
//
// Замість location.reload() при logout — скидаємо стан; RequireAuth
// сам зробить редірект на /login.
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase, invokeFn } from '@/lib/supabase';
import { toAppUser } from '@/lib/guards';
import type { AppUser } from '@/types';

const SESSION_KEY = 'portal_session_user_id';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Результат спроби входу — те, що PinPad показує користувачу. */
export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'error' }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number };

interface AuthContextValue {
  user: AppUser | null;
  status: AuthStatus;
  /** userId + 8-значний PIN. Не кидає — повертає структурований результат. */
  login: (userId: number, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  // Захист від подвійного авто-логіну в StrictMode (dev монтує двічі).
  const bootstrapped = useRef(false);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // ── Тиха Supabase-сесія для RLS ─────────────────────────────
  const signInSilently = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn('Supabase Auth login failed (RLS недоступний):', error.message);
      return false;
    }
    return true;
  }, []);

  // ── Вхід за PIN ─────────────────────────────────────────────
  const login = useCallback(
    async (userId: number, pin: string): Promise<LoginResult> => {
      let res;
      try {
        res = await invokeFn('auth-pin', { user_id: userId, pin });
      } catch (e) {
        console.error('auth-pin transport error:', e);
        return { ok: false, reason: 'error' };
      }

      if (res.ok) {
        if (!res.email || !(await signInSilently(res.email, res.password))) {
          clearLocalSession();
          return { ok: false, reason: 'error' };
        }

        // Ім'я валідуємо guard'ом, а не сліпим кастом.
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', userId)
          .single();
        const appUser = error ? null : toAppUser(data);
        if (!appUser) {
          await supabase.auth.signOut().catch(() => {});
          clearLocalSession();
          return { ok: false, reason: 'error' };
        }

        localStorage.setItem(SESSION_KEY, String(userId));
        setUser(appUser);
        setStatus('authenticated');
        return { ok: true };
      }

      // Гілка помилки union-відповіді auth-pin.
      if (res.error === 'locked') {
        return { ok: false, reason: 'locked', retryAfterSeconds: res.retryAfterSeconds ?? 900 };
      }
      if (res.error === 'invalid') return { ok: false, reason: 'invalid' };
      return { ok: false, reason: 'error' };
    },
    [clearLocalSession, signInSilently],
  );

  // ── Вихід ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    clearLocalSession();
  }, [clearLocalSession]);

  // Supabase може завершити сесію асинхронно, наприклад після невдалого
  // auto-refresh. Без listener UI лишався «залогіненим», а всі RPC падали.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        clearLocalSession();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearLocalSession]);

  // ── Авто-логін за живою Supabase-сесією ─────────────────────
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      const savedId = localStorage.getItem(SESSION_KEY);
      if (!savedId) {
        setStatus('unauthenticated');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        clearLocalSession();
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', Number(savedId))
        .single();

      const appUser = error ? null : toAppUser(data);
      if (!appUser) {
        clearLocalSession();
        return;
      }

      setUser(appUser);
      setStatus('authenticated');
    })().catch((err) => {
      // Мережевий збій під час автологіну — не зависаємо в loading назавжди.
      console.error('Auth: авто-логін впав', err);
      setStatus('unauthenticated');
    });
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Хук ───────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth має викликатись усередині <AuthProvider>');
  return ctx;
}

/**
 * Зручний хук для модулів, яким потрібен гарантовано залогінений
 * користувач (усі внутрішні сторінки під RequireAuth). Кидає, якщо
 * викликано поза автентифікованою зоною — це баг роутингу, не рантайм-стан.
 */
export function useCurrentUser(): AppUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser поза автентифікованою зоною');
  return user;
}
