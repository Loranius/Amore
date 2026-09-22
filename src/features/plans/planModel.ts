// ============================================================
// Чисті функції модуля «Плани».
// ------------------------------------------------------------
// Без React і без Supabase — як planLinkModel поруч. Тут живе
// вся логіка, за якою модуль вирішує, що показати першим, що вважати
// найближчим і як назвати неточну дату. Саме її й покривають тести:
// решта модуля — розкладка навколо цих відповідей.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { MONTHS_UA_GENITIVE } from '@/features/_shared/month';
import { PLAN_STATUSES, PLAN_STATUS_ORDER } from './planConstants';
import type { PlanRow, PlanStatus, PlanTaskRow } from '@/types';
import { byCodePoint } from '@/engine/ordering';

/** Чи план уже не в роботі (виконаний, відкладений або скасований). */
export function isClosed(plan: PlanRow): boolean {
  return PLAN_STATUSES[plan.status].closed;
}

/**
 * Чи цей план узагалі має що показувати в календарі.
 *
 * Лише точний день і період: «осінь 2026» у сітці місяця не має де
 * стояти, а поставити її на 1 вересня означало б збрехати про дату.
 */
export function showsInCalendar(plan: PlanRow): boolean {
  return plan.start_date !== null
    && (plan.date_precision === 'day' || plan.date_precision === 'range');
}

/** Скільки днів до початку; null коли дати немає. Минуле — від'ємне. */
export function daysUntilStart(plan: PlanRow, today = new Date()): number | null {
  if (!plan.start_date) return null;
  const start = localDateFromISO(plan.start_date);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start.getTime() - midnight.getTime()) / 86_400_000);
}

/**
 * Останній день плану: для періоду — `end_date`, інакше сам початок.
 *
 * Жив у `calendar/calendarPlans.ts` приватною функцією, і саме тому
 * «коли план скінчиться» знав календар, а модуль «Плани» — ні. Тепер
 * відповідь одна на обох, і стоїть вона поруч із «коли почнеться».
 *
 * Зіпсований діапазон (кінець раніше початку) читаємо як один день, а не
 * як порожній: план не має тихо зникати через це ні з сітки, ні з відліку.
 */
export function lastDayOf(plan: PlanRow): Date | null {
  if (!plan.start_date) return null;
  const start = localDateFromISO(plan.start_date);
  if (Number.isNaN(start.getTime())) return null;
  if (plan.date_precision !== 'range' || !plan.end_date) return start;
  const end = localDateFromISO(plan.end_date);
  return Number.isNaN(end.getTime()) || end.getTime() < start.getTime() ? start : end;
}

/** Скільки днів до останнього дня; null коли дати немає. Минуле — від'ємне. */
export function daysUntilEnd(plan: PlanRow, today = new Date()): number | null {
  const end = lastDayOf(plan);
  if (end === null) return null;
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - midnight.getTime()) / 86_400_000);
}

/**
 * Де план стоїть у часі.
 *
 * `upcoming` — ще не почався (сьогоднішній теж тут: день ще попереду);
 * `running`  — почався й не скінчився. Буває лише в періоду;
 * `past`     — скінчився.
 */
export type PlanPhase = 'upcoming' | 'running' | 'past';

export function planPhase(plan: PlanRow, today = new Date()): PlanPhase | null {
  const start = daysUntilStart(plan, today);
  if (start === null) return null;
  if (start >= 0) return 'upcoming';
  const end = daysUntilEnd(plan, today);
  return end !== null && end >= 0 ? 'running' : 'past';
}

/**
 * ЩО САМЕ СКАЗАТИ ПРО ЧАС ПЛАНУ — одна відповідь на всі три місця, де її
 * показують (картка, плитка, сторінка плану).
 *
 * ЧОМУ ЦЕ З'ЯВИЛОСЬ. Усі троє рахували те саме самотужки:
 *
 *     const days = hasPreciseDate(plan) ? daysUntilStart(plan) : null;
 *     const overdue = !closed && days !== null && days < 0;
 *
 * І всі троє однаково брехали про ПЕРІОД. «Ремонт хати, 1 липня 2026 –
 * 1 січня 2028» наступного ж дня після початку діставав червоне
 * «81 дн. тому» (`color: var(--danger)`), тобто докір за план, який саме
 * триває й до кінця якого ще шістнадцять місяців. Будь-який діапазон
 * ставав «простроченим» назавтра після старту.
 *
 * Причина в одному: `daysUntilStart` міряє від ПОЧАТКУ, а «минув чи ні»
 * вирішує КІНЕЦЬ. Поле `end_date` при цьому було поруч і вже
 * використовувалось сусідньою `planDateLabel` — саме воно й друкує «до
 * 1 січня 2028». Дані були, їх не питали.
 *
 * Для точного дня нічого не змінюється: у нього кінець і є початком.
 *
 * Про закритий план тут не судимо — це не питання часу. Хто його показує,
 * той і вирішує (виконаному «−9 днів» означало б докір за зроблене).
 */
export interface PlanCountdown {
  phase: PlanPhase;
  label: string;
}

export function planCountdown(plan: PlanRow, today = new Date()): PlanCountdown | null {
  if (!hasPreciseDate(plan)) return null;
  const phase = planPhase(plan, today);
  if (phase === null) return null;
  if (phase === 'running') return { phase, label: 'триває' };
  const days = phase === 'upcoming' ? daysUntilStart(plan, today) : daysUntilEnd(plan, today);
  if (days === null) return null;
  return { phase, label: daysLabel(days) };
}

/**
 * Чи можна назвати кількість днів до плану, не збрехавши про точність.
 *
 * «Через 1 міс.» під датою «осінь 2026» обіцяє знання, якого немає:
 * 1 вересня там стоїть лише як початок періоду. Тому зворотний відлік
 * показуємо рівно там само, де план потрапляє в календар.
 */
export function hasPreciseDate(plan: PlanRow): boolean {
  return showsInCalendar(plan);
}

/**
 * Найближчий план — той, заради якого відкривають модуль.
 *
 * Береться лише з тих, що в роботі й мають ТОЧНУ дату в майбутньому
 * (або сьогодні). Три відсіювання, кожне зі своєї причини:
 *
 * • без дати — «колись наступного року» не має стояти попереду
 *   сьогоднішнього;
 * • неточна дата — акцентна картка друкує зворотний відлік, а для
 *   сезону його нема звідки взяти чесно;
 * • непідтверджена пропозиція — це ще не спільний план, а питання до
 *   партнера. Вона мусить лишитись у списку, де є кнопка «Підтвердити»,
 *   якої в акцентній картці немає.
 */
export function nextPlan(plans: readonly PlanRow[], today = new Date()): PlanRow | null {
  let best: PlanRow | null = null;
  let bestDays = Infinity;
  for (const plan of plans) {
    if (isClosed(plan) || !plan.confirmed || !hasPreciseDate(plan)) continue;
    const days = daysUntilStart(plan, today);
    if (days === null || days < 0) continue;
    if (days < bestDays) { best = plan; bestDays = days; }
  }
  return best;
}

/**
 * Порядок у списку: спершу найближчі за датою, потім бездатні, потім
 * закриті. Усередині бездатних — новіші зверху.
 *
 * Повертає НОВИЙ масив: сортування на місці зіпсувало б кеш React Query,
 * бо масив із нього віддається за посиланням.
 */
export function sortPlans(plans: readonly PlanRow[], today = new Date()): PlanRow[] {
  const rank = (p: PlanRow): number => (isClosed(p) ? 2 : p.start_date ? 0 : 1);
  return [...plans].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      const da = daysUntilStart(a, today)!;
      const db = daysUntilStart(b, today)!;
      /*
       * Минулі лишаються серед датованих, але в кінці своєї групи:
       * прострочений план не має ховатись, він потребує уваги.
       *
       * «Минулий» тут означає СКІНЧИВСЯ, а не «почався». Інакше план,
       * що саме триває, падав би вниз разом із простроченими — та сама
       * вада, що й у червоному бейджі, тільки висловлена порядком.
       *
       * Той, що триває, опиняється попереду майбутніх (його початок
       * від'ємний), і це правильно: те, що відбувається зараз, і є
       * найближчим.
       */
      const aPast = planPhase(a, today) === 'past';
      const bPast = planPhase(b, today) === 'past';
      if (aPast !== bPast) return aPast ? 1 : -1;
      if (da !== db) return da - db;
    }
    return byCodePoint(b.created_at, a.created_at);
  });
}

export interface PlanReadiness {
  total: number;
  done: number;
  /** 0…100, ціле. Без завдань — 0, а не 100. */
  percent: number;
}

/**
 * Готовність плану за завданнями.
 *
 * План без завдань — 0%, а не 100%: порожній список означає «підготовку
 * ще не почали», а не «все зроблено». Протилежна відповідь показувала б
 * щойно створену ідею повністю готовою.
 */
export function readiness(tasks: readonly PlanTaskRow[]): PlanReadiness {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Перше невиконане завдання за порядком — «що далі». */
export function nextTask(tasks: readonly PlanTaskRow[]): PlanTaskRow | null {
  const open = [...tasks]
    .filter((t) => !t.done)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  return open[0] ?? null;
}

const SEASONS = ['зима', 'весна', 'літо', 'осінь'] as const;

/** Сезон за місяцем початку: грудень-лютий — зима, і так далі. */
function seasonOf(month: number): string {
  return SEASONS[Math.floor(((month + 1) % 12) / 3)]!;
}

/**
 * Підпис дати під її точністю.
 *
 * `start_date` завжди зберігає початок періоду, тому один рядок у базі
 * читається шістьма різними способами — і саме це робить неточні дати
 * сортовними нарівні з точними.
 */
/**
 * Наступний робочий стан плану, або null у кінці шляху.
 *
 * Тут, а не в сторінці, бо це правило порядку станів, а не показу — і
 * тому його можна перевірити без React.
 *
 * Закриті стани (виконано, скасовано) наступного не мають: вони не
 * «далі» по шляху, а вихід із нього.
 */
export function nextActiveStatus(status: PlanStatus): PlanStatus | null {
  if (PLAN_STATUSES[status].closed) return null;
  const active = PLAN_STATUS_ORDER.filter((key) => !PLAN_STATUSES[key].closed);
  const index = active.indexOf(status);
  if (index < 0 || index + 1 >= active.length) return null;
  return active[index + 1]!;
}

export function planDateLabel(plan: PlanRow): string | null {
  if (!plan.start_date) return null;
  const d = localDateFromISO(plan.start_date);
  const month = MONTHS_UA_GENITIVE[d.getMonth()] ?? '';
  switch (plan.date_precision) {
    case 'day':
      return `${d.getDate()} ${month} ${d.getFullYear()}`;
    case 'range': {
      if (!plan.end_date) return `${d.getDate()} ${month} ${d.getFullYear()}`;
      const e = localDateFromISO(plan.end_date);
      // «12–14 серпня» — місяць один раз, коли він спільний.
      if (e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear()) {
        return `${d.getDate()}–${e.getDate()} ${month} ${d.getFullYear()}`;
      }
      const em = MONTHS_UA_GENITIVE[e.getMonth()] ?? '';
      return `${d.getDate()} ${month} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    }
    case 'month':
      return `${month} ${d.getFullYear()}`;
    case 'season':
      return `${seasonOf(d.getMonth())} ${d.getFullYear()}`;
    case 'year':
      return String(d.getFullYear());
    case 'none':
      return null;
  }
}
