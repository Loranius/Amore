// ============================================================
// Дві чисті відповіді, на яких тримається екран історії.
// ------------------------------------------------------------
// Обидві живуть окремо від React навмисно: у них уже була по помилці, і
// жодну з них не було видно ані з типів, ані з екрана — лише з числа.
// ============================================================
import type { PlanCategory } from '@/types';
import type { RelationshipYearFill } from './yearFills';


export type SweepStep = 'date' | 'anniversaries' | 'years';

/**
 * Віха року — те, що пара додає одним дотиком.
 *
 * `category` тут не оздоба: рушій бере з неї КАНАЛ, яким росте артефакт
 * (`adapters/rules.ts`). Подорож — це exploration, переїзд — stability,
 * весілля — culture зі значущістю, навчання — achievement. Тобто вісім
 * фішок нижче не просто рахують події: вони вирішують, ЯКИМ вийде
 * артефакт року.
 */
export interface Milestone {
  label: string;
  /**
   * `PlanCategory`, а не власний перелік. Категорія тут читається ДВІЧІ:
   * порталом — щоб намалювати картку плану, і рушієм — щоб узяти канал
   * росту. Власний перелік розійшовся б із першим мовчки, а з другим —
   * ще тихіше: невідому категорію `adapters/plans.ts` не відкидає, а
   * підміняє на `other`. Тобто фішка «Подорож» і далі рахувалась би,
   * але росла б сталістю замість дослідження, і екран обіцяв би те,
   * чого не робить.
   */
  category: PlanCategory;
}

export const YEAR_MILESTONES: readonly Milestone[] = [
  { label: 'Подорож', category: 'trip' },
  { label: 'Переїзд', category: 'home' },
  { label: 'Весілля', category: 'event' },
  { label: 'Навчання', category: 'learning' },
  { label: 'Побачення, яке пам\'ятаємо', category: 'date' },
  { label: 'Відпочинок', category: 'rest' },
  { label: 'Концерт', category: 'event' },
  { label: 'Щось своє', category: 'other' },
];

export interface SweepState {
  relationshipStartedAt: string;
  yearlyAnniversaryCount: number;
}

/**
 * Який крок показати.
 *
 * КРОК ВИВОДИТЬСЯ, А НЕ ЗБЕРІГАЄТЬСЯ. Спокуса завести
 * `settings.history_sweep_step` була, і від неї відмовлено: збережений
 * крок — це другий стан, який розходиться з першим. Пара додала річницю
 * в календарі поза онбордингом — збережений крок про це не знає й далі
 * питає те, що вже є.
 *
 * Виведений такої вади не має за побудовою, і саме тому екран можна
 * відкрити будь-коли: він завжди показує те, чого бракує, а не те, на
 * чому колись зупинились.
 */
export function sweepStepOf(state: SweepState): SweepStep {
  if (state.relationshipStartedAt.trim() === '') return 'date';
  return state.yearlyAnniversaryCount === 0 ? 'anniversaries' : 'years';
}

/**
 * Середина року стосунків — дата, яку отримує віха.
 *
 * Пара пам'ятає РІК, а не день: «ми переїхали у сімнадцятому». Ставити
 * перше число року означало б збити всі віхи в одну купу на межі,
 * ставити сьогоднішній день — покласти минуле в теперішнє. Середина
 * чесніша за обидва, і поруч із нею йде `date_precision: 'year'`, тобто
 * портал показує рік, а не вигаданий день.
 */
export function middleOfYear(startsAt: string, endsAt: string): string {
  const from = Date.parse(`${startsAt}T00:00:00.000Z`);
  const to = Date.parse(`${endsAt}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return startsAt;
  return new Date(from + (to - from) / 2).toISOString().slice(0, 10);
}

/**
 * З якого року починати прохід — із найтихішого.
 *
 * Не з першого: пара кине на середині, і кинути треба там, де вже все
 * одно порожньо. Береться найменш наповнений ЗАВЕРШЕНИЙ рік; якщо
 * завершених немає — перший-ліпший.
 */
export function quietestYearIndex(years: readonly RelationshipYearFill[]): number {
  let best = -1;
  let lowest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < years.length; index += 1) {
    const year = years[index]!;
    if (!year.complete) continue;
    if (year.fill < lowest) { lowest = year.fill; best = index; }
  }
  return best === -1 ? 0 : best;
}

/**
 * Скільки років ПОЗАДУ — тобто завершених річницею.
 *
 * Не довжина масиву: рік, який іде зараз, теж має свій стовпчик, і перша
 * редакція смуги через це писала «4 роки разом» парі, яка разом три роки
 * й вісім місяців. Головна тим часом чесно рахувала 1344 дні. Смуга не
 * має права додавати парі року, якого ще не було.
 */
export function yearsBehind(years: readonly RelationshipYearFill[]): number {
  return years.filter((year) => year.complete).length;
}

/**
 * Якому року стосунків належить день.
 *
 * Потрібне, щоб сказати парі правду про місце, яке вже є на карті: мітка
 * тримає рівно одну дату, і якщо вона вже датована, екран має назвати
 * той рік, а не мовчки нічого не зробити.
 *
 * Порівняння рядкове й напівінтервалом `[startsAt, endsAt)`: межа року —
 * це річниця, і день річниці належить рокові, який ПОЧИНАЄТЬСЯ, а не
 * тому, що закінчився. Дати тут завжди `YYYY-MM-DD`, тож лексикографічне
 * порівняння збігається з хронологічним і не заводить часових поясів
 * туди, де їх немає.
 */
export function yearContaining(
  years: readonly RelationshipYearFill[],
  day: string,
): RelationshipYearFill | null {
  const at = day.slice(0, 10);
  if (at === '') return null;
  return years.find((year) => at >= year.startsAt && at < year.endsAt) ?? null;
}
