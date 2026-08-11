// ============================================================
// Розкладка подій по місяцю й по року.
// ------------------------------------------------------------
// Модуль зветься «Календар», а календарної сітки в ньому не було: лише
// списки, відсортовані за близькістю. Побачити «що в липні» було
// неможливо.
//
// Ключова відмінність від `nextOccurrence`: там питання «коли ця подія
// буде НАЙБЛИЖЧЕ», тут — «чи випадає вона на ЦЕЙ конкретний день».
// Переглядаючи березень 2028-го, треба бачити 8 березня, хоч найближче
// настання давно позаду.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { daysInMonth } from '@/features/_shared/month';
import { sameDayInYear } from './calendarUtils';
import type { EventRow } from '@/types';

/**
 * На який день переглядуваного місяця випадає подія, або null.
 *
 * Затискання 29 лютого — те саме, що в `nextOccurrence`: у невисокосному
 * році подія показується 28-го, а не 1 березня. Конвенція одна на весь
 * модуль, тож `sameDayInYear` тут перевикористовується, а не копіюється.
 */
export function dayInMonth(ev: EventRow, yr: number, mo: number): number | null {
  const orig = localDateFromISO(ev.date);
  if (Number.isNaN(orig.getTime())) return null;

  if (!ev.yearly) {
    return orig.getFullYear() === yr && orig.getMonth() + 1 === mo ? orig.getDate() : null;
  }
  if (orig.getMonth() + 1 !== mo) return null;
  return sameDayInYear(yr, mo - 1, orig.getDate()).getDate();
}

/**
 * День місяця → події цього дня.
 *
 * Порядок усередині дня сталий (за id), щоб кольорові крапки не
 * переставлялись між перемальовуваннями.
 */
export function eventsByDay(
  events: readonly EventRow[],
  yr: number,
  mo: number,
): Map<number, EventRow[]> {
  const out = new Map<number, EventRow[]>();
  for (const ev of events) {
    const day = dayInMonth(ev, yr, mo);
    if (day === null || day < 1 || day > daysInMonth(yr, mo)) continue;
    const bucket = out.get(day);
    if (bucket) bucket.push(ev);
    else out.set(day, [ev]);
  }
  for (const list of out.values()) list.sort((a, b) => a.id - b.id);
  return out;
}

// Річний огляд прибрано разом зі сторінкою календаря: власник звів календар і
// плани в один модуль із двома вкладками. `MonthSummary`, `MonthHeat`,
// `yearHeat` і `yearSummary` жили лише для нього — і без нього лишились би
// кодом, у якого немає жодного викликача, крім власного тесту.
