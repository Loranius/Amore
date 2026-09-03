// ============================================================
// Що лежить у році — і що з цього екрана можна прибрати.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «не можна видаляти "що було того року" які випадково
// додав». Чипи додають одним дотиком і миттєво; прибрати не було як
// НІЯК — ані тут, ані підказкою, куди йти. Асиметрія «один дотик туди,
// жодного назад» — це не незручність, а пастка: помилковий дотик тихо
// змінює канал росту артефакта (`adapters/rules.ts`), і пара про це
// навіть не дізнається.
//
// Друга половина тієї ж скарги — «візуально важко зрозуміти що де».
// Екран показував рік ЧИСЛОМ: «Уже 5». П'ять чого? Пара не бачила ні
// що це, ні котре з них зайве. Тому список тут показує РІК ЦІЛКОМ, а не
// лише свої рядки: інакше число й перелік розходились би, і плутанина
// стала б гіршою, ніж була.
//
// ЩО МОЖНА ПРИБРАТИ, А ЩО НІ. Рядок належить цьому екранові, якщо він
// має його ПІДПИС — середина року стосунків і рівно `12:00:00.000Z`.
// Підпис не вигаданий заради видалення: прохід ставив саме ці значення
// від самого початку (`middleOfYear`, `sweepModel.ts`), бо пара пам'ятає
// рік, а не день. Рядок, який пара завела в «Планах» руками, такої
// позначки не має — і кнопки видалення в нього тут теж немає, бо
// прибирати з онбордингу справжній план пари було б рівно тією самою
// вадою, тільки в інший бік.
// ============================================================
import { middleOfYear } from './sweepModel';
import type { RelationshipYearFill } from './yearFills';

/** Позначка часу, якою прохід підписує все, що створює. */
export const SWEEP_STAMP = 'T12:00:00.000Z';

/**
 * Чи це та сама мить, ЯК БИ ЇЇ НЕ ЗАПИСАЛИ.
 *
 * ВАДА, ЧЕРЕЗ ЯКУ ЕКРАН НЕ ДАВАВ ПРИБРАТИ НІЧОГО ЗІ СВОГО Ж (ADR-0110).
 *
 * Підпис проходу порівнювався РЯДКАМИ: `completedAt === '2023-06-27T12:00:00.000Z'`.
 * Портал так його й пише, але назад із бази він приходить у власному
 * записі PostgREST — `2023-06-27T12:00:00+00:00`. Це та сама мить, і всі
 * порівняння рядків її не впізнавали.
 *
 * Наслідок був рівно той, проти якого цей файл і заводився: кожен рядок,
 * доданий проходом, повертався з бази ЧУЖИМ — тьмяним, без хрестика, з
 * приміткою «міняють там, де завели». Пара додавала віху одним дотиком і
 * не могла її прибрати ніяк, а екран ще й казав їй, що це не її рядок.
 *
 * Тому порівнюються МИТІ, а не тексти. `Date.parse` розуміє обидва записи
 * й обидва зводить до одного числа; недійсна дата дає `NaN`, а `NaN !== NaN`,
 * тож сміття само собою не збігається ні з чим.
 */
export function sameInstant(left: string | null, right: string): boolean {
  if (typeof left !== 'string' || !ZONED.test(left)) return false;
  const parsed = Date.parse(left);
  return Number.isFinite(parsed) && parsed === Date.parse(right);
}

/**
 * Позначка часового поясу в кінці рядка — `Z` або `+02:00`.
 *
 * БЕЗ НЕЇ `Date.parse` ЧИТАЄ РЯДОК ЯК МІСЦЕВИЙ ЧАС, тобто відповідь
 * залежала б від того, у якому поясі стоїть телефон: `...T12:00:00` у Києві
 * це 09:00Z, а на сервері тестів — 12:00Z. Один і той самий рядок бази то
 * збігався б із підписом проходу, то ні, залежно від того, хто дивиться.
 *
 * Рядок без пояса підписом не вважається взагалі: портал такого не пише, а
 * гадати за нього — це саме та тиха залежність від місця, якої тут не має
 * бути.
 */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/;

export type SweepEntryKind = 'milestone' | 'place' | 'watched';

export interface SweepEntry {
  kind: SweepEntryKind;
  /** `id` рядка в його власній таблиці. */
  id: number;
  label: string;
  /** Другий рядок — рік випуску фільму, місто мітки. Порожній рядок = немає. */
  detail: string;
  /**
   * Чи прибирається звідси.
   *
   * `false` означає «рядок пари, не наш»: він рахується в рік і його
   * видно, але міняють його там, де завели.
   */
  removable: boolean;
}

/** Рядки, з яких складається список. Рівно ті поля, які потрібні. */
export interface SweepEntryRows {
  plans: readonly {
    id: number;
    title: string;
    status: string;
    startDate: string | null;
    completedAt: string | null;
    datePrecision: string;
  }[];
  places: readonly {
    id: number;
    title: string;
    city: string | null;
    visitedAt: string | null;
  }[];
  watched: readonly {
    id: number;
    title: string;
    type: string;
    finishedAt: string | null;
  }[];
}

const KIND_WORD: Record<string, string> = { movie: 'фільм', series: 'серіал' };

/** Чи має рядок підпис проходу для саме цього року. */
export function isSweepPlan(
  plan: SweepEntryRows['plans'][number],
  middle: string,
): boolean {
  return plan.status === 'done'
    && plan.datePrecision === 'year'
    && (plan.startDate ?? '').slice(0, 10) === middle
    && sameInstant(plan.completedAt, `${middle}${SWEEP_STAMP}`);
}

export function isSweepWatched(
  item: SweepEntryRows['watched'][number],
  middle: string,
): boolean {
  return sameInstant(item.finishedAt, `${middle}${SWEEP_STAMP}`);
}

/**
 * Мітка карти належить рокові рівно тоді, коли її дата — середина цього
 * року. Прибрати мітку прохід не має права взагалі: він її або створив,
 * або лише ДАТУВАВ наявну (`ensurePlacePin`), і розрізнити ці два випадки
 * заднім числом нічим. Тому зворотна дія тут одна на обидва — зняти
 * дату, — і саме її називає підпис у списку.
 */
export function isSweepPlace(
  place: SweepEntryRows['places'][number],
  middle: string,
): boolean {
  return typeof place.visitedAt === 'string' && place.visitedAt.slice(0, 10) === middle;
}

const withinYear = (day: string | null | undefined, year: RelationshipYearFill): boolean => (
  typeof day === 'string' && day.slice(0, 10) >= year.startsAt && day.slice(0, 10) < year.endsAt
);

/**
 * Усе, що рік містить, за трьома питаннями екрана.
 *
 * Порядок стійкий і навмисний: спершу те, що прибирається (найновіше
 * зверху — саме там лежить щойно помилковий дотик), потім решта. Сорту
 * за `localeCompare` тут немає й бути не може: порядок мусить бути
 * однаковий у всіх, а не залежати від мови телефона.
 */
export function sweepEntriesFor(
  rows: SweepEntryRows,
  year: RelationshipYearFill,
): Record<SweepEntryKind, SweepEntry[]> {
  const middle = middleOfYear(year.startsAt, year.endsAt);

  const milestone: SweepEntry[] = rows.plans
    .filter((plan) => plan.status === 'done' && withinYear(
      plan.completedAt ?? plan.startDate, year,
    ))
    .map((plan) => ({
      kind: 'milestone' as const,
      id: plan.id,
      label: plan.title,
      detail: '',
      removable: isSweepPlan(plan, middle),
    }));

  const place: SweepEntry[] = rows.places
    .filter((row) => withinYear(row.visitedAt, year))
    .map((row) => ({
      kind: 'place' as const,
      id: row.id,
      label: row.title,
      detail: row.city ?? '',
      removable: isSweepPlace(row, middle),
    }));

  const watched: SweepEntry[] = rows.watched
    .filter((row) => withinYear(row.finishedAt, year))
    .map((row) => ({
      kind: 'watched' as const,
      id: row.id,
      label: row.title,
      detail: KIND_WORD[row.type] ?? '',
      removable: isSweepWatched(row, middle),
    }));

  const order = (list: SweepEntry[]) => list.sort((left, right) => {
    if (left.removable !== right.removable) return left.removable ? -1 : 1;
    return right.id - left.id;
  });

  return {
    milestone: order(milestone),
    place: order(place),
    watched: order(watched),
  };
}
