// ============================================================
// Розкладка планів по місяцю й по року.
// ------------------------------------------------------------
// Плани переїхали з `events` у власну таблицю, і календар мусить читати
// їх звідти — інакше «Вікенд у Карпатах 14 серпня» просто зник би з
// сітки, хоч у модулі «Плани» він на місці.
//
// Окремий файл, а не гілка в `calendarMonth.ts`: у подій і планів різні
// питання про дату. Подія має ОДИН день і буває щорічною; план має
// період і точність, і саме через це його не можна прогнати через
// `dayInMonth`. Спільного коду тут не було б — була б купа `if`.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { daysInMonth, ymd } from '@/features/_shared/month';
import { PLAN_STATUSES } from '@/features/plans/planConstants';
// `lastDayOf` жив тут приватним, і через це «коли план скінчиться» знав
// календар, а модуль «Плани» — ні; на цьому й виросла вада з червоним
// «81 дн. тому» (ADR-0201). Відповідь тепер одна, у моделі планів.
import { lastDayOf, showsInCalendar } from '@/features/plans/planModel';
import type { PlanRow } from '@/types';

/**
 * Чи цьому плану місце в сітці.
 *
 * Крім точності дати (`showsInCalendar` — лише день і період) відсіюємо
 * скасовані й відкладені: у них дата вже не означає нічого. Виконані
 * ЛИШАЮТЬСЯ — вони таки відбулись того дня, і в минулому місяці мають
 * стояти рівно так само, як минула подія.
 */
export function planShowsInGrid(plan: PlanRow): boolean {
  if (!showsInCalendar(plan)) return false;
  return plan.status !== 'cancelled' && plan.status !== 'postponed';
}

/**
 * ЧИ ЗАЙМАЄ ПЛАН САМЕ ЦЕЙ ДЕНЬ — одна відповідь на обидва календарі.
 *
 * ДВА ЕКРАНИ ДАВАЛИ ПРОТИЛЕЖНІ КАРТИНИ З ОДНОГО РЯДКА (аудит §4.2).
 * `/plans` ставив позначку на КОЖНОМУ дні діапазону, `/schedule` — лише
 * на `start_date`. У пари є «Ремонт хати, 1 липня 2026 – 1 січня 2028»,
 * і це єдиний план, що торкається вересня: у «Планах» він малював риску
 * під усіма тридцятьма днями, у «Графіку» — під жодним. А під сіткою
 * «Графіка» при цьому стояв підпис «крапка в кутку дня — на нього вже є
 * план», тобто легенда пояснювала позначку, якої на екрані не буває.
 *
 * ПРАВИЛО, ЯКЕ ЇХ ЗВОДИТЬ: позначка стоїть там, де план займає ДЕНЬ, а
 * не ввесь місяць.
 *
 * Діапазон займає кожен свій день — «12–14 серпня» має бути видно всі
 * три, інакше 13-те виглядає вільним. Але якщо він накриває показаний
 * місяць ЦІЛКОМ, жоден його день не виділяється серед інших: позначка,
 * що стоїть скрізь, не каже нічого (`DESIGN.md`, The Rare Colour Rule —
 * «колір несе стан»). Такий план показує лише свої краї, і лише в тих
 * місяцях, де вони стоять.
 *
 * ЧОМУ МЕЖА САМЕ МІСЯЦЬ, А НЕ ЧИСЛО ДНІВ. Будь-яке «довший за N днів —
 * фоновий» було б числом зі стелі, а цей проєкт уже знає, чим такі
 * числа закінчуються (ADR-0196). Місяць — не смак, а одиниця, яку сітка
 * показує: план, що накрив її всю, більше не відповідає на питання «які
 * саме дні зайняті», бо відповідь «усі» тотожна відповіді «жоден».
 *
 * Дані пари показують обидва кінці спектра в двох рядках: похід на 3 дні
 * й ремонт на 549.
 *
 * Що НЕ змінилось: точний день, період без кінця, зіпсований діапазон
 * (кінець раніше початку) і період через межу місяця — усе, як було.
 * Похід 30 серпня — 2 вересня й далі займає два дні в серпні та два у
 * вересні: він не накриває жодного місяця цілком.
 *
 * Місяць береться з самої дати — саме тому функція обходиться без
 * контексту сітки й однаково відповідає обом екранам.
 */
export function planOccupiesDate(plan: PlanRow, iso: string): boolean {
  if (!planShowsInGrid(plan)) return false;

  const day = localDateFromISO(iso);
  if (Number.isNaN(day.getTime())) return false;

  const start = localDateFromISO(plan.start_date!);
  if (Number.isNaN(start.getTime())) return false;
  const end = lastDayOf(plan) ?? start;

  if (day.getTime() < start.getTime() || day.getTime() > end.getTime()) return false;

  const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
  const monthEnd = new Date(
    day.getFullYear(), day.getMonth(), daysInMonth(day.getFullYear(), day.getMonth() + 1),
  );
  const coversWholeMonth = start.getTime() <= monthStart.getTime()
    && end.getTime() >= monthEnd.getTime();
  if (!coversWholeMonth) return true;

  // Накрив місяць цілком — лишаються тільки краї, якщо вони тут.
  return day.getTime() === start.getTime() || day.getTime() === end.getTime();
}

/**
 * Плани, що займають цей день; порядок сталий — за id.
 *
 * Сталість не про охайність: без неї крапки переставлялись би між
 * перемальовуваннями, та сама причина, що і в `eventsByDay`.
 */
export function plansOnDate(plans: readonly PlanRow[], iso: string): PlanRow[] {
  return plans.filter((plan) => planOccupiesDate(plan, iso)).sort((a, b) => a.id - b.id);
}

/**
 * День місяця → плани цього дня. Сітка «Планів» питає саме так.
 *
 * Тонкий шар над `planOccupiesDate`: правило одне, форма відповіді різна.
 */
export function plansByDay(
  plans: readonly PlanRow[],
  yr: number,
  mo: number,
): Map<number, PlanRow[]> {
  const out = new Map<number, PlanRow[]>();
  for (let day = 1; day <= daysInMonth(yr, mo); day += 1) {
    const list = plansOnDate(plans, ymd(yr, mo, day));
    if (list.length > 0) out.set(day, list);
  }
  return out;
}



/** Чи план уже закритий — для приглушеного вигляду рядка в сітці. */
export function planMuted(plan: PlanRow): boolean {
  return PLAN_STATUSES[plan.status].closed;
}

// `planYearTotal` і `plansByMonth` жили тут для річного огляду календаря. Огляд
// пішов разом зі сторінкою, коли календар став вкладкою «Планів», — і функції
// пішли за ним, щоб не лишитись кодом без викликача.
