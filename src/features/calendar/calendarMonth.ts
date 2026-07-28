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

export interface MonthSummary {
  /** 1–12. */
  month: number;
  count: number;
  /** Типи, що трапляються цього місяця — на крапки під назвою. */
  types: string[];
}

export interface MonthHeat extends MonthSummary {
  /** 0 — порожній місяць; далі 0.35…1 відносно найгустішого. */
  heat: number;
}

/**
 * Насиченість місяців відносно найгустішого в році.
 *
 * Річний огляд досі був двійковим: «є події» або «немає». Місяць із
 * п'ятьма подіями виглядав так само, як із однією, і питання «де в нас
 * густо» — заради якого цей вигляд і відкривають — лишалось без
 * відповіді.
 *
 * Порожній місяць — рівно 0, а не «трошки»: інакше в році, де максимум
 * дві події, різниця між нулем і одиницею зникає. Ненульові починаються
 * з 0.35, бо нижче плитка вже не відрізняється від порожньої.
 */
export function yearHeat(months: readonly MonthSummary[]): MonthHeat[] {
  const max = months.reduce((n, m) => Math.max(n, m.count), 0);
  return months.map((m) => ({
    ...m,
    heat: m.count === 0 || max === 0 ? 0 : 0.35 + 0.65 * (m.count / max),
  }));
}

/** Скільки подій у кожному місяці року — для річного огляду. */
export function yearSummary(events: readonly EventRow[], yr: number): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1;
    const byDay = eventsByDay(events, yr, mo);
    const all = [...byDay.values()].flat();
    // Типи в сталому порядку появи, без повторів: крапки під місяцем
    // мають означати «які саме події», а не «скільки їх».
    const types: string[] = [];
    for (const ev of all) {
      const t = ev.type ?? 'other';
      if (!types.includes(t)) types.push(t);
    }
    return { month: mo, count: all.length, types };
  });
}
