import { byCodePoint } from '@/engine/ordering';
import { isClosed, lastDayOf, daysUntilEnd, daysUntilStart, hasPreciseDate, planPhase } from './planModel';
import type { PlanRow } from '@/types';

// ============================================================
// Хто стоїть у фокусі екрана «Плани», і чим зайнята колода.
// ------------------------------------------------------------
// ЗВІДКИ ЦЕ. Власник: «не подобається взагалі все». Три напрями зняті в
// `plans-lab.html`, обрано варіант C — вісь РІШЕННЯ. Його теза виходить із
// заміру справжніх даних пари, а не зі смаку: **п'ять із шести відкритих
// записів не мають дати**. Отже робота екрана не «показати список», а
// перетворити задум на план.
//
// Звідси дві сутності, і обидві живуть тут, бо це рішення, а не оформлення:
//
//   focusPlan  — один план, заради якого відкривають модуль;
//   ideaQueue  — черга задумів, яким бракує саме дати.
//
// ЧОМУ НЕ `nextPlan` ІЗ `planModel`. Вона відсіює все, що вже почалось
// (`days < 0`), бо відповідає на питання «що попереду». «Ремонт хати» іде
// вже 84 дні — для неї його немає, а для екрана він і є головним. Це та
// сама межа, яку ADR-0201 уже знайшов у сортуванні: те, що відбувається
// ЗАРАЗ, і є найближчим.
// ============================================================

export interface PlanProgress {
  /** Днів від початку до сьогодні. */
  elapsed: number;
  /** Днів від початку до останнього дня. */
  total: number;
  /** `elapsed / total`, затиснуте в 0..1. */
  ratio: number;
}

/**
 * Скільки плану вже позаду — і лише там, де це питання має сенс.
 *
 * `null` для всього, крім ПЕРІОДУ, ЩО ВЖЕ ПОЧАВСЯ. У точного дня немає
 * поступу: він або попереду, або позаду, і смуга на 0% чи 100% сказала б
 * менше, ніж «через 4 дні». У періоду, що ще не настав, смуга показувала б
 * нуль щодня протягом місяців — тобто нерухомий елемент, який виглядає як
 * зламаний.
 *
 * Зіпсований діапазон (кінець раніше початку) `lastDayOf` уже читає як один
 * день, тож `total` тут ніколи не від'ємний; нуль теж можливий (період
 * завдовжки в день), і ділення на нього дало б `Infinity` — саме тому
 * нижче стоїть окрема гілка, а не `Math.min(1, e / t)`.
 */
export function planProgress(plan: PlanRow, today = new Date()): PlanProgress | null {
  if (plan.date_precision !== 'range' || !hasPreciseDate(plan)) return null;
  const started = daysUntilStart(plan, today);
  const end = lastDayOf(plan);
  if (started === null || started > 0 || end === null) return null;

  const elapsed = -started;
  const remaining = daysUntilEnd(plan, today);
  if (remaining === null) return null;
  const total = elapsed + remaining;
  if (total <= 0) return { elapsed, total: Math.max(0, total), ratio: 1 };
  return { elapsed, total, ratio: Math.min(1, Math.max(0, elapsed / total)) };
}

/**
 * План, який займає верх екрана.
 *
 * Порядок переваги названий, а не випадковий:
 *
 *   1. те, що ТРИВАЄ — воно вже почалось, і це найближче з можливого;
 *      серед кількох таких — те, що скінчиться раніше;
 *   2. те, що ПОПЕРЕДУ — найближче за датою старту;
 *   3. нічого: у пари може не бути жодного плану з датою, і це законний
 *      стан, а не порожнеча, яку треба ховати.
 *
 * Закриті не беруться взагалі: виконаному плану не місце в «зараз».
 * Неточні дати теж ні — «осінь 2026» не дає чесного відліку
 * (`hasPreciseDate`), а верх екрана обіцяє саме число.
 *
 * ПРО `confirmed` НАВМИСНО НЕ ПИТАЄМО, і ось межа цього рішення: у базі
 * пари всі 18 планів `confirmed = true`, а `proposed_by` не заповнений
 * ЖОДНОГО разу. Тобто розрізнення «пропозиція проти спільного плану»
 * сьогодні не несе інформації, і відсіювати за ним означало б будувати
 * гілку під потік, якого немає. Кнопка «Підтвердити» лишається в списках
 * нижче, тож непідтверджений план нікуди не зникає.
 */
export function focusPlan(plans: readonly PlanRow[], today = new Date()): PlanRow | null {
  let running: PlanRow | null = null;
  let runningEnds = Infinity;
  let upcoming: PlanRow | null = null;
  let upcomingStarts = Infinity;

  for (const plan of plans) {
    if (isClosed(plan) || !hasPreciseDate(plan)) continue;
    const phase = planPhase(plan, today);
    if (phase === 'running') {
      const ends = daysUntilEnd(plan, today);
      if (ends !== null && ends < runningEnds) { running = plan; runningEnds = ends; }
    } else if (phase === 'upcoming') {
      const starts = daysUntilStart(plan, today);
      if (starts !== null && starts < upcomingStarts) { upcoming = plan; upcomingStarts = starts; }
    }
  }

  return running ?? upcoming;
}

/**
 * Задуми, яким бракує дати — найдавніший попереду.
 *
 * ПОРЯДОК ТУТ — ЦЕ ПРОДУКТОВА ДУМКА, а не зручність. Новіший зверху
 * показував би те, що й так свіже в пам'яті; найдавніший зверху показує
 * те, що лежить найдовше. «Secret Garden» чекає від 29 липня — саме таке
 * і варто підсунути першим.
 *
 * Порівняння — `byCodePoint` по `created_at` (ADR-0205): ISO-мітки, і
 * порядок не має залежати від мови телефона. `id` розводить збіги, бо
 * чотири записи цієї пари створені в одну секунду.
 */
export function ideaQueue(plans: readonly PlanRow[]): PlanRow[] {
  return plans
    .filter((plan) => !isClosed(plan) && plan.start_date === null)
    .sort((left, right) => byCodePoint(left.created_at, right.created_at) || left.id - right.id);
}

/**
 * Решта планів із датою — ті, що не стали фокусом.
 *
 * Потрібні, бо фокус показує ОДИН, а їх може бути більше. Без цього
 * списку план із датою міг би зникнути з екрана зовсім — рівно та вада,
 * від якої застерігає «ціна» варіанта C: список як список зникає, отже
 * кожному запису треба лишити двері.
 */
export function scheduledPlans(
  plans: readonly PlanRow[],
  today = new Date(),
  except: PlanRow | null = null,
): PlanRow[] {
  return plans
    .filter((plan) => (
      !isClosed(plan)
      && plan.start_date !== null
      && plan.id !== except?.id
    ))
    .sort((left, right) => {
      const a = daysUntilStart(left, today) ?? Infinity;
      const b = daysUntilStart(right, today) ?? Infinity;
      return a - b || left.id - right.id;
    });
}
