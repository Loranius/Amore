// ============================================================
// LoginPage — вхід і реєстрація за поштою (ADR-0228)
// ------------------------------------------------------------
// Дві вкладки, як попросив власник:
//   • «Вхід» — пошта й пароль;
//   • «Реєстрація» — пошта → код із шести цифр із листа → пароль двічі.
// Після пароля `portal-account` каже, чиє це місце: член пари заходить
// одразу; місце, що чекає на пошту (Діма й Лєна до першого входу), треба
// підтвердити старим PIN — так пошта прив'язується до наявної історії, і
// жоден рядок у базі не губиться.
//
// Вхід за PIN прибрано з цього екрана (власник, 2026-09-28): обидва місця
// пари прив'язані до пошти. PIN лишився одноразовим — ним підтверджують
// місце при першому вході поштою.
//
// На тлі — три летючі острівці з кристалом, деревом і рифом, щоразу інші
// (`AuthIslands.tsx`), вантажаться ліниво: вхід від них не чекає.
// ============================================================
import { Suspense, lazy, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type LinkResult } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import type { PortalSeat } from '@/types';
import { PortalConfetti } from './PortalConfetti';
import {
  CODE_RE,
  GENDER_TEXT,
  seatForGender,
  type SeatGender,
  PASSWORD_PROBLEM_TEXT,
  PASSWORD_RULES,
  isEmail,
  normaliseEmail,
  passwordProblems,
} from './accountRules';
import './register.css';
import './login.css';

const AuthIslands = lazy(() => import('./AuthIslands'));

type Tab = 'login' | 'register';
type Step =
  | { kind: 'form' }
  | { kind: 'code'; email: string }
  | { kind: 'password' }
  | { kind: 'claim'; seats: PortalSeat[] }
  | { kind: 'claim-pin'; seat: PortalSeat; seats: PortalSeat[] }
  | { kind: 'empty' }
  | { kind: 'taken' }
  | { kind: 'portal'; name: string };

/** Скільки чекати перед повторним листом — межа Supabase на відправку. */
const RESEND_SECONDS = 60;

export function LoginPage() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>('login');
  const [step, setStep] = useState<Step>({ kind: 'form' });

  const switchTab = (next: Tab) => {
    setTab(next);
    setStep({ kind: 'form' });
  };

  return (
    <div className="auth-screen">
      <Suspense fallback={null}>
        <AuthIslands theme={theme === 'light' ? 'light' : 'dark'} />
      </Suspense>
      {step.kind === 'portal' && <PortalConfetti />}
      <div className="auth-card auth-card--account">
        <div className="auth-kicker">Amore</div>
        {step.kind === 'form' && (
          <div className="auth-tabs" role="tablist" aria-label="Вхід чи реєстрація">
            <button type="button" role="tab" aria-selected={tab === 'login'} className="auth-tab" onClick={() => switchTab('login')}>
              Вхід
            </button>
            <button type="button" role="tab" aria-selected={tab === 'register'} className="auth-tab" onClick={() => switchTab('register')}>
              Реєстрація
            </button>
          </div>
        )}
        <Flow tab={tab} step={step} setStep={setStep} switchTab={switchTab} />
      </div>
    </div>
  );
}

interface FlowProps {
  tab: Tab;
  step: Step;
  setStep: (step: Step) => void;
  switchTab: (tab: Tab) => void;
}

function Flow({ tab, step, setStep, switchTab }: FlowProps) {
  const { linkAccount, logout } = useAuth();

  /** Куди вести після входу чи пароля — один вузол для обох вкладок. */
  const follow = (result: LinkResult, name?: string) => {
    if (!result.ok) return 'Не вдалося зʼєднатися з порталом. Спробуй ще раз.';
    if (result.state === 'member') setStep({ kind: 'portal', name: name ?? '' });
    else if (result.state === 'claim') setStep({ kind: 'claim', seats: result.seats });
    else setStep({ kind: result.state });
    return null;
  };

  switch (step.kind) {
    case 'form':
      return tab === 'login'
        ? <LoginForm follow={follow} onForgot={() => switchTab('register')} />
        : <EmailForm onSent={(email) => setStep({ kind: 'code', email })} />;
    case 'code':
      return <CodeForm email={step.email} onVerified={() => setStep({ kind: 'password' })} onBack={() => setStep({ kind: 'form' })} />;
    case 'password':
      return <PasswordForm onSaved={async () => follow(await linkAccount())} />;
    case 'claim':
      return (
        <GenderPicker
          onPick={(gender) => {
            const seat = seatForGender(step.seats, gender);
            // Місця такої статі немає — отже, це не ваш портал.
            setStep(seat ? { kind: 'claim-pin', seat, seats: step.seats } : { kind: 'taken' });
          }}
        />
      );
    case 'claim-pin':
      return (
        <ClaimPin
          seat={step.seat}
          onDone={(name) => setStep({ kind: 'portal', name })}
          onBack={() => setStep({ kind: 'claim', seats: step.seats })}
          onNoPin={() => setStep({ kind: 'taken' })}
        />
      );
    case 'empty':
      return (
        <>
          <h1 className="auth-title">Тут ще нікого немає</h1>
          <p className="reg-hint">Портал чекає на свою пару. Створіть його: імена, PIN і день, з якого ви разом.</p>
          <Link className="btn reg-next" to="/register">Створити портал</Link>
        </>
      );
    case 'taken':
      return (
        <>
          <h1 className="auth-title">Цей портал уже має пару</h1>
          <p className="reg-hint">
            Акаунт створено, але цей портал належить іншим двом людям, і їхні спогади бачать лише вони.
          </p>
          <button type="button" className="btn btn-ghost reg-back" onClick={() => { void logout(); setStep({ kind: 'form' }); }}>
            Вийти
          </button>
        </>
      );
    case 'portal':
      return (
        <>
          <div className="auth-success-heart" aria-hidden="true" />
          <h1 className="auth-success-title">Портал відкрито{step.name ? `, ${step.name}` : ''} 💗</h1>
          <p className="auth-success-sub">Ласкаво просимо додому</p>
        </>
      );
  }
}

// ── Вхід ─────────────────────────────────────────────────────
function LoginForm({ follow, onForgot }: {
  follow: (result: LinkResult) => string | null;
  onForgot: () => void;
}) {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEmail(email) || password.length === 0) {
      setError('Введи пошту й пароль.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await loginWithEmail(normaliseEmail(email), password);
    setBusy(false);
    if (!result.ok && result.reason === 'invalid_credentials') setError('Пошта чи пароль не підходять.');
    else if (!result.ok && result.reason === 'email_unconfirmed') setError('Пошту ще не підтверджено — зареєструйся ще раз, прийде код.');
    else if (!result.ok && result.reason === 'rate_limited') setError('Забагато спроб. Зачекай хвилину.');
    else setError(follow(result as LinkResult));
  };

  return (
    <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="auth-title">З поверненням 💗</h1>
      <div className="reg-fields">
        <label className="reg-field">
          <span>Пошта</span>
          <input className="reg-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="reg-field">
          <span>Пароль</span>
          <input className="reg-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>
      {error !== null && <p className="reg-problem" role="alert">{error}</p>}
      <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Входимо…' : 'Увійти'}</button>
      <div className="auth-links">
        <button type="button" className="auth-link" onClick={onForgot}>Забули пароль?</button>
      </div>
    </form>
  );
}

// ── Реєстрація: пошта ────────────────────────────────────────
function EmailForm({ onSent }: { onSent: (email: string) => void }) {
  const { registrationOpen, sendCode } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEmail(email)) {
      setError('Схоже, у пошті помилка.');
      return;
    }
    setBusy(true);
    setError(null);
    const clean = normaliseEmail(email);
    // Поки власник не відкрив реєстрацію, код приходить лише на вже
    // створені акаунти — так «Забули пароль?» працює й до відкриття.
    const result = await sendCode(clean, await registrationOpen());
    setBusy(false);
    if (result.ok) onSent(clean);
    else if (result.reason === 'rate_limited') setError('Листи йдуть не частіше ніж раз на хвилину. Зачекай трохи.');
    else if (result.reason === 'not_found') setError('Реєстрація нових акаунтів ще не відкрита. Поки що входь старим PIN-кодом.');
    else setError('Не вдалося надіслати лист. Спробуй ще раз.');
  };

  return (
    <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="auth-title">Створимо акаунт</h1>
      <p className="reg-hint">На пошту прийде код із шести цифр — ним підтвердиш, що вона твоя.</p>
      <div className="reg-fields">
        <label className="reg-field">
          <span>Пошта</span>
          <input className="reg-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      {error !== null && <p className="reg-problem" role="alert">{error}</p>}
      <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Надсилаємо…' : 'Надіслати код'}</button>
    </form>
  );
}

// ── Реєстрація: код ──────────────────────────────────────────
function CodeForm({ email, onVerified, onBack }: { email: string; onVerified: () => void; onBack: () => void }) {
  const { verifyCode, sendCode, registrationOpen } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, value);
    setBusy(false);
    if (result.ok) onVerified();
    else if (result.reason === 'invalid_code') setError('Код не підходить або вже прострочений.');
    else if (result.reason === 'rate_limited') setError('Забагато спроб. Зачекай хвилину.');
    else setError('Не вдалося перевірити код. Спробуй ще раз.');
  };

  const change = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError(null);
    if (CODE_RE.test(digits)) void verify(digits);
  };

  const resend = async () => {
    setWait(RESEND_SECONDS);
    const result = await sendCode(email, await registrationOpen());
    if (!result.ok) setError('Не вдалося надіслати лист ще раз.');
  };

  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); if (CODE_RE.test(code)) void verify(code); }} noValidate>
      <h1 className="auth-title">Код із листа</h1>
      <p className="reg-hint">Надіслали на <b className="auth-email">{email}</b>. Лист може йти хвилину; зазирни й у «Спам».</p>
      <label className="reg-field auth-code-field">
        <span>Шість цифр</span>
        <input
          className="reg-input auth-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => change(e.target.value)}
          aria-invalid={error !== null}
        />
      </label>
      {error !== null && <p className="reg-problem" role="alert">{error}</p>}
      <button type="submit" className="btn reg-next" disabled={busy || !CODE_RE.test(code)}>{busy ? 'Перевіряємо…' : 'Підтвердити'}</button>
      <div className="auth-links">
        <button type="button" className="auth-link" disabled={wait > 0} onClick={() => void resend()}>
          {wait > 0 ? `Надіслати ще раз за ${wait} с` : 'Надіслати ще раз'}
        </button>
        <button type="button" className="auth-link" onClick={onBack}>Інша пошта</button>
      </div>
    </form>
  );
}

// ── Реєстрація: пароль двічі ─────────────────────────────────
function PasswordForm({ onSaved }: { onSaved: () => Promise<string | null> }) {
  const { setPassword } = useAuth();
  const [password, setValue] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const problems = passwordProblems(password);
  const matches = repeat.length > 0 && repeat === password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problems.length > 0) {
      setError('Пароль ще не відповідає правилам нижче.');
      return;
    }
    if (!matches) {
      setError('Паролі не збігаються.');
      return;
    }
    setBusy(true);
    setError(null);
    const saved = await setPassword(password);
    if (!saved.ok) {
      setBusy(false);
      setError('Не вдалося зберегти пароль. Спробуй ще раз.');
      return;
    }
    const next = await onSaved();
    setBusy(false);
    if (next !== null) setError(next);
  };

  return (
    <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="auth-title">Придумай пароль</h1>
      <div className="reg-fields">
        <label className="reg-field">
          <span>Пароль</span>
          <input className="reg-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="reg-field">
          <span>Ще раз</span>
          <input className="reg-input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
      </div>
      <ul className="auth-rules" aria-label="Правила пароля">
        {PASSWORD_RULES.map((rule) => {
          const ok = password.length > 0 && !problems.includes(rule);
          return <li key={rule} className={ok ? 'is-ok' : ''}>{PASSWORD_PROBLEM_TEXT[rule]}</li>;
        })}
        <li className={matches ? 'is-ok' : ''}>обидва поля однакові</li>
      </ul>
      {error !== null && <p className="reg-problem" role="alert">{error}</p>}
      <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти пароль'}</button>
    </form>
  );
}

// ── PIN: підтвердження місця ───────────────────
function PinPad({ name, hint, onSubmit, onBack }: {
  name: string;
  hint?: string;
  onSubmit: (pin: string) => Promise<string | null>;
  onBack: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const press = (digit: string) => {
    if (pin.length >= 8) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 8) {
      void onSubmit(next).then((problem) => {
        if (problem === null) return;
        setError(problem);
        setShake(true);
        setPin('');
      });
    }
  };

  return (
    <div className={`auth-pin${shake ? ' shake' : ''}`}>
      <h1 className="auth-title">{name}</h1>
      {hint && <p className="reg-hint">{hint}</p>}
      <div className="pin-dots" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}${error ? ' error' : ''}`} />
        ))}
      </div>
      {error && <p className="pin-error" role="alert">{error}</p>}
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => press(d)}>{d}</button>
        ))}
        <button type="button" className="pin-key pin-key--dim" aria-label="Назад" onClick={onBack}>‹</button>
        <button type="button" className="pin-key" onClick={() => press('0')}>0</button>
        <button type="button" className="pin-key pin-key--dim" aria-label="Стерти" onClick={() => { setPin(''); setError(null); }}>✕</button>
      </div>
    </div>
  );
}

function pinProblem(reason: string, retryAfterSeconds?: number): string {
  if (reason === 'locked') return `Забагато спроб, спробуй через ${Math.max(1, Math.ceil((retryAfterSeconds ?? 900) / 60))} хв`;
  if (reason === 'invalid') return 'Невірний PIN, спробуй ще';
  return 'Не вдалося увійти. Спробуй ще раз.';
}

function ClaimPin({ seat, onDone, onBack, onNoPin }: {
  seat: PortalSeat;
  onDone: (name: string) => void;
  onBack: () => void;
  onNoPin: () => void;
}) {
  const { claimSeat } = useAuth();
  return (
    <>
      <PinPad
        name="Ваш PIN-код"
        hint="Той, яким ви заходили в портал досі, — востаннє. Далі вхід поштою й паролем."
        onBack={onBack}
        onSubmit={async (pin) => {
          const res = await claimSeat(seat.id, pin);
          if (res.ok) { onDone(res.name ?? ''); return null; }
          return pinProblem(res.reason, res.reason === 'locked' ? res.retryAfterSeconds : undefined);
        }}
      />
      <button type="button" className="auth-link" onClick={onNoPin}>У мене немає PIN-коду</button>
    </>
  );
}

/**
 * Перше питання після пароля для пошти, ще не прив'язаної до місця.
 * Стать, а не імена пари (власник): питання «Хто ви в цій парі? Діма /
 * Лєна» загнало б незнайомця в ступор і показало б йому чужі імена.
 */
function GenderPicker({ onPick }: { onPick: (gender: SeatGender) => void }) {
  return (
    <>
      <h1 className="auth-title">Хто ви?</h1>
      <p className="reg-hint">Так портал знайде ваше місце в парі. Спогади, плани й артефакт лишаться на місці.</p>
      <div className="user-select">
        {(['male', 'female'] as const).map((gender) => (
          <button key={gender} type="button" className="user-btn" onClick={() => onPick(gender)}>
            {GENDER_TEXT[gender]}
          </button>
        ))}
      </div>
    </>
  );
}
