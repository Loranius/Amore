// ============================================================
// Підводний вулкан — модель росту (ADR-0235). Замінює риф як вид.
// ------------------------------------------------------------
// Власник, 2026-09-29: «на рифі немає героя … давай зробимо підводний
// вулкан, як героя, який буде рости вище і вище, а навколо нього будуть
// з'являтись рибки, корали що ростуть на ньому і водорості».
//
// ГЕРОЙ — ВУЛКАН, ЩО РОСТЕ ШАРАМИ-РОКАМИ. Кожен рік разом — виверження й
// шар застиглої лави. Так росте справжній стратовулкан, і так виконується
// догма власника «час — основна валюта росту»: шар лягає щороку, навіть
// коли подій не було. Події — добриво: насичений рік дає товщий шар.
// Кожен наступний шар тонший за попередній (вулкан вищає дедалі
// повільніше), тож висота росте завжди, але не безмежно.
//
//   час разом           → шари, висота, ширина підніжжя
//   активність року     → товщина шару цього року (до +25%)
//   останні два роки    → жар кратера й кількість жил лави
//   роки разом          → колонія корала на шарі СВОГО року: вулкан —
//                         літопис знизу вгору
//   виконані плани      → бічні конуси (ADR-0237)
//   5 / 10 / 20 років   → новий вид риб у зграї (ADR-0237)
//   решта (актинії-бажання, мушлі-віхи, риби-медіа, трава-вихідні,
//   зірки-місця, підріст) — ті самі правила, що в рифі v2 (ADR-0219):
//   модель рифу рахується й перевикористовується, а не переписується.
//
// Модуль чистий: лише числа, без three і React.
// ============================================================
import { anniversary, dayNumber, parseDay, yearIndex, yearsSince } from '../crystalV2/calendar';
import { unit } from '../crystalV2/hash';
import { ACTIVITY_WEIGHTS, datedItems, r6, type CrystalV2Snapshot } from '../crystalV2/model';
import { buildReefV2Model, type ReefV2Model } from '../reefV2/model';
import { yearFertility } from '../grammar/grammar';

export const VOLCANO_VERSION = 'volcano/2026-09-29';

/** Висота конуса до першого шару: пагорб, з якого все почалось. */
export const VOLCANO_BASE_HEIGHT = 0.35;
/** Товщина першого повного шару без подій. */
export const VOLCANO_LAYER = 0.26;
/** За скільки років товщина шару спадає в e разів. */
export const VOLCANO_LAYER_DECAY_YEARS = 9;
/** Скільки найбільше додає насичений рік до товщини шару. */
export const VOLCANO_FERTILE_BONUS = 0.25;

export interface VolcanoLayer {
  year: number;
  /** Частка року, що вже прожита (1 для всіх, крім поточного). */
  lived: number;
  activity: number;
  /** Насиченість року 0…1 (ADR-0237): насичений рік лишає уступ на схилі. */
  fertility: number;
  /** Спогади року: скільки коралів у колонії цього року (ADR-0237). */
  memories: number;
  thickness: number;
  /** Висота низу й верху шару. */
  from: number;
  to: number;
}

/** Скільки бічних конусів дають виконані плани: 3 → 1, 9 → 2, 21 → 3 (ADR-0237). */
export function volcanoVentCount(plans: number): number {
  return Math.min(3, Math.floor(Math.log2(1 + Math.max(0, plans) / 3)));
}

/** Роки разом, на яких у зграї з'являється новий вид риб (ADR-0237, власник). */
export const VOLCANO_FISH_YEARS: readonly number[] = [5, 10, 20];

export interface VolcanoVent {
  /** Порядковий номер конуса: його азимут і місце не змінюються з роками. */
  index: number;
  azimuth: number;
  /** Де на схилі стоїть: частка висоти головного конуса. */
  at: number;
  /** Висота бічного конуса: росте з віком вулкана. */
  size: number;
}

export interface VolcanoModel {
  version: string;
  startDate: string;
  asOf: string;
  years: number;
  layers: VolcanoLayer[];
  height: number;
  baseRadius: number;
  craterRadius: number;
  /** Жар кратера 0.35…1: свіжа лава останніх двох років. */
  glow: number;
  veins: number;
  /** Бічні конуси — виконані плани (ADR-0237). */
  vents: VolcanoVent[];
  /** Скільки видів риб у зграї: 1 + віхи 5 / 10 / 20 років разом. */
  fishKinds: number;
  /** Модель рифу тієї ж пари: колонії, актинії, мушлі, риби, трава, зірки. */
  life: ReefV2Model;
}

export function volcanoLayerThickness(year: number, lived: number, activity: number): number {
  // Насиченість року — спільна для всіх видів (ADR-0237).
  return VOLCANO_LAYER * Math.exp(-year / VOLCANO_LAYER_DECAY_YEARS) * lived * (1 + VOLCANO_FERTILE_BONUS * yearFertility(activity));
}

export function buildVolcanoModel(snapshot: CrystalV2Snapshot): VolcanoModel {
  const life = buildReefV2Model(snapshot);
  const start = parseDay(life.startDate);
  const asOf = parseDay(snapshot.asOf);
  const items = datedItems(snapshot, start, asOf);
  const activityByYear = new Map<number, number>();
  const plans = items.filter((item) => item.kind === 'plans').length;
  const memoriesByYear = new Map<number, number>();
  for (const item of items) {
    if (item.kind === 'memories') memoriesByYear.set(yearIndex(start, item.day), (memoriesByYear.get(yearIndex(start, item.day)) ?? 0) + 1);
  }
  for (const item of items) {
    const k = yearIndex(start, item.day);
    activityByYear.set(k, (activityByYear.get(k) ?? 0) + ACTIVITY_WEIGHTS[item.kind]);
  }

  const lastYear = dayNumber(asOf) >= dayNumber(start) ? yearIndex(start, asOf) : 0;
  const layers: VolcanoLayer[] = [];
  let top = VOLCANO_BASE_HEIGHT;
  for (let k = 0; k <= lastYear; k += 1) {
    const livedYears = yearsSince(anniversary(start, k), asOf);
    const lived = Math.max(0, Math.min(1, livedYears));
    if (lived <= 0) continue;
    const activity = activityByYear.get(k) ?? 0;
    const thickness = volcanoLayerThickness(k, lived, activity);
    layers.push({ year: k, lived: r6(lived), activity: r6(activity), fertility: r6(yearFertility(activity)), memories: memoriesByYear.get(k) ?? 0, thickness: r6(thickness), from: r6(top), to: r6(top + thickness) });
    top += thickness;
  }

  const recent = (activityByYear.get(lastYear) ?? 0) + (activityByYear.get(lastYear - 1) ?? 0);
  const glow = 0.35 + 0.65 * Math.min(1, Math.log1p(recent) / Math.log1p(30));

  return {
    version: VOLCANO_VERSION,
    startDate: life.startDate,
    asOf: life.asOf,
    years: life.years,
    layers,
    height: r6(top),
    // Пропорція — як у референсі власника: широкий конус, висота ≈ 0.7
    // діаметра підніжжя, на кожному віці. Вузьке підніжжя (0.5 + 0.22·висоти)
    // на 15–30 роках робило з вулкана вежу. На острів того ж розміру, що в
    // кристала й дерева, його вміщує масштаб кадру (`volcanoFrame`).
    baseRadius: r6(0.72 * top),
    craterRadius: r6(0.16 + 0.05 * top),
    glow: r6(glow),
    // 3…5 рік лави, як у референсі: більше — від активності останніх років.
    veins: 3 + Math.min(2, Math.floor(Math.log2(1 + recent / 3))),
    vents: Array.from({ length: volcanoVentCount(plans) }, (_, i) => ({
      index: i,
      azimuth: r6(((unit(life.startDate, `vent${i}:a`) * 360) + i * 137.5) % 360),
      at: r6(0.16 + 0.14 * unit(life.startDate, `vent${i}:at`)),
      size: r6((0.34 + 0.1 * unit(life.startDate, `vent${i}:s`)) * (0.55 + 0.45 * Math.min(1, life.years / 8))),
    })),
    fishKinds: 1 + VOLCANO_FISH_YEARS.filter((year) => life.years >= year).length,
    life,
  };
}

/** Радіус схилу на висоті `y`: увігнутий конус стратовулкана. */
export function volcanoSlopeRadius(model: Pick<VolcanoModel, 'height' | 'baseRadius' | 'craterRadius'>, y: number): number {
  const f = Math.min(1, Math.max(0, y / model.height));
  return model.craterRadius + (model.baseRadius - model.craterRadius) * Math.pow(1 - f, 1.35);
}
