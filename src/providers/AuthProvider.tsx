// ============================================================
// AUTH PROVIDER — пошта й пароль (ADR-0228) + старий вхід за PIN
// ------------------------------------------------------------
// ВХІД ЗА ПОШТОЮ (ADR-0228). Реєстрація: код із шести цифр на пошту
// (`signInWithOtp` → `verifyOtp`), потім пароль (`updateUser`). Вхід:
// `signInWithPassword`. Після будь-якого з них `portal-account` каже, чиє
// це місце в парі; лише член пари стає `authenticated` у цьому провайдері.
// Незнайомець лишається із сесією Supabase, але без доступу до даних —
// це тримає брама членства в базі, а не цей файл.
//
// ВХІД ЗА PIN (`login`) з екрана входу прибрано: обидва місця пари
// прив'язані до пошти. Лишився для `/register` — щойно створена пара
// заходить ним одразу, а пошту прив'язує при першому вході:
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
import type { AppUser, PortalSeat } from '@/types';

const SESSION_KEY = 'portal_session_user_id';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Результат спроби входу — те, що PinPad показує користувачу. */
export type LoginResult =
  | { ok: true; name?: string }
  | { ok: false; reason: 'invalid' | 'error' | 'moved_to_email' }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number };

/**
 * Куди веде акаунт за поштою після входу чи підтвердження (ADR-0228).
 * `claim` — місце в парі чекає, щоб його підтвердили старим PIN.
 */
export type LinkResult =
  | { ok: true; state: 'member' }
  | { ok: true; state: 'claim'; seats: PortalSeat[] }
  | { ok: true; state: 'empty' | 'taken' | 'new' }
  | { ok: false; reason: 'error' };

/** Створення нової пари: людина готова, але в портал ще не заведена. */
export type CreateCoupleResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: 'email_taken' | 'registration_closed' | 'bad_request' | 'error' };

/** Приєднання за кодом партнера (ADR-0232). Успіх одразу відчиняє портал. */
export type JoinCoupleResult =
  | { ok: true; user: AppUser }
  | {
      ok: false;
      reason: 'invite_invalid' | 'locked' | 'couple_full' | 'email_taken' | 'registration_closed' | 'bad_request' | 'error';
    };

export type EmailLoginResult =
  | LinkResult
  | { ok: false; reason: 'invalid_credentials' | 'email_unconfirmed' | 'rate_limited' };

export type CodeResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'not_found' | 'invalid_code' | 'error' };

export interface AuthContextValue {
  user: AppUser | null;
  status: AuthStatus;
  /** userId + 8-значний PIN. Не кидає — повертає структурований результат. */
  login: (userId: number, pin: string) => Promise<LoginResult>;
  /** Чи відкрита реєстрація нових акаунтів (рішення власника на сервері). */
  registrationOpen: () => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<EmailLoginResult>;
  /** Надсилає код із шести цифр; `create` — чи можна створити новий акаунт. */
  sendCode: (email: string, create: boolean) => Promise<CodeResult>;
  verifyCode: (email: string, code: string) => Promise<CodeResult>;
  setPassword: (password: string) => Promise<CodeResult>;
  /** Після пароля: чиє це місце. `member` одразу відчиняє портал. */
  linkAccount: () => Promise<LinkResult>;
  claimSeat: (userId: number, pin: string) => Promise<LoginResult>;
  /**
   * Нова пара (ADR-0230). Після успіху токен уже несе членство, тож можна
   * писати дані пари (минулі роки, вибір виду), — але портал ще не
   * відкрито: це робить `enterPortal`, коли реєстрація дійде до кінця.
   */
  createCouple: (v: { name: string; gender: 'male' | 'female'; startedAt: string }) => Promise<CreateCoupleResult>;
  /**
   * Друга людина пари за кодом (ADR-0232). Пара вже має історію й вид,
   * тож на успіх портал відчиняється одразу.
   */
  joinCouple: (v: { code: string; name: string; gender: 'male' | 'female' }) => Promise<JoinCoupleResult>;
  enterPortal: (user: AppUser) => void;
  logout: () => Promise<void>;
}

/**
 * Експортовано для лабораторій (`src/labs`), що малюють екран входу без
 * мережі й підставляють власне значення. Портал бере його лише через
 * `AuthProvider` і `useAuth`.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

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
      if (res.error === 'moved_to_email') return { ok: false, reason: 'moved_to_email' };
      return { ok: false, reason: 'error' };
    },
    [clearLocalSession, signInSilently],
  );

  // ── Пошта й пароль (ADR-0228) ──────────────────────────────
  const enter = useCallback((appUser: AppUser) => {
    localStorage.setItem(SESSION_KEY, String(appUser.id));
    setUser(appUser);
    setStatus('authenticated');
  }, []);

  const registrationOpen = useCallback(async (): Promise<boolean> => {
    try {
      const res = await invokeFn('portal-account', { action: 'ping' });
      return 'registration' in res && res.registration === 'open';
    } catch (e) {
      // Функція ще не розгорнута — реєстрація, отже, ще не відкрита.
      console.warn('portal-account ping:', e);
      return false;
    }
  }, []);

  const linkAccount = useCallback(async (): Promise<LinkResult> => {
    let res;
    try {
      res = await invokeFn('portal-account', { action: 'link' });
    } catch (e) {
      console.error('portal-account link transport error:', e);
      return { ok: false, reason: 'error' };
    }
    if (!res.ok || !('state' in res)) return { ok: false, reason: 'error' };
    if (res.state === 'member') {
      const appUser = toAppUser(res.user);
      if (!appUser) return { ok: false, reason: 'error' };
      // Токен міг бути виданий ще до того, як пошта стала членом пари, —
      // тоді хук дав роль аноніма. Свіжий токен несе вже `authenticated`.
      await supabase.auth.refreshSession().catch(() => {});
      enter(appUser);
      return { ok: true, state: 'member' };
    }
    if (res.state === 'claim') return { ok: true, state: 'claim', seats: res.seats };
    return { ok: true, state: res.state };
  }, [enter]);

  const createCouple = useCallback(async (
    v: { name: string; gender: 'male' | 'female'; startedAt: string },
  ): Promise<CreateCoupleResult> => {
    let res;
    try {
      res = await invokeFn('portal-account', {
        action: 'create', name: v.name.trim(), gender: v.gender, started_at: v.startedAt,
      });
    } catch (e) {
      console.error('portal-account create transport error:', e);
      return { ok: false, reason: 'error' };
    }
    if (res.ok && 'user' in res && !('state' in res)) {
      const appUser = toAppUser(res.user);
      if (!appUser) return { ok: false, reason: 'error' };
      // Пошта щойно стала членом пари: старий токен хук видав ще як
      // анонімний, і запис минулих років чи виду впав би на RLS.
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('refreshSession after create:', error);
        return { ok: false, reason: 'error' };
      }
      return { ok: true, user: appUser };
    }
    if (!res.ok && (res.error === 'email_taken' || res.error === 'registration_closed' || res.error === 'bad_request')) {
      return { ok: false, reason: res.error };
    }
    return { ok: false, reason: 'error' };
  }, []);

  const joinCouple = useCallback(async (
    v: { code: string; name: string; gender: 'male' | 'female' },
  ): Promise<JoinCoupleResult> => {
    let res;
    try {
      res = await invokeFn('portal-account', {
        action: 'join', code: v.code, name: v.name.trim(), gender: v.gender,
      });
    } catch (e) {
      console.error('portal-account join transport error:', e);
      return { ok: false, reason: 'error' };
    }
    if (res.ok && 'user' in res && !('state' in res)) {
      const appUser = toAppUser(res.user);
      if (!appUser) return { ok: false, reason: 'error' };
      // Як і після `create`: без свіжого токена хук тримав би роль аноніма.
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('refreshSession after join:', error);
        return { ok: false, reason: 'error' };
      }
      enter(appUser);
      return { ok: true, user: appUser };
    }
    if (!res.ok) {
      switch (res.error) {
        case 'invite_invalid':
        case 'locked':
        case 'couple_full':
        case 'email_taken':
        case 'registration_closed':
        case 'bad_request':
          return { ok: false, reason: res.error };
      }
    }
    return { ok: false, reason: 'error' };
  }, [enter]);

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<EmailLoginResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed') return { ok: false, reason: 'email_unconfirmed' };
      if (error.code === 'over_request_rate_limit') return { ok: false, reason: 'rate_limited' };
      if (error.code === 'invalid_credentials' || error.status === 400) return { ok: false, reason: 'invalid_credentials' };
      console.error('signInWithPassword:', error);
      return { ok: false, reason: 'error' };
    }
    return linkAccount();
  }, [linkAccount]);

  const sendCode = useCallback(async (email: string, create: boolean): Promise<CodeResult> => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: create } });
    if (!error) return { ok: true };
    if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || error.status === 429) {
      return { ok: false, reason: 'rate_limited' };
    }
    // Без дозволу створювати акаунт Supabase відмовляє незнайомій пошті.
    if (error.code === 'otp_disabled' || error.code === 'signup_disabled' || error.code === 'user_not_found') {
      return { ok: false, reason: 'not_found' };
    }
    console.error('signInWithOtp:', error);
    return { ok: false, reason: 'error' };
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<CodeResult> => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (!error) return { ok: true };
    if (error.code === 'otp_expired' || error.status === 403 || error.status === 400) return { ok: false, reason: 'invalid_code' };
    if (error.status === 429) return { ok: false, reason: 'rate_limited' };
    console.error('verifyOtp:', error);
    return { ok: false, reason: 'error' };
  }, []);

  const setPassword = useCallback(async (password: string): Promise<CodeResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { ok: true };
    console.error('updateUser password:', error);
    return { ok: false, reason: 'error' };
  }, []);

  const claimSeat = useCallback(async (userId: number, pin: string): Promise<LoginResult> => {
    let res;
    try {
      res = await invokeFn('portal-account', { action: 'claim', user_id: userId, pin });
    } catch (e) {
      console.error('portal-account claim transport error:', e);
      return { ok: false, reason: 'error' };
    }
    if (res.ok && 'user' in res && !('state' in res)) {
      const appUser = toAppUser(res.user);
      if (!appUser) return { ok: false, reason: 'error' };
      // Пошта щойно стала членом пари: без свіжого токена хук тримав би
      // роль аноніма, і перший же запит до даних повернув би порожнечу.
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('refreshSession after claim:', error);
        return { ok: false, reason: 'error' };
      }
      enter(appUser);
      return { ok: true, name: appUser.name };
    }
    if (!res.ok && res.error === 'locked') {
      return { ok: false, reason: 'locked', retryAfterSeconds: res.retryAfterSeconds ?? 900 };
    }
    if (!res.ok && res.error === 'invalid') return { ok: false, reason: 'invalid' };
    return { ok: false, reason: 'error' };
  }, [enter]);

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
        // Сесія за поштою без збереженого місця (інший пристрій, очищене
        // сховище): питаємо базу, чиє це місце, а не вгадуємо.
        const {
          data: { session: live },
        } = await supabase.auth.getSession();
        if (live) {
          const { data: me } = await supabase.rpc('portal_me');
          const appUser = Array.isArray(me) ? toAppUser(me[0]) : null;
          if (appUser) {
            localStorage.setItem(SESSION_KEY, String(appUser.id));
            setUser(appUser);
            setStatus('authenticated');
            return;
          }
        }
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
    () => ({
      user, status, login, logout,
      registrationOpen, loginWithEmail, sendCode, verifyCode, setPassword, linkAccount, claimSeat,
      createCouple, joinCouple, enterPortal: enter,
    }),
    [user, status, login, logout, registrationOpen, loginWithEmail, sendCode, verifyCode, setPassword, linkAccount, claimSeat, createCouple, joinCouple, enter],
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
