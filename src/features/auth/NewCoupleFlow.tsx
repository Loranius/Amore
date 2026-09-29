// ============================================================
// NewCoupleFlow — реєстрація нової пари (ADR-0230).
// ------------------------------------------------------------
// Порядок — дослівно за власником:
//   1. хто створює акаунт — хлопець чи дівчина (і як звати: портал звертається
//      до людини на ім'я, тож без нього головна не має що сказати);
//      звідси ж — «Увійти за кодом» для другої людини пари (ADR-0232):
//      код, і одразу головна, бо пара вже має і дату, і вид;
//   2. з якого дня ви разом;
//   3. минулі роки — «для росту об'єкта», можна пропустити й заповнити
//      пізніше в налаштуваннях;
//   4. вибір виду: острівці з тла підпливають ближче, виходять із
//      розфокусу й обертаються з легкою левітацією;
//   5. якщо минулі роки пропущено — одразу головна; якщо заповнено —
//      спершу обраний вид росте з цих відповідей, потім головна.
//
// Пара створюється на кроці 2 (`createCouple`): з цієї миті токен несе
// членство, тож кроки 3–4 пишуть дані пари під її ж політиками. Портал
// відкривається (`enterPortal`) лише в кінці — інакше маршрутизатор
// перемкнув би на головну посеред питань.
// ============================================================
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth, type JoinCoupleResult } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { coupleDay } from '@/features/world/portalSources';
import { COUPLE_TIME_ZONE } from '@/features/world/coupleEngine';
import { HOME_ARTIFACT_LABELS } from '@/features/home/homeArtifact';
import { useSaveSharedArtifact } from '@/features/world/sharedArtifact';
import { SPECIES_SHAPE } from '@/features/onboarding/SweepSpecies';
import { DECLARED_COUNTS_KEY, serializeDeclaredCounts } from '@/features/onboarding/declaredCounts';
import type { AppUser } from '@/types';
import { CHOICE_ORDER, type IslandsView } from './islandsView';
import { INVITE_PROBLEM_TEXT, inviteCodeProblem, normalizeInviteCode } from './inviteCode';
import type { DemoSpecies } from './demoIslands';
import {
  EMPTY_ANSWER,
  FULLNESS_TEXT,
  NAME_MAX,
  PAST_COUNT_MAX,
  SPECIES_POSSESSIVE,
  grownSnapshot,
  hasAnyAnswer,
  mergePastYears,
  nameProblem,
  pastYearSpans,
  startProblem,
  yearsWord,
  type PastYearAnswer,
} from './newCouple';

type Gender = 'male' | 'female';

type Step =
  | { kind: 'who' }
  | { kind: 'code' }
  | { kind: 'since' }
  | { kind: 'past-ask' }
  | { kind: 'past'; index: number }
  | { kind: 'species' }
  | { kind: 'grow'; species: DemoSpecies };

/** Скільки острів росте перед головною. Час показу, не логіки. */
const GROW_MS = 3600;

const NAME_TEXT = { empty: 'Як тебе звати?', long: `Імʼя — до ${NAME_MAX} знаків.` } as const;
const START_TEXT = {
  empty: 'Вибери день.',
  future: 'Цей день ще не настав.',
  too_early: 'Такої давньої дати портал не приймає.',
} as const;

const CODE_TEXT = INVITE_PROBLEM_TEXT;

const JOIN_TEXT: Record<Exclude<JoinCoupleResult, { ok: true }>['reason'], string> = {
  invite_invalid: 'Такого коду немає, його вже використано або минув тиждень. Попроси партнера створити новий.',
  locked: 'Забагато невдалих спроб. Спробуй за годину.',
  couple_full: 'У цьому порталі вже двоє.',
  email_taken: 'Ця пошта вже має місце в порталі — увійди у вкладці «Вхід».',
  registration_closed: 'Реєстрацію зараз закрито.',
  bad_request: 'Перевір імʼя й код.',
  error: 'Не вдалося приєднатися. Спробуй ще раз.',
};

interface NewCoupleFlowProps {
  onView: (view: IslandsView) => void;
  onDone: (name: string) => void;
  /**
   * Код запрошення, введений ще на екрані коду з листа (ADR-0232). Тоді
   * людина не створює пару, а приєднується: питаємо лише стать та імʼя.
   */
  invite?: string | null;
}

export function NewCoupleFlow({ onView, onDone, invite = null }: NewCoupleFlowProps) {
  const { createCouple, joinCouple, enterPortal } = useAuth();
  const saveArtifact = useSaveSharedArtifact();
  const today = useMemo(() => coupleDay(new Date(), COUPLE_TIME_ZONE), []);

  const [step, setStep] = useState<Step>({ kind: 'who' });
  const [gender, setGender] = useState<Gender | null>(null);
  const [name, setName] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [answers, setAnswers] = useState<Record<string, PastYearAnswer>>({});
  const [picked, setPicked] = useState<DemoSpecies>('crystal');
  const [code, setCode] = useState(invite ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spans = useMemo(() => (startedAt ? pastYearSpans(startedAt, today) : []), [startedAt, today]);

  // Тло стежить за кроком: питання — розфокус, вибір — ряд острівців,
  // ріст — один острів пари посередині.
  useEffect(() => {
    if (step.kind === 'species') onView({ mode: 'choose', defocus: false, picked, grown: null });
    else if (step.kind === 'grow') {
      onView({
        mode: 'grow',
        defocus: false,
        picked: step.species,
        grown: { species: step.species, snapshot: grownSnapshot(startedAt, today, mergePastYears({}, answers)) },
      });
    } else onView({ mode: 'backdrop', defocus: true, picked: null, grown: null });
  }, [step, picked, onView, startedAt, today, answers]);

  // Ріст — і головна. Портал відкривається лише тут.
  useEffect(() => {
    if (step.kind !== 'grow' || user === null) return;
    const timer = setTimeout(() => {
      enterPortal(user);
      onDone(user.name);
    }, GROW_MS);
    return () => clearTimeout(timer);
  }, [step, user, enterPortal, onDone]);

  const finish = (withGrowth: boolean, species: DemoSpecies) => {
    if (user === null) return;
    if (withGrowth) {
      setStep({ kind: 'grow', species });
      return;
    }
    enterPortal(user);
    onDone(user.name);
  };

  /** Приєднання за кодом. Невдача з кодом веде на крок коду, щоб його виправити. */
  const join = async (raw: string, who: Gender) => {
    const problem = inviteCodeProblem(raw);
    if (problem !== null) { setCode(raw); setError(CODE_TEXT[problem]); setStep({ kind: 'code' }); return; }
    setBusy(true);
    setError(null);
    const result = await joinCouple({ code: normalizeInviteCode(raw), name, gender: who });
    setBusy(false);
    if (!result.ok) {
      setError(JOIN_TEXT[result.reason]);
      if (result.reason === 'invite_invalid') { setCode(raw); setStep({ kind: 'code' }); }
      return;
    }
    // Пара вже має і вид, і історію: питати нема про що — одразу головна.
    onDone(result.user.name);
  };

  // ── 1. хто ───────────────────────────────────────────────
  if (step.kind === 'who') {
    // Той самий крок веде у дві сторони: нова пара — або до пари, яку
    // партнер уже створив. Стать та імʼя потрібні обом.
    const ready = (): Gender | null => {
      const problem = nameProblem(name);
      if (gender === null) { setError('Обери, хто ти.'); return null; }
      if (problem !== null) { setError(NAME_TEXT[problem]); return null; }
      setError(null);
      return gender;
    };
    const go = (next: Step) => { if (ready() !== null) setStep(next); };
    const submit = (event: FormEvent) => {
      event.preventDefault();
      if (invite === null) { go({ kind: 'since' }); return; }
      const who = ready();
      if (who !== null) void join(invite, who);
    };
    return (
      <form className="auth-form" onSubmit={submit} noValidate>
        <h1 className="auth-title">{invite === null ? 'Хто створює акаунт?' : 'Хто ти?'}</h1>
        <p className="reg-hint">
          {invite === null
            ? 'Портал — на двох. Партнера запросите пізніше, коли все буде готово.'
            : 'Ти приєднуєшся до пари за кодом від партнера. Лишилось сказати, хто ти.'}
        </p>
        <div className="auth-choice" role="group" aria-label="Хто створює акаунт">
          {(['male', 'female'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="user-btn auth-choice-btn"
              aria-pressed={gender === value}
              onClick={() => { setGender(value); setError(null); }}
            >
              {value === 'male' ? 'Хлопець' : 'Дівчина'}
            </button>
          ))}
        </div>
        <div className="reg-fields">
          <label className="reg-field">
            <span>Як тебе звати?</span>
            <input
              className="reg-input"
              autoComplete="given-name"
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
            />
          </label>
        </div>
        {error !== null && <p className="reg-problem" role="alert">{error}</p>}
        {invite === null ? (
          <>
            <button type="submit" className="btn reg-next">Далі</button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => go({ kind: 'code' })}>
                Партнер уже створив портал? Увійти за кодом
              </button>
            </div>
          </>
        ) : (
          <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Приєднуємо…' : 'Увійти в портал'}</button>
        )}
      </form>
    );
  }

  // ── 1б. код від партнера (ADR-0232) ─────────────────────
  if (step.kind === 'code') {
    const submit = async (event: FormEvent) => {
      event.preventDefault();
      const problem = inviteCodeProblem(code);
      if (problem !== null) { setError(CODE_TEXT[problem]); return; }
      if (gender === null) { setStep({ kind: 'who' }); return; }
      await join(code, gender);
    };
    return (
      <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
        <h1 className="auth-title">Код від партнера</h1>
        <p className="reg-hint">
          Партнер бачить його в налаштуваннях порталу, у розділі «Партнер». Код діє тиждень і підходить один раз.
        </p>
        <div className="reg-fields">
          <label className="reg-field">
            <span>Код запрошення</span>
            <input
              className="reg-input reg-input--code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={16}
              placeholder="XXXX-XXXX"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
            />
          </label>
        </div>
        {error !== null && <p className="reg-problem" role="alert">{error}</p>}
        <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Приєднуємо…' : 'Приєднатися'}</button>
        <div className="auth-links">
          <button type="button" className="auth-link" disabled={busy} onClick={() => { setError(null); setStep({ kind: 'who' }); }}>
            Назад
          </button>
        </div>
      </form>
    );
  }

  // ── 2. з якого дня (і тут пара створюється) ─────────────
  if (step.kind === 'since') {
    const submit = async (event: FormEvent) => {
      event.preventDefault();
      const problem = startProblem(startedAt, today);
      if (problem !== null) { setError(START_TEXT[problem]); return; }
      if (gender === null) { setStep({ kind: 'who' }); return; }
      setBusy(true);
      setError(null);
      const result = await createCouple({ name, gender, startedAt });
      setBusy(false);
      if (!result.ok) {
        setError(
          result.reason === 'email_taken' ? 'Ця пошта вже має місце в порталі — увійди у вкладці «Вхід».'
            : result.reason === 'registration_closed' ? 'Реєстрацію нових пар зараз закрито.'
            : 'Не вдалося створити портал. Спробуй ще раз.',
        );
        return;
      }
      setUser(result.user);
      setStep(pastYearSpans(startedAt, today).length > 0 ? { kind: 'past-ask' } : { kind: 'species' });
    };
    return (
      <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
        <h1 className="auth-title">З якого дня ви разом?</h1>
        <p className="reg-hint">З цього дня портал рахуватиме ваші дні й роки.</p>
        <div className="reg-fields">
          <label className="reg-field">
            <span>День, коли все почалось</span>
            <input
              className="reg-input"
              type="date"
              min="1950-01-01"
              max={today}
              value={startedAt}
              onChange={(e) => { setStartedAt(e.target.value); setError(null); }}
            />
          </label>
        </div>
        {error !== null && <p className="reg-problem" role="alert">{error}</p>}
        <button type="submit" className="btn reg-next" disabled={busy}>{busy ? 'Створюємо портал…' : 'Далі'}</button>
        <div className="auth-links">
          <button type="button" className="auth-link" disabled={busy} onClick={() => { setError(null); setStep({ kind: 'who' }); }}>
            Назад
          </button>
        </div>
      </form>
    );
  }

  // ── 3. минулі роки: чи заповнювати ──────────────────────
  if (step.kind === 'past-ask') {
    const count = spans.length;
    return (
      <>
        <h1 className="auth-title">Ваші минулі роки</h1>
        <p className="reg-hint">
          Позаду вже {count} {yearsWord(count)} разом. Розкажіть приблизно, якими вони були, — з цього
          виросте ваш обʼєкт: кожен рік стане його частиною. Можна пропустити й заповнити пізніше
          в налаштуваннях.
        </p>
        <button type="button" className="btn reg-next" onClick={() => setStep({ kind: 'past', index: 0 })}>
          Заповнити
        </button>
        <button type="button" className="btn btn-ghost reg-back" onClick={() => setStep({ kind: 'species' })}>
          Пропустити
        </button>
      </>
    );
  }

  // ── 3. минулі роки: по одному ────────────────────────────
  if (step.kind === 'past') {
    const span = spans[step.index]!;
    const answer = answers[span.startsAt] ?? EMPTY_ANSWER;
    const set = (patch: Partial<PastYearAnswer>) => setAnswers((all) => ({ ...all, [span.startsAt]: { ...answer, ...patch } }));
    const last = step.index === spans.length - 1;

    const next = async () => {
      if (!last) { setStep({ kind: 'past', index: step.index + 1 }); return; }
      if (!hasAnyAnswer(answers)) { setStep({ kind: 'species' }); return; }
      setBusy(true);
      setError(null);
      const { error: saveError } = await supabase
        .from('settings')
        .upsert(
          { key: DECLARED_COUNTS_KEY, value: serializeDeclaredCounts(mergePastYears({}, answers)) },
          { onConflict: 'couple_id,key' },
        );
      setBusy(false);
      if (saveError) {
        console.error('past years save failed:', saveError);
        setError('Не вдалося зберегти. Спробуй ще раз — або пропусти й заповни пізніше.');
        return;
      }
      setStep({ kind: 'species' });
    };

    return (
      <>
        <div className="auth-step-kicker">{span.range} · {step.index + 1} з {spans.length}</div>
        <h1 className="auth-title">{span.label}</h1>
        <div className="past-rows">
          <Counter label="Подорожі й нові місця" value={answer.places} onChange={(places) => set({ places })} />
          <Counter label="Важливі події" value={answer.milestones} onChange={(milestones) => set({ milestones })} />
          <Counter label="Здійснені бажання" value={answer.wishes} onChange={(wishes) => set({ wishes })} />
          <div className="past-fullness" role="group" aria-label="Наскільки насиченим був рік">
            <span className="past-label">Наскільки насиченим був рік</span>
            <div className="past-scale">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  className="past-dot"
                  aria-pressed={answer.fullness >= level}
                  aria-label={`${level} з 5 — ${FULLNESS_TEXT[level]}`}
                  onClick={() => set({ fullness: answer.fullness === level ? 0 : level })}
                />
              ))}
            </div>
            <span className="past-said">{answer.fullness > 0 ? FULLNESS_TEXT[answer.fullness] : 'не сказано'}</span>
          </div>
        </div>
        {error !== null && <p className="reg-problem" role="alert">{error}</p>}
        <button type="button" className="btn reg-next" disabled={busy} onClick={() => void next()}>
          {busy ? 'Зберігаємо…' : last ? 'Готово' : 'Наступний рік'}
        </button>
        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            disabled={busy}
            onClick={() => setStep(step.index === 0 ? { kind: 'past-ask' } : { kind: 'past', index: step.index - 1 })}
          >
            Назад
          </button>
        </div>
      </>
    );
  }

  // ── 4. вибір виду ────────────────────────────────────────
  if (step.kind === 'species') {
    const confirm = async () => {
      setBusy(true);
      setError(null);
      const saved = await saveArtifact(picked);
      setBusy(false);
      if (!saved.ok) { setError('Не вдалося зберегти вибір. Спробуй ще раз.'); return; }
      finish(hasAnyAnswer(answers), picked);
    };
    return (
      <>
        <h1 className="auth-title">Що виростатиме у вас?</h1>
        <div className="auth-species" role="radiogroup" aria-label="Вид">
          {CHOICE_ORDER.map((species) => (
            <button
              key={species}
              type="button"
              role="radio"
              aria-checked={picked === species}
              className="auth-species-btn"
              onClick={() => setPicked(species)}
            >
              {HOME_ARTIFACT_LABELS[species]}
            </button>
          ))}
        </div>
        <p className="reg-hint">
          {SPECIES_SHAPE[picked]}
          {picked === 'reef' && ' Риф ще в розробці — його форма змінюватиметься.'}
          {' '}Обирайте разом: на головній житиме саме він.
        </p>
        {error !== null && <p className="reg-problem" role="alert">{error}</p>}
        <button type="button" className="btn reg-next" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Зберігаємо…' : `Обрати: ${HOME_ARTIFACT_LABELS[picked]}`}
        </button>
      </>
    );
  }

  // ── 5. ріст ──────────────────────────────────────────────
  const years = spans.length;
  return (
    <>
      <h1 className="auth-title">Вирощуємо {SPECIES_POSSESSIVE[step.species].your}</h1>
      <p className="reg-hint">
        З {years} {yearsWord(years)}, які ви щойно згадали. Далі {SPECIES_POSSESSIVE[step.species].it} ростиме
        з того, що ви житимете в порталі.
      </p>
    </>
  );
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="past-row">
      <span className="past-label">{label}</span>
      <div className="past-stepper">
        <button type="button" className="past-step" aria-label={`${label}: менше`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
        <output className="past-value" aria-live="polite">{value}</output>
        <button type="button" className="past-step" aria-label={`${label}: більше`} disabled={value >= PAST_COUNT_MAX} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}
