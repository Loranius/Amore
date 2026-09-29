// ============================================================
// Нова пара (ADR-0230) — чисті правила реєстрації.
// ------------------------------------------------------------
// Власник: «Портал запитує хто створює акаунт хлопець чи дівчина, далі йде
// питання початку дати відносин, потім можливість заповнити приблизно
// минулі роки … (для росту об'єкта), цей пункт можна буде пропустити і
// заповнити пізніше в налаштуваннях».
//
// МИНУЛІ РОКИ НЕ ЗАВОДЯТЬ НОВОГО СХОВИЩА. Портал уже вміє брати «сказане
// числом» (`declaredCounts.ts`): число за рік лежить у `settings`, а до
// знімка рушія домішується лише різниця «сказано − уже є». Відповіді
// реєстрації лягають рівно туди. Наслідки:
//   • об'єкт росте з них тим самим шляхом, що й з огляду історії (`/start`);
//   • «заповнити пізніше в налаштуваннях» — це той самий огляд історії, що
//     показує й редагує ці числа, а не друга копія;
//   • подвійного рахунку немає: справжній рядок зменшує домішку.
//
// Лічильники — обрані власником: подорожі й нові місця, важливі події,
// здійснені бажання, і «наскільки насиченим був рік» від 1 до 5.
// Насиченість стає числом памʼятних знімків (`FULLNESS_PHOTOS`): саме
// спогади рушій читає як щільність року, і саме їх пара потім може
// замінити справжніми фото.
// ============================================================
import { relationshipYears } from '@/engine/species/shared/relationshipYear';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { crystalV2SnapshotFrom } from '@/features/home/crystal3d/v2/crystalV2Sources';
import { plural } from '@/lib/plural';
import {
  padSnapshotWithDeclared,
  type DeclaredCounts,
  type DeclaredYear,
} from '@/features/onboarding/declaredCounts';

export const NAME_MAX = 40;

/** Найраніша дата початку, яку приймає і сервер (`create_couple_for`). */
export const EARLIEST_START = '1950-01-01';

export type NameProblem = 'empty' | 'long';

export function nameProblem(name: string): NameProblem | null {
  const clean = name.trim();
  if (clean.length === 0) return 'empty';
  if (clean.length > NAME_MAX) return 'long';
  return null;
}

export type StartProblem = 'empty' | 'future' | 'too_early';

/** `today` — день пари (YYYY-MM-DD); сервер перевіряє те саме. */
export function startProblem(date: string, today: string): StartProblem | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'empty';
  if (date > today) return 'future';
  if (date < EARLIEST_START) return 'too_early';
  return null;
}

/** Відповідь про один рік стосунків. */
export interface PastYearAnswer {
  places: number;
  milestones: number;
  wishes: number;
  /** 0 — не сказано; 1…5 — наскільки насиченим був рік. */
  fullness: number;
}

export const EMPTY_ANSWER: Readonly<PastYearAnswer> = Object.freeze({
  places: 0, milestones: 0, wishes: 0, fullness: 0,
});

/** Стеля одного лічильника на реєстрації — сказане має бути спогадом, а не важелем. */
export const PAST_COUNT_MAX = 30;

/**
 * Насиченість → скільки памʼятних моментів.
 *
 * Шкала зростає швидше за лінійну, бо «дуже насичений рік» пара пам'ятає
 * як набагато густіший, ніж «звичайний»; і лишається далеко під стелею
 * `DECLARED_MAX`, щоб жодна кнопка не стала важелем.
 */
export const FULLNESS_PHOTOS: readonly number[] = [0, 3, 8, 15, 25, 40];

export const FULLNESS_TEXT: readonly string[] = [
  '',
  'тихий',
  'спокійний',
  'звичайний',
  'насичений',
  'дуже насичений',
];

const clampCount = (value: number): number => (
  Number.isFinite(value) ? Math.min(PAST_COUNT_MAX, Math.max(0, Math.floor(value))) : 0
);
const clampFullness = (value: number): number => (
  Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value))) : 0
);

/** Рік стосунків для екрана: ключ і підпис. */
export interface PastYearSpan {
  /** `startsAt` року — той самий ключ, яким рік названо в `sweep_declared_counts`. */
  startsAt: string;
  endsAt: string;
  /** «Перший рік» — заголовок. */
  label: string;
  /** «2021–2022» — підпис над ним. */
  range: string;
}

/**
 * Роки, про які питати: лише прожиті (`complete`).
 *
 * Поточний рік пара проживає просто в порталі — питати про нього «як це
 * було» означало б вигадувати те, що ще не сталося.
 */
export function pastYearSpans(startedAt: string, today: string): PastYearSpan[] {
  return relationshipYears(startedAt, today, 'feb-28')
    .filter((year) => year.complete)
    .map((year) => ({
      startsAt: year.startsAt,
      endsAt: year.endsAt,
      label: `${ordinalYear(year.index + 1)} рік`,
      range: `${year.startsAt.slice(0, 4)}–${year.endsAt.slice(0, 4)}`,
    }));
}

const ORDINALS = ['Перший', 'Другий', 'Третій', 'Четвертий', 'Пʼятий', 'Шостий', 'Сьомий', 'Восьмий', 'Девʼятий', 'Десятий'];

function ordinalYear(n: number): string {
  return ORDINALS[n - 1] ?? `${n}-й`;
}

/** Чи сказано хоч щось — від цього залежить, чи «вирощувати» перед головною. */
export function hasAnyAnswer(answers: Readonly<Record<string, PastYearAnswer>>): boolean {
  return Object.values(answers).some((a) => (
    clampCount(a.places) + clampCount(a.milestones) + clampCount(a.wishes) + clampFullness(a.fullness) > 0
  ));
}

/**
 * Відповіді реєстрації → сказані числа (`DeclaredCounts`), злиті з тим, що
 * вже збережено. Відповідь про рік ЗАМІНЮЄ сказане про нього в цих родах —
 * пара щойно відповіла на це питання, — а роди, про які екран не питав
 * (фільми, серіали), лишаються як були.
 */
export function mergePastYears(
  saved: DeclaredCounts,
  answers: Readonly<Record<string, PastYearAnswer>>,
): DeclaredCounts {
  const next: DeclaredCounts = { ...saved };
  for (const key of Object.keys(answers).sort()) {
    const answer = answers[key]!;
    const year: DeclaredYear = { ...next[key] };
    const set = (kind: keyof DeclaredYear, value: number) => {
      if (value > 0) year[kind] = value;
      else delete year[kind];
    };
    set('places', clampCount(answer.places));
    set('milestones', clampCount(answer.milestones));
    set('wishes', clampCount(answer.wishes));
    set('photos', FULLNESS_PHOTOS[clampFullness(answer.fullness)] ?? 0);
    if (Object.keys(year).length > 0) next[key] = year;
    else delete next[key];
  }
  return next;
}

/** «2 роки» — для підписів кроку минулих років. */
export const yearsWord = (count: number) => plural(count, 'рік', 'роки', 'років');

const EMPTY_HISTORY: EvolutionSourceSnapshot = {
  calendarEvents: [], plans: [], wishlistItems: [], mapPlaces: [], memories: [], memoryLinks: [], media: [],
};

/**
 * Знімок, з якого росте об'єкт нової пари на кроці «вирощуємо».
 *
 * Той самий шлях, що й у порталі (`portalSources.ts`): історія пари —
 * порожня, бо вона щойно зареєструвалась, — плюс домішка сказаного
 * числами, розкладена по тих самих роках стосунків. Тобто острів на
 * екрані реєстрації — це саме те, що пара побачить на головній, а не
 * окрема «анімація росту».
 */
export function grownSnapshot(startedAt: string, today: string, counts: DeclaredCounts): CrystalV2Snapshot {
  const years = relationshipYears(startedAt, today, 'feb-28');
  const { snapshot } = padSnapshotWithDeclared(EMPTY_HISTORY, counts, years);
  return crystalV2SnapshotFrom({
    relationshipStartedAt: startedAt,
    asOf: today,
    snapshot,
    sharedDaysOff: [],
    partners: null,
  });
}

/**
 * «ваш кристал / ваше дерево / ваш риф» і займенник після нього.
 * Таблицею, як `HOME_ARTIFACT_LOCATIVE`: видів три, рід у кожного свій, і
 * «ваш дерево» — перше, що побачила б пара на кроці росту.
 */
export const SPECIES_POSSESSIVE = {
  crystal: { your: 'ваш кристал', it: 'він' },
  tree: { your: 'ваше дерево', it: 'воно' },
  reef: { your: 'ваш вулкан', it: 'він' },
} as const;
