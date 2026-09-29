// ============================================================
// Одна граматика росту (ADR-0237).
// ------------------------------------------------------------
// Кристал, дерево й вулкан ростуть за тими самими чотирма шарами:
//
//   А. скелет — час: об'єкт вищає щодня, навіть на порожній історії;
//   Б. елемент року: кожен прожитий рік разом додає ОДИН елемент, що
//      належить цьому року назавжди (кристалик, гілка, шар);
//   В. розмір елемента = активність року, зі стелею ×1.35;
//   Г. сліди модулів: кожен модуль — рівно один видимий слід у виді.
//
// Тут живе спільне для Б і В, щоб три види не рахували одне й те саме
// трьома способами. Модуль чистий: без three, без React, без годинника.
// ============================================================
import { anniversary, dayNumber, parseDay, yearIndex, yearsSince } from '../crystalV2/calendar';
import { unit } from '../crystalV2/hash';
import {
  ACTIVITY_KINDS,
  ACTIVITY_WEIGHTS,
  datedItems,
  r6,
  type ActivityCounts,
  type CrystalV2Snapshot,
} from '../crystalV2/model';

/** Активність, на якій рік уже «повний»: далі добриво не додає. */
export const YEAR_ACTIVITY_FULL = 40;
/** Стеля: найактивніший рік більший за тихий не більш ніж у стільки разів. */
export const YEAR_BOOST_CAP = 1.35;

export interface YearElement {
  /** Номер року разом: 0 — перший. */
  year: number;
  /** Скільки років минуло від початку цього року до знімка (вік елемента). */
  age: number;
  /** Прожита частка року, 0…1: поточний рік росте разом із часом. */
  lived: number;
  /** Події року за модулями. */
  mix: ActivityCounts;
  /** Зважена сума подій року (`ACTIVITY_WEIGHTS`). */
  activity: number;
  /** Насиченість року 0…1: логарифм, що насичується на `YEAR_ACTIVITY_FULL`. */
  fertility: number;
}

function zero(): ActivityCounts {
  return { memories: 0, plans: 0, wishes: 0, events: 0, milestones: 0, places: 0, media: 0, daysOff: 0 };
}

/** Насиченість року 0…1 за його активністю. */
export function yearFertility(activity: number): number {
  return Math.min(1, Math.log1p(Math.max(0, activity)) / Math.log1p(YEAR_ACTIVITY_FULL));
}

/** Множник розміру елемента року: 1 для тихого року, `YEAR_BOOST_CAP` для повного. */
export function yearBoost(activity: number): number {
  return 1 + (YEAR_BOOST_CAP - 1) * yearFertility(activity);
}

/**
 * Елементи років: по одному на кожен рік, що вже почався (перший рік є
 * завжди). Елемент року N залежить лише від подій року N і від свого віку:
 * нові події не переписують минулих років.
 */
export function yearElements(snapshot: CrystalV2Snapshot): YearElement[] {
  const start = parseDay(snapshot.startDate.slice(0, 10));
  const asOf = parseDay(snapshot.asOf.slice(0, 10));
  const perYear = new Map<number, ActivityCounts>();
  for (const item of datedItems(snapshot, start, asOf)) {
    const k = yearIndex(start, item.day);
    const mix = perYear.get(k) ?? zero();
    mix[item.kind] += 1;
    perYear.set(k, mix);
  }
  const lastYear = dayNumber(asOf) >= dayNumber(start) ? yearIndex(start, asOf) : 0;
  const out: YearElement[] = [];
  for (let k = 0; k <= lastYear; k += 1) {
    const age = yearsSince(anniversary(start, k), asOf);
    if (age <= 0 && k > 0) continue;
    const mix = perYear.get(k) ?? zero();
    const activity = ACTIVITY_KINDS.reduce((sum, kind) => sum + ACTIVITY_WEIGHTS[kind] * mix[kind], 0);
    out.push({
      year: k,
      age: r6(Math.max(0, age)),
      lived: r6(Math.max(0, Math.min(1, age))),
      mix,
      activity: r6(activity),
      fertility: r6(yearFertility(activity)),
    });
  }
  return out;
}

/** Скільки гілок у ярусі `tier`: 3 або 4, з хешу дати пари (ADR-0237 §7). */
export function tierSize(seed: string, tier: number): 3 | 4 {
  return unit(seed, `tier${tier}:size`) < 0.5 ? 3 : 4;
}

export interface TierSlot {
  /** Ярус, 0 — нижній. */
  tier: number;
  /** Місце гілки в ярусі, 0…size−1. */
  slot: number;
  /** Скільки гілок у цьому ярусі. */
  size: 3 | 4;
}

/** Ярус і місце в ньому для гілки року `year`: яруси заповнюються знизу. */
export function tierSlot(seed: string, year: number): TierSlot {
  let tier = 0;
  let first = 0;
  for (;;) {
    const size = tierSize(seed, tier);
    if (year < first + size) return { tier, slot: year - first, size };
    first += size;
    tier += 1;
  }
}
