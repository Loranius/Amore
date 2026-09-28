// ============================================================
// Дерево v2 — модель росту (ADR-0218).
// ------------------------------------------------------------
// Той самий запис правила, що в Python-двійнику
// (`tools/crystal_twin/crystal_twin/tree_model.py`); звірку тримає
// `model.test.ts` на еталонах `golden/tree/*.json`.
//
// Основа росту — закон віку ADR-0090 без змін: дерево дорослішає за 40
// років, швидко в молодості, і росте щороку навіть на порожній історії.
// Решта — по одному ефекту на модуль:
//
//   час разом           → висота, товщина стовбура, порядки гілок
//   виконані плани      → скелетні гілки
//   спогади             → пишність крони
//   виконані бажання    → квіти; колір кожної — хто виконав бажання
//   віхи «Нашого шляху» → золоті плоди
//   місця на мапі       → коріння
//   переглянуте (медіа) → світлячки
//   спільні вихідні     → польові квіти на лузі
//   місяць знімка       → пора року (частка осіннього листя)
//
// Модуль чистий: без three, без React, без годинника.
// ============================================================
import { DAYS_PER_YEAR, dayNumber, daysBetween, parseDay, yearIndex } from '../crystalV2/calendar';
import { unit } from '../crystalV2/hash';
import {
  datedItems,
  giftChannel,
  r6,
  type ActivityCounts,
  type CrystalV2Snapshot,
  type GiftChannel,
} from '../crystalV2/model';

export const TREE_V2_VERSION = 'tree-v2/2026-09-28';

const FULL_TERM_YEARS = 40;
const GROWTH_SATURATION = 3.8;

/** 0 у день знайомства, 1 на сороковому році (ADR-0090, без змін). */
export function treeAgeProgressV2(years: number): number {
  const term = Math.min(1, Math.max(0, years) / FULL_TERM_YEARS);
  return (1 - Math.exp(-GROWTH_SATURATION * term)) / (1 - Math.exp(-GROWTH_SATURATION));
}

/** Частка осіннього листя за місяцем; узимку дерево вічнозелене, не голе. */
const AUTUMN_BY_MONTH = [0, 0, 0, 0, 0, 0, 0, 0.05, 0.25, 0.55, 0.7, 0.15] as const;

const MAX_BLOSSOMS = 60;

export type TreeV2Snapshot = CrystalV2Snapshot;

export interface TreeV2Blossom {
  id: number;
  channel: GiftChannel;
  year: number;
}

export interface TreeV2Model {
  version: string;
  startDate: string;
  asOf: string;
  days: number;
  years: number;
  progress: number;
  counts: ActivityCounts;
  height: number;
  trunkRadius: number;
  orders: number;
  limbs: number;
  leafiness: number;
  blossoms: TreeV2Blossom[];
  fruits: number;
  roots: number;
  rootReach: number;
  fireflies: number;
  flowers: number;
  autumn: number;
  lean: number;
  leanAzimuth: number;
}

export function buildTreeV2Model(snapshot: TreeV2Snapshot): TreeV2Model {
  const startText = snapshot.startDate.slice(0, 10);
  const start = parseDay(startText);
  const asOf = parseDay(snapshot.asOf);
  const partners = snapshot.partners ?? {};
  const seed = startText;

  const days = Math.max(0, daysBetween(start, asOf));
  const years = days / DAYS_PER_YEAR;
  const counts: ActivityCounts = { memories: 0, plans: 0, wishes: 0, events: 0, milestones: 0, places: 0, media: 0, daysOff: 0 };
  for (const item of datedItems(snapshot, start, asOf)) counts[item.kind] += 1;

  const p = treeAgeProgressV2(years);
  const height = 0.35 + 4.65 * p;

  // Квіти: по одній на виконане бажання, найновіші — якщо їх забагато.
  // Порядок — дата, тоді id, тоді канал: той самий, що в Python (кортежі).
  const wishes: [string, number, GiftChannel][] = [];
  const from = dayNumber(start);
  const to = dayNumber(asOf);
  for (const row of snapshot.wishes ?? []) {
    if (!row.date) continue;
    const day = parseDay(row.date);
    const at = dayNumber(day);
    if (at >= from && at <= to) {
      const iso = `${String(day.year).padStart(4, '0')}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      wishes.push([iso, row.id, giftChannel(row, partners)]);
    }
  }
  wishes.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0)));
  const blossoms = wishes.slice(-MAX_BLOSSOMS).map(([iso, id, channel]) => ({
    id,
    channel,
    year: yearIndex(start, parseDay(iso)),
  }));

  return {
    version: TREE_V2_VERSION,
    startDate: startText,
    asOf: snapshot.asOf.slice(0, 10),
    days,
    years: r6(years),
    progress: r6(p),
    counts,
    height: r6(height),
    trunkRadius: r6(height * (0.03 + 0.025 * p)),
    orders: 2 + Math.min(3, Math.floor(years / 3)),
    limbs: 3 + Math.min(4, Math.floor(Math.log2(1 + counts.plans))),
    leafiness: r6(0.7 + 0.1 * Math.log1p(counts.memories)),
    blossoms,
    fruits: Math.min(12, counts.milestones),
    roots: 3 + Math.min(5, Math.floor(Math.log2(1 + counts.places))),
    rootReach: r6(height * (0.09 + 0.018 * Math.log1p(counts.places))),
    fireflies: Math.min(36, Math.floor(6 * Math.log1p(counts.media) + 0.5)),
    flowers: Math.min(90, 2 * counts.daysOff),
    autumn: AUTUMN_BY_MONTH[asOf.month - 1]!,
    lean: r6(2 + 4 * unit(seed, 'tree:lean')),
    leanAzimuth: r6(360 * unit(seed, 'tree:leanAz')),
  };
}
