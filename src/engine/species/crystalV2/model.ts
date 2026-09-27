// ============================================================
// Кристал v2 — модель росту, по одному ефекту на модуль (ADR-0217).
// ------------------------------------------------------------
// Уся модель — ця таблиця, і нічого поза нею:
//
//   час разом (дні)       → висота монарха; кожен дочірній росте зі своїм віком
//   роки разом            → по одному дочірньому кристалу на рік
//   спогади               → ширина монарха
//   виконані плани        → грані монарха (яруси вершини)
//   виконані бажання      → колір усієї колонії (правило власника, ADR-0151)
//   події «Нашого шляху»  → добриво року; віхи — іскри в кристалі свого року
//   місця на мапі         → нахил кристала свого року назовні
//   переглянуте (медіа)   → внутрішнє сяйво колонії (і нічого більше)
//   спільні вихідні       → добриво року
//   активність року       → розмір кристала свого року
//
// Той самий запис живе в Python (`tools/crystal_twin/crystal_twin/model.py`);
// звірка — `model.test.ts` проти `tools/crystal_twin/golden/*.json`. Правка
// тут без правки там упаде на звірці, і навпаки.
//
// Догми власника тримаються за побудовою: час — головна валюта (порожня
// історія росте щороку), ніщо не меншає, а власне тіло кристала минулого
// року залежить лише від подій того року й від свого віку.
// ============================================================
import {
  DAYS_PER_YEAR,
  anniversary,
  dayNumber,
  daysBetween,
  parseDay,
  yearIndex,
  yearsSince,
  type CivilDay,
} from './calendar';
import { unit } from './hash';

export const CRYSTAL_V2_VERSION = 'crystal-v2/2026-09-27';

const SIDES = 6;

export const ACTIVITY_KINDS = [
  'memories', 'plans', 'wishes', 'events', 'milestones', 'places', 'media', 'daysOff',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type ActivityCounts = Record<ActivityKind, number>;

/**
 * Вага подій року в «добриві» кристала свого року.
 *
 * Медіа — нуль: переглянуте вносять оптом, і в справжньому архіві всі 185
 * записів мають дати червня–вересня 2026. Рік роздувався б фільмами, яких
 * того року не дивились; медіа дає лише сяйво (сумою).
 */
const ACTIVITY_WEIGHTS: ActivityCounts = {
  memories: 1,
  plans: 2,
  wishes: 2,
  events: 1,
  milestones: 2,
  places: 1.5,
  media: 0,
  daysOff: 0.25,
};

/** Цілі кольору; червоний розгорнутий як 360°, щоб жодна дуга не йшла через жовтий. */
const GIFT_TARGETS = { red: 360, blue: 240, green: 120 } as const;
type GiftChannel = keyof typeof GIFT_TARGETS;
const GIFT_ORDER: readonly GiftChannel[] = ['red', 'blue', 'green'];
const OWN_HUE_START = 260;
const OWN_HUE_STEP = 14;
const OWN_HUE_STEPS = 6;
/**
 * Довіра до малої вибірки: сила = відрив / (усього + 3). Без неї ОДНЕ бажання —
 * «усі бажання в одному каналі», і справжній архів пари у 2024–2025 ставав
 * чисто червоним від одного-двох подарунків.
 */
const GIFT_CONFIDENCE = 3;

export interface CrystalV2Snapshot {
  startDate: string;
  asOf: string;
  partners: { red?: number | null; blue?: number | null };
  memories?: readonly { id: number; date: string | null }[];
  plans?: readonly { id: number; date: string | null }[];
  wishes?: readonly {
    id: number;
    date: string | null;
    isShared?: boolean | null;
    ownerId?: number | null;
    fulfilledById?: number | null;
  }[];
  events?: readonly { id: number; date: string | null; isMilestone?: boolean | null }[];
  places?: readonly { id: number; date: string | null }[];
  media?: readonly { id: number; date: string | null }[];
  daysOff?: readonly string[];
}

export interface CrystalV2Child {
  year: number;
  age: number;
  activity: number;
  mix: ActivityCounts;
  height: number;
  radius: number;
  azimuth: number;
  distance: number;
  lean: number;
  sparks: number;
  sides: [number, number][];
}

export interface CrystalV2Model {
  version: string;
  startDate: string;
  asOf: string;
  days: number;
  years: number;
  counts: ActivityCounts;
  monarch: {
    height: number;
    radius: number;
    tiers: number;
    tierHeights: number[];
    apex: [number, number];
    sides: [number, number][];
    glow: number;
  };
  colour: {
    ownHue: number;
    hue: number;
    saturation: number;
    channel: GiftChannel | null;
    strength: number;
    gifts: Record<GiftChannel, number>;
    rgb: [number, number, number];
  };
  children: CrystalV2Child[];
}

/** Округлення, однакове з Python: floor(x·10⁶ + ½) / 10⁶. */
export function r6(x: number): number {
  return Math.floor(x * 1e6 + 0.5) / 1e6;
}

/** Залишок як у Python: завжди невід'ємний. */
function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

function zeroCounts(): ActivityCounts {
  return { memories: 0, plans: 0, wishes: 0, events: 0, milestones: 0, places: 0, media: 0, daysOff: 0 };
}

interface Dated {
  kind: ActivityKind;
  day: CivilDay;
}

function datedItems(snapshot: CrystalV2Snapshot, start: CivilDay, asOf: CivilDay): Dated[] {
  const items: Dated[] = [];
  const from = dayNumber(start);
  const to = dayNumber(asOf);
  const add = (kind: ActivityKind, text: string | null | undefined) => {
    if (!text) return;
    const day = parseDay(text);
    const at = dayNumber(day);
    // До початку стосунків — не історія пари: у «Нашому шляху» лежать дні
    // народження батьків (1963, 1971), і вони лягали б у перший рік.
    if (at >= from && at <= to) items.push({ kind, day });
  };
  for (const row of snapshot.memories ?? []) add('memories', row.date);
  for (const row of snapshot.plans ?? []) add('plans', row.date);
  for (const row of snapshot.wishes ?? []) add('wishes', row.date);
  for (const row of snapshot.events ?? []) {
    add('events', row.date);
    if (row.isMilestone) add('milestones', row.date);
  }
  for (const row of snapshot.places ?? []) add('places', row.date);
  for (const row of snapshot.media ?? []) add('media', row.date);
  for (const text of snapshot.daysOff ?? []) add('daysOff', text);
  return items;
}

function giftChannel(
  wish: NonNullable<CrystalV2Snapshot['wishes']>[number],
  partners: CrystalV2Snapshot['partners'],
): GiftChannel {
  const owner = wish.ownerId ?? null;
  const giver = wish.fulfilledById ?? null;
  if (wish.isShared || owner === null || giver === null || owner === giver) return 'green';
  if (giver === partners.red) return 'red';
  if (giver === partners.blue) return 'blue';
  return 'green';
}

function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
  const h = mod(hue, 360) / 60;
  const sector = Math.floor(h);
  const f = h - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - saturation * f);
  const t = value * (1 - saturation * (1 - f));
  const table: [number, number, number][] = [
    [value, t, p], [q, value, p], [p, value, t],
    [p, q, value], [t, p, value], [value, p, q],
  ];
  const [r, g, b] = table[mod(sector, 6)]!;
  return [r6(r), r6(g), r6(b)];
}

function colonyColour(
  startText: string,
  wishes: NonNullable<CrystalV2Snapshot['wishes']>,
  partners: CrystalV2Snapshot['partners'],
  asOf: CivilDay,
): CrystalV2Model['colour'] {
  const step = Math.min(OWN_HUE_STEPS - 1, Math.floor(unit(startText, 'hue') * OWN_HUE_STEPS));
  const own = OWN_HUE_START + step * OWN_HUE_STEP;
  const gifts: Record<GiftChannel, number> = { red: 0, blue: 0, green: 0 };
  const limit = dayNumber(asOf);
  for (const wish of wishes) {
    if (wish.date && dayNumber(parseDay(wish.date)) <= limit) gifts[giftChannel(wish, partners)] += 1;
  }
  const total = gifts.red + gifts.blue + gifts.green;
  // Тягне НАЙБІЛЬШИЙ канал; сила — його відрив від другого (ADR-0151).
  const ranked = [...GIFT_ORDER].sort(
    (a, b) => gifts[b] - gifts[a] || GIFT_ORDER.indexOf(a) - GIFT_ORDER.indexOf(b),
  );
  const lead = gifts[ranked[0]!] - gifts[ranked[1]!];
  const channel = total > 0 && lead > 0 ? ranked[0]! : null;
  const strength = channel ? lead / (total + GIFT_CONFIDENCE) : 0;
  const target = channel ? GIFT_TARGETS[channel] : own;
  const hue = own + (target - own) * strength;
  const saturation = 0.55 + 0.14 * strength;
  return {
    ownHue: r6(own),
    hue: r6(mod(hue, 360)),
    saturation: r6(saturation),
    channel,
    strength: r6(strength),
    gifts,
    rgb: hsvToRgb(hue, saturation, 1),
  };
}

/** Шість вертикальних граней: кут і відстань кожної — трохи свої. */
function sides(seed: string, tag: string, radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < SIDES; i += 1) {
    const angle = i * 60 + (unit(seed, `${tag}:a${i}`) - 0.5) * 14;
    const reach = radius * (0.86 + 0.28 * unit(seed, `${tag}:r${i}`));
    out.push([r6(angle), r6(reach)]);
  }
  return out;
}

export function buildCrystalV2Model(snapshot: CrystalV2Snapshot): CrystalV2Model {
  const startText = snapshot.startDate;
  const start = parseDay(startText);
  const asOf = parseDay(snapshot.asOf);
  const partners = snapshot.partners ?? {};
  const seed = startText.slice(0, 10);

  const days = Math.max(0, daysBetween(start, asOf));
  const years = days / DAYS_PER_YEAR;
  const items = datedItems(snapshot, start, asOf);

  const counts = zeroCounts();
  for (const item of items) counts[item.kind] += 1;

  // ── Монарх ────────────────────────────────────────────────
  const height = 1.4 + 1.25 * Math.log1p(years);
  // Ширина — спогади, але й час додає трохи: без цього порожня історія
  // давала стовп 3.9:1 — той «рожевий стовп», на який власник скаржився.
  const radius = 0.4 + 0.1 * Math.log1p(years) + 0.06 * Math.log1p(counts.memories);
  const tiers = 1 + Math.min(3, Math.floor(Math.log2(1 + counts.plans)));
  const tip = radius * 1.28; // ~52°: кут кварцової вершини, а не пропорція тіла
  const weights = Array.from({ length: tiers }, (_, j) => 0.8 + 0.4 * unit(seed, `monarch:tier${j}`));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const tierHeights = weights.map((w) => r6((tip * w) / totalWeight));
  const apex: [number, number] = [
    r6((unit(seed, 'monarch:apex:x') - 0.5) * 0.16 * radius),
    r6((unit(seed, 'monarch:apex:z') - 0.5) * 0.16 * radius),
  ];
  const glow = 0.18 + 0.4 * (1 - Math.exp(-counts.media / 40));

  // ── Дочірні: по одному на рік ─────────────────────────────
  const lastYear = dayNumber(asOf) >= dayNumber(start) ? yearIndex(start, asOf) : 0;
  const perYear = new Map<number, ActivityCounts>();
  for (const item of items) {
    const k = yearIndex(start, item.day);
    const mix = perYear.get(k) ?? zeroCounts();
    mix[item.kind] += 1;
    perYear.set(k, mix);
  }

  const children: CrystalV2Child[] = [];
  for (let k = 0; k <= lastYear; k += 1) {
    const began = anniversary(start, k);
    const age = yearsSince(began, asOf);
    if (age <= 0 && k > 0) continue;
    const mix = perYear.get(k) ?? zeroCounts();
    const activity = ACTIVITY_KINDS.reduce((sum, kind) => sum + ACTIVITY_WEIGHTS[kind] * mix[kind], 0);
    const share = 0.14 + 0.08 * Math.log1p(age) + 0.045 * Math.log1p(activity);
    const childHeight = height * Math.min(0.55, Math.max(0.12, share));
    const childRadius = childHeight * 0.2;
    const placesShare = activity > 0 ? (ACTIVITY_WEIGHTS.places * mix.places) / activity : 0;
    children.push({
      year: k,
      age: r6(age),
      activity: r6(activity),
      mix,
      height: r6(childHeight),
      radius: r6(childRadius),
      azimuth: r6(mod(k * 137.508 + (unit(seed, `child${k}:az`) - 0.5) * 20, 360)),
      distance: r6(radius + 0.14 + 0.09 * Math.sqrt(k)),
      lean: r6(14 + 22 * placesShare),
      sparks: Math.min(5, mix.milestones),
      sides: sides(seed, `child${k}`, childRadius),
    });
  }

  return {
    version: CRYSTAL_V2_VERSION,
    startDate: seed,
    asOf: snapshot.asOf.slice(0, 10),
    days,
    years: r6(years),
    counts,
    monarch: {
      height: r6(height),
      radius: r6(radius),
      tiers,
      tierHeights,
      apex,
      sides: sides(seed, 'monarch', radius),
      glow: r6(glow),
    },
    colour: colonyColour(startText, snapshot.wishes ?? [], partners, asOf),
    children,
  };
}
