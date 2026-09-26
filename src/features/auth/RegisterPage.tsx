import { useMemo, useState } from 'react';
/*
 * ЗНАЧКИ МАЛЬОВАНІ, А НЕ ЕМОДЗІ. Перша редакція взяла `‹` і `✕` — рівно
 * як на екрані входу поруч, — і сторож `noEmojiInControls.test.ts`
 * упіймав `✕`: цей файл у його список винятків не входить, і входити не
 * має. Вхід у ньому лише через 💗 у заголовку, а керування інтерфейсом
 * емодзі не робить ніде.
 */
import { ChevronLeftIcon, CloseIcon } from '@/components/icons/UiIcon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { invokeFn } from '@/lib/supabase';
import { daysBetween } from '@/features/home/homeUtils';
import { plural } from '@/lib/plural';
import { todayLocal } from '@/features/_shared/month';
import {
  REGISTER_PIN_LENGTH,
  REGISTER_NAME_MAX,
  REGISTER_PROBLEM_TEXT,
  nameStepProblem,
  registrationProblem,
} from './coupleRegistration';
import './register.css';
import type { CoupleRegisterResponse } from '@/types';

// ============================================================
// «Створити портал» — реєстрація пари (ADR-0209).
// ------------------------------------------------------------
// Три кроки, і всі три — відповіді, без яких портал не може працювати:
//   імена  — за ними обирають себе на вході;
//   PIN    — єдиний ключ, іншого в порталі немає;
//   дата   — з неї рушій бере вік артефакта й початок тону.
//
// ЧОМУ ТУТ НЕМАЄ ВИБОРУ ВИДУ, ХОЧ ЙОГО ПРОСИЛИ РАЗОМ ІЗ РЕШТОЮ. Він є —
// але останнім кроком шляху, у «Нашій історії» (`/start`), і не тому, що
// так вийшло. Це записане рішення власника: вид вибирають «на своїй
// історії, а не на порожньому екрані з трьома картинками»
// (`onboarding/SweepSpecies.tsx`). Тут історії ще немає — вона
// з'являється на наступному екрані, і сцена позаду перемальовує
// СПРАВЖНІЙ артефакт пари з їхніми роками. Тому реєстрація віддає
// керування в `/start`, а не показує три картинки на порожньому.
//
// ЧОМУ PIN НАБИРАЄТЬСЯ ДВІЧІ. У порталі немає ЖОДНОГО шляху відновлення
// PIN — перевірено пошуком по `src` і `supabase`: ні «забув», ні скидання,
// ні листа. Тобто одна помилка в наборі замикає власний портал назавжди.
// Підтвердження тут не зручність, а єдине, що стоїть між парою й цим.
//
// ЧОМУ ТОЙ САМИЙ ПАД, ЩО НА ВХОДІ. `.pin-pad`/`.pin-dots` уже несуть
// поведінку, розміри дотику й теми екрана входу. Другий набір цифр
// виглядав би інакше й розійшовся б із першим — а головне, пара ставить
// PIN тим самим рухом, яким потім заходить.
// ============================================================

type Step = 'names' | 'pin' | 'date';

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('names');
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [pins, setPins] = useState<[string, string]>(['', '']);
  const [startedAt, setStartedAt] = useState('');

  /** Хто саме зараз ставить PIN. */
  const [pinIndex, setPinIndex] = useState(0);
  /** Набране зараз. */
  const [draft, setDraft] = useState('');
  /** Перший набір, якщо він уже був — тоді наступний є підтвердженням. */
  const [firstPass, setFirstPass] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * ПОРОЖНІСТЬ ПИТАЄТЬСЯ НА ВХОДІ, А НЕ В КІНЦІ.
   *
   * ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО: першу редакцію цього екрана власний
   * зонд пройшов НАСКРІЗЬ на справжньому порталі, де пара вже є, — усі
   * три кроки й чотири набори PIN, — і лише тоді сервер сказав
   * `portal_taken`. Тобто людину проводили через найдовшу частину шляху,
   * щоб відмовити в тому, що було відомо з першої секунди.
   *
   * Серверна перевірка лишається й лишається головною: екран не є
   * авторитетом, і між цим запитом і надсиланням портал міг стати
   * зайнятим. Але змусити пройти весь шлях заради відомої відмови —
   * це не «надійно», це неввічливо.
   */
  const { data: existingUsers, isPending: usersPending, isError: usersFailed } = useUsers();
  /*
   * `submitted` тримає екран на місці після успіху: створена пара робить
   * портал НЕПОРОЖНІМ, і без цього прапорця гілка нижче встигла б
   * показати «портал уже має пару» в проміжку між відповіддю функції й
   * переходом на `/start`. Тобто пара побачила б відмову замість власного
   * щойно створеного порталу.
   */
  const [submitted, setSubmitted] = useState(false);

  const today = todayLocal();
  const nameProblem = useMemo(() => nameStepProblem(names[0], names[1]), [names]);

  const days = /^\d{4}-\d{2}-\d{2}$/.test(startedAt) ? daysBetween(startedAt) : null;

  // ── Чи вільний портал ──────────────────────────────────────
  if (usersPending) {
    return <Shell title="Хвилинку" hint="Дивимось, чи вільний цей портал.">{null}</Shell>;
  }
  if (usersFailed) {
    /*
     * Мовчазного «вважаємо порожнім» тут немає навмисно: не знати —
     * це не те саме, що знати, що вільно. Спроба створити пару наосліп
     * упреться в ту саму відмову сервера, лише після всього шляху.
     */
    return (
      <Shell title="Не видно бази" hint="Не вдалося перевірити, чи вільний портал.">
        <p className="reg-problem">Перевірте зʼєднання й спробуйте ще раз.</p>
        <button type="button" className="btn btn-ghost reg-back" onClick={() => void navigate('/login')}>
          На вхід
        </button>
      </Shell>
    );
  }
  if (!submitted && (existingUsers?.length ?? 0) > 0) {
    return (
      <Shell
        title="Цей портал уже зайнятий"
        hint="Тут живе пара, і другої в одному порталі бути не може."
      >
        <button type="button" className="btn reg-next" onClick={() => void navigate('/login')}>
          Увійти
        </button>
      </Shell>
    );
  }

  // ── Крок імен ──────────────────────────────────────────────
  if (step === 'names') {
    return (
      <Shell title="Хто ви двоє?" hint="Ці імена ви бачитимете на вході — саме за ними обираєте себе.">
        <div className="reg-fields">
          {([0, 1] as const).map((index) => (
            <label key={index} className="reg-field">
              <span>{index === 0 ? 'Перше імʼя' : 'Друге імʼя'}</span>
              <input
                type="text"
                className="reg-input"
                value={names[index]}
                maxLength={REGISTER_NAME_MAX}
                autoComplete="off"
                onChange={(event) => setNames((current) => {
                  const next: [string, string] = [...current] as [string, string];
                  next[index] = event.target.value;
                  return next;
                })}
              />
            </label>
          ))}
        </div>
        {nameProblem !== null && <p className="reg-problem">{REGISTER_PROBLEM_TEXT[nameProblem]}</p>}
        <button
          type="button"
          className="btn reg-next"
          disabled={nameProblem !== null || names[0].trim() === '' || names[1].trim() === ''}
          onClick={() => { setStep('pin'); setPinIndex(0); setDraft(''); setFirstPass(null); }}
        >
          Далі
        </button>
        <button type="button" className="btn btn-ghost reg-back" onClick={() => void navigate('/login')}>
          Уже маємо портал
        </button>
      </Shell>
    );
  }

  // ── Крок PIN ───────────────────────────────────────────────
  if (step === 'pin') {
    // `pinIndex` тут лише 0 або 1, але тип цього не знає — і замовчати
    // це кастом означало б лишити `undefined` без відповіді.
    const who = (names[pinIndex] ?? '').trim();
    const confirming = firstPass !== null;

    const press = (digit: string) => {
      if (draft.length >= REGISTER_PIN_LENGTH) return;
      const next = draft + digit;
      setError(null);
      if (next.length < REGISTER_PIN_LENGTH) { setDraft(next); return; }

      if (!confirming) {
        // Перший набір повний — питаємо його ще раз, а не приймаємо.
        setFirstPass(next);
        setDraft('');
        return;
      }
      if (next !== firstPass) {
        setError('PIN не збігся. Наберіть ще раз, з початку.');
        setFirstPass(null);
        setDraft('');
        return;
      }
      /*
       * Однаковий PIN на двох — це один вхід на двох, і портал не
       * розрізнив би, хто з них зайшов. Правило живе в
       * `coupleRegistration.ts`, але сказати про нього треба ТУТ: на
       * кроці дати вже не видно, який саме PIN повторився.
       */
      if (pinIndex === 1 && next === pins[0]) {
        setError('Цей PIN уже в першого. Потрібні різні — інакше портал не розрізнить, хто зайшов.');
        setFirstPass(null);
        setDraft('');
        return;
      }
      setPins((current) => {
        const kept: [string, string] = [...current] as [string, string];
        kept[pinIndex] = next;
        return kept;
      });
      setFirstPass(null);
      setDraft('');
      if (pinIndex === 0) setPinIndex(1);
      else setStep('date');
    };

    return (
      <Shell
        title={who}
        hint={confirming ? 'Ще раз, щоб не було помилки.' : `${REGISTER_PIN_LENGTH} цифр. Відновити його буде нічим, тому наберете двічі.`}
      >
        <div className="pin-dots" aria-hidden="true">
          {Array.from({ length: REGISTER_PIN_LENGTH }).map((_, index) => (
            <span key={index} className={`pin-dot${index < draft.length ? ' filled' : ''}${error ? ' error' : ''}`} />
          ))}
        </div>
        <p className="reg-pin-stage" role="status">
          {confirming ? 'Підтвердження' : 'Новий PIN'}
        </p>
        {error !== null && <p className="pin-error">{error}</p>}

        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button key={digit} type="button" className="pin-key" onClick={() => press(digit)}>{digit}</button>
          ))}
          <button
            type="button"
            className="pin-key pin-key--dim"
            aria-label="Назад"
            onClick={() => {
              setError(null);
              if (confirming) { setFirstPass(null); setDraft(''); return; }
              if (pinIndex === 1) { setPinIndex(0); setDraft(''); return; }
              setStep('names');
            }}
          >
            <ChevronLeftIcon size={20} />
          </button>
          <button type="button" className="pin-key" onClick={() => press('0')}>0</button>
          <button
            type="button"
            className="pin-key pin-key--dim"
            aria-label="Стерти"
            onClick={() => { setDraft(''); setError(null); }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </Shell>
    );
  }

  // ── Крок дати ──────────────────────────────────────────────
  const submit = async () => {
    const problem = registrationProblem(
      { members: [{ name: names[0], pin: pins[0] }, { name: names[1], pin: pins[1] }], startedAt },
      today,
    );
    if (problem !== null) { setError(REGISTER_PROBLEM_TEXT[problem]); return; }

    setBusy(true);
    setError(null);
    let response: CoupleRegisterResponse;
    try {
      response = await invokeFn('couple-register', {
        members: [
          { name: names[0].trim(), pin: pins[0] },
          { name: names[1].trim(), pin: pins[1] },
        ],
        started_at: startedAt,
      });
    } catch (transport) {
      console.error('couple-register transport error:', transport);
      setBusy(false);
      setError('Не вдалося звʼязатися з сервером. Спробуйте ще раз.');
      return;
    }

    if (!response.ok) {
      setBusy(false);
      setError(registerErrorText(response.error));
      return;
    }

    /*
     * Вхід одразу: PIN щойно набрали й він лежить у пам'яті, тож просити
     * набрати його втретє означало б покарати за реєстрацію. Перший
     * створений — той, чиє ім'я стояло першим.
     */
    setSubmitted(true);
    const first = response.members[0];
    if (first !== undefined) {
      const entered = await login(first.id, pins[0]);
      if (!entered.ok) {
        // Пара створена, але вхід не вдався — це не «все добре».
        setBusy(false);
        setError('Портал створено, але автоматичний вхід не вдався. Зайдіть зі свого PIN.');
        return;
      }
    }
    // Далі — «Наша історія»: річниці, віхи по роках і вибір виду.
    void navigate('/start');
  };

  return (
    <Shell title="З якого дня ви разом?" hint="З цієї дати артефакт бере свій вік і початок кольору.">
      <label className="reg-field">
        <span>День початку</span>
        <input
          type="date"
          className="reg-input"
          value={startedAt}
          max={today}
          onChange={(event) => { setStartedAt(event.target.value); setError(null); }}
        />
      </label>

      {days !== null && (
        <p className="reg-days" role="status">
          {/*
            * Число рахує `daysBetween` — ТА САМА функція, якою рахує
            * головна. Власний підрахунок тут розійшовся б із нею на
            * межах доби, і пара побачила б два різні «скільки ми разом»
            * на двох екранах поспіль.
            */}
          <b>{days}</b> {plural(days, 'день', 'дні', 'днів')} разом
        </p>
      )}

      {error !== null && <p className="reg-problem">{error}</p>}

      <button type="button" className="btn reg-next" disabled={busy || days === null} onClick={() => void submit()}>
        {busy ? 'Створюємо…' : 'Створити портал'}
      </button>
      <button
        type="button"
        className="btn btn-ghost reg-back"
        disabled={busy}
        onClick={() => { setStep('pin'); setPinIndex(1); setDraft(''); setFirstPass(null); setError(null); }}
      >
        Назад
      </button>
    </Shell>
  );
}

function Shell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card reg-card">
        <div className="auth-kicker">Amore</div>
        <h1 className="auth-title">{title}</h1>
        <p className="reg-hint">{hint}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Код відмови → речення.
 *
 * `portal_taken` тут головний і названий прямо: це не збій, а те, що
 * портал уже комусь належить. Сказати «щось пішло не так» означало б
 * відправити пару пробувати ще раз по колу.
 */
function registerErrorText(code: string): string {
  if (code === 'portal_taken') {
    return 'Цей портал уже має пару. Нову пару можна створити лише на порожньому порталі.';
  }
  if (code === 'started_at_in_future') return REGISTER_PROBLEM_TEXT['start-date-in-future'];
  if (code === 'bad_started_at') return REGISTER_PROBLEM_TEXT['no-start-date'];
  if (code === 'same_name') return REGISTER_PROBLEM_TEXT['same-name'];
  if (code === 'bad_name') return REGISTER_PROBLEM_TEXT['no-first-name'];
  if (code === 'bad_pin') return REGISTER_PROBLEM_TEXT['no-first-pin'];
  return 'Не вдалося створити портал. Спробуйте ще раз.';
}

export default RegisterPage;
