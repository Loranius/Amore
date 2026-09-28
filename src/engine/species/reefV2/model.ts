// ============================================================
// Риф v2 — модель росту (ADR-0219).
// ------------------------------------------------------------
// Той самий запис правила, що в Python-двійнику
// (`tools/crystal_twin/crystal_twin/reef_model.py`); звірку тримає
// `model.test.ts` на еталонах `golden/reef/*.json`.
//
// Основа росту — закон голови рифу без змін: `0.25 + 0.75·√(min(1, років/25))`.
// Решта — по одному ефекту на модуль:
//
//   час разом             → розмір кам'яної голови рифу й підріст на ній
//   роки разом            → по одній колонії корала на рік; росте з віком
//   активність року       → розмір колонії й кількість тіл у ній
//   головний модуль року  → форма колонії (спогади — мозковик, плани —
//                           гіллястий, бажання — віяло, події — трубки,
//                           місця — стіл, тиша — пальці)
//   виконані бажання      → актинії; колір — хто виконав бажання
//   віхи «Нашого шляху»   → мушлі з перлиною
//   переглянуте (медіа)   → риби в зграї
//   спільні вихідні       → морська трава
//   місця на мапі         → морські зірки на піску
// ============================================================
import {
  DAYS_PER_YEAR,
  anniversary,
  dayNumber,
  daysBetween,
  parseDay,
  yearIndex,
  yearsSince,
} from '../crystalV2/calendar';
import { unit } from '../crystalV2/hash';
import {
  ACTIVITY_KINDS,
  ACTIVITY_WEIGHTS,
  datedItems,
  giftChannel,
  r6,
  type ActivityCounts,
  type CrystalV2Snapshot,
  type GiftChannel,
} from '../crystalV2/model';

export const REEF_V2_VERSION = 'reef-v2/2026-09-28b';

const HEAD_FULL_TERM_YEARS = 25;

/** Закон голови рифу (без змін): швидко на початку, повністю на 25-му році. */
export function reefHeadScaleV2(years: number): number {
  const progress = Math.min(1, Math.max(0, years) / HEAD_FULL_TERM_YEARS);
  return 0.25 + 0.75 * Math.sqrt(progress);
}

export type ReefForm = 'brain' | 'branch' | 'fan' | 'tube' | 'table' | 'finger';

/** Порядок — ще й правило нічиєї: раніший у списку перемагає. */
const FORM_BY_MODULE: readonly [keyof ActivityCounts, ReefForm][] = [
  ['memories', 'brain'],
  ['plans', 'branch'],
  ['wishes', 'fan'],
  ['events', 'tube'],
  ['places', 'table'],
  ['daysOff', 'finger'],
];

const MAX_ANEMONES = 40;

export interface ReefV2Colony {
  year: number;
  age: number;
  activity: number;
  form: ReefForm;
  size: number;
  bodies: number;
  azimuth: number;
  reach: number;
  hue: number;
}

export interface ReefV2Model {
  version: string;
  startDate: string;
  asOf: string;
  days: number;
  years: number;
  counts: ActivityCounts;
  head: number;
  radius: number;
  rise: number;
  colonies: ReefV2Colony[];
  undergrowth: number;
  anemones: { id: number; channel: GiftChannel }[];
  clams: number;
  fish: number;
  seagrass: number;
  starfish: number;
}

const zero = (): ActivityCounts => ({ memories: 0, plans: 0, wishes: 0, events: 0, milestones: 0, places: 0, media: 0, daysOff: 0 });
const mod = (x: number, m: number) => ((x % m) + m) % m;
const iso = (d: { year: number; month: number; day: number }) =>
  `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

export function buildReefV2Model(snapshot: CrystalV2Snapshot): ReefV2Model {
  const startText = snapshot.startDate.slice(0, 10);
  const start = parseDay(startText);
  const asOf = parseDay(snapshot.asOf);
  const partners = snapshot.partners ?? {};
  const seed = startText;

  const days = Math.max(0, daysBetween(start, asOf));
  const years = days / DAYS_PER_YEAR;
  const items = datedItems(snapshot, start, asOf);
  const counts = zero();
  for (const item of items) counts[item.kind] += 1;

  const head = reefHeadScaleV2(years);

  const lastYear = dayNumber(asOf) >= dayNumber(start) ? yearIndex(start, asOf) : 0;
  const perYear = new Map<number, ActivityCounts>();
  for (const item of items) {
    const k = yearIndex(start, item.day);
    const mix = perYear.get(k) ?? zero();
    mix[item.kind] += 1;
    perYear.set(k, mix);
  }
  const colonies: ReefV2Colony[] = [];
  for (let k = 0; k <= lastYear; k += 1) {
    const age = yearsSince(anniversary(start, k), asOf);
    if (age <= 0 && k > 0) continue;
    const mix = perYear.get(k) ?? zero();
    const activity = ACTIVITY_KINDS.reduce((sum, kind) => sum + ACTIVITY_WEIGHTS[kind] * mix[kind], 0);
    const weighted = FORM_BY_MODULE.map(([m]) =>
      ACTIVITY_WEIGHTS[m] * mix[m] + (m === 'events' ? ACTIVITY_WEIGHTS.milestones * mix.milestones : 0));
    const best = Math.max(...weighted);
    const form = best > 0 ? FORM_BY_MODULE[weighted.indexOf(best)]![1] : 'finger';
    const size = Math.min(0.75, Math.max(0.15, 0.18 + 0.1 * Math.log1p(age) + 0.045 * Math.log1p(activity)));
    colonies.push({
      year: k,
      age: r6(age),
      activity: r6(activity),
      form,
      size: r6(size),
      // Власник, 2026-09-28: «зроби коралів більше, риф виглядає порожнім».
      bodies: 2 + Math.min(6, Math.floor(Math.log2(1 + activity))),
      azimuth: r6(mod(k * 137.508 + (unit(seed, `colony${k}:az`) - 0.5) * 24, 360)),
      reach: r6(Math.min(0.82, 0.12 + 0.19 * Math.sqrt(k) + 0.06 * unit(seed, `colony${k}:reach`))),
      hue: r6(unit(seed, `colony${k}:hue`)),
    });
  }

  const from = dayNumber(start);
  const to = dayNumber(asOf);
  const anemones: [string, number, GiftChannel][] = [];
  for (const row of snapshot.wishes ?? []) {
    if (!row.date) continue;
    const day = parseDay(row.date);
    const at = dayNumber(day);
    if (at >= from && at <= to) anemones.push([iso(day), row.id, giftChannel(row, partners)]);
  }
  anemones.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0)));

  return {
    version: REEF_V2_VERSION,
    startDate: startText,
    asOf: snapshot.asOf.slice(0, 10),
    days,
    years: r6(years),
    counts,
    head: r6(head),
    radius: r6(1.3 * head),
    rise: r6(0.6 * head),
    colonies,
    anemones: anemones.slice(-MAX_ANEMONES).map(([, id, channel]) => ({ id, channel })),
    // Підріст: камінь обростає дрібними коралами з часом (не з подіями) —
    // порожня історія теж дає живий риф, а не голу брилу.
    undergrowth: Math.min(140, Math.floor(40 + (100 * (head - 0.25)) / 0.75)),
    clams: Math.min(8, counts.milestones),
    fish: Math.min(40, Math.floor(5 * Math.log1p(counts.media) + 0.5)),
    seagrass: Math.min(120, 4 * counts.daysOff),
    starfish: counts.places ? Math.min(10, 1 + Math.floor(Math.log2(1 + counts.places))) : 0,
  };
}
