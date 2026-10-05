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
//   виконані плани      → товщий шар року й жар кратера (через активність);
//                         тріщини лави на схилі прибрано (власник, 2026-10-05)
//   виконані бажання    → морські мешканці по черзі: рибка, медуза, устриця з
//                         перлиною, більша риба, кит на тлі, дельфін над
//                         вулканом, далі — рибки нових кольорів (2026-10-05)
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

export const VOLCANO_VERSION = 'volcano/2026-10-06';

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

/**
 * Мешканці за виконаними бажаннями (власник, 2026-10-05): кожне нове бажання
 * додає наступного — 1 рибка, 2 медуза, 3 устриця з перлиною, 4 більша
 * риба, 5 кит на тлі, 6 дельфін над вулканом; далі — рибка нового кольору
 * за кожне бажання.
 */
export type VolcanoCreatureKind = 'fish' | 'jellyfish' | 'oyster' | 'bigFish' | 'whale' | 'dolphin';
export const VOLCANO_CREATURE_ORDER: readonly VolcanoCreatureKind[] = ['fish', 'jellyfish', 'oyster', 'bigFish', 'whale', 'dolphin'];
/** Більше мешканців не додається: вулкан не акваріум. */
export const VOLCANO_MAX_CREATURES = 30;

export interface VolcanoCreature {
  /** Бажання, що його привело (id), і його порядковий номер. */
  wishId: number;
  index: number;
  kind: VolcanoCreatureKind;
  /** Відтінок 0…1 (для рибок; решта — свій колір). */
  hue: number;
  /** Орбіта довкола осі вулкана, висота над плато, фаза (градуси), кутова швидкість (рад/с). */
  orbit: number;
  height: number;
  phase: number;
  speed: number;
}

/**
 * Вулкан прокидається з роками, а не лише росте (власник, 2026-10-05):
 * «маленький сплячий вулкан → світіння в кратері → маленькі лавові тріщини →
 * більший кратер і більше життя → світиться зсередини». Пороги — роки разом.
 */
export const VOLCANO_STAGES = { glow: 1.5, streams: 3, crater: 7, inner: 10 } as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Стадія пробудження 0…1 за роками разом (неперервна, без стрибків). */
export function volcanoAwakening(years: number): { glow: number; streams: number; crater: number; inner: number } {
  return {
    glow: smooth(0.5, VOLCANO_STAGES.glow + 1, years),
    streams: smooth(VOLCANO_STAGES.streams - 0.5, VOLCANO_STAGES.streams + 3, years),
    crater: smooth(VOLCANO_STAGES.crater - 2, VOLCANO_STAGES.crater + 3, years),
    inner: smooth(VOLCANO_STAGES.inner - 1, VOLCANO_STAGES.inner + 4, years),
  };
}

/**
 * Скільки тонких потоків лави: жодного у сплячого, далі 1–3. «Не робити
 * багато лави — вулкан має бути романтичним, а не пекельним» (власник).
 */
export function volcanoStreamCount(years: number, recent: number): number {
  // 2026-10-06 (власник: «кілька тонких тріщин, що світяться»): щойно
  // кратер засвітився — дві тріщини; з потоками й свіжими роками — три.
  if (years < VOLCANO_STAGES.glow) return 0;
  if (years < VOLCANO_STAGES.streams) return 2;
  const byAge = 2 + Math.floor((years - VOLCANO_STAGES.streams) / 6);
  return Math.min(3, byAge + (recent >= 12 ? 1 : 0));
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
  /** Жар кратера 0…1: стадія пробудження × свіжа лава останніх двох років. */
  glow: number;
  /** Тонкі потоки лави на схилі: 0 у сплячого, до 3. */
  veins: number;
  /** Скільки схилу потоки проходять у спокої (0…1); дотик — до підніжжя. */
  streamReach: number;
  /** Світіння зсередини каменю 0…1 (пізня стадія). */
  innerGlow: number;
  /** Стадії пробудження (див. `volcanoAwakening`). */
  awakening: ReturnType<typeof volcanoAwakening>;
  /** Бічні конуси — виконані плани (ADR-0237). */
  vents: VolcanoVent[];
  /** Скільки видів риб у зграї: 1 + віхи 5 / 10 / 20 років разом. */
  fishKinds: number;
  /** Мешканці за виконаними бажаннями, у порядку бажань. */
  creatures: VolcanoCreature[];
  /** Модель рифу тієї ж пари: колонії, актинії, мушлі, риби, трава, зірки. */
  life: ReefV2Model;
}

/** Кожне бажання — свій мешканець: вид за порядком, місце й рух — із хешу. */
export function volcanoCreatures(
  wishIds: readonly number[],
  seed: string,
  shape: { height: number; baseRadius: number; craterRadius: number },
): VolcanoCreature[] {
  const { height, baseRadius, craterRadius } = shape;
  return wishIds.slice(0, VOLCANO_MAX_CREATURES).map((wishId, index) => {
    const kind = VOLCANO_CREATURE_ORDER[index] ?? 'fish';
    const u = (tag: string) => unit(seed, `creature${index}:${tag}`);
    // Перша рибка — помаранчева; рибки після дельфіна — щоразу новий колір
    // (золотий кут по колу відтінків, щоб сусідні не були схожі).
    const hue = index === 0 ? 0.07 : (0.07 + (index - 5) * 0.618034) % 1;
    const phase = r6(360 * u('p'));
    const base = { wishId, index, kind, hue: r6(hue), phase };
    switch (kind) {
      case 'jellyfish':
        return { ...base, orbit: r6(baseRadius * (1.35 + 0.2 * u('r'))), height: r6(height * (0.55 + 0.2 * u('y'))), speed: 0.06 };
      case 'oyster':
        return { ...base, orbit: r6(baseRadius * (1.1 + 0.06 * u('r'))), height: 0, speed: 0 };
      case 'bigFish':
        return { ...base, orbit: r6(baseRadius * (1.8 + 0.25 * u('r'))), height: r6(height * (0.4 + 0.25 * u('y'))), speed: 0.16 };
      case 'whale':
        // Кит — пасхалка, а не другий герой (власник, 2026-10-05): далеко
        // позаду, у синій глибині; сцена веде його еліпсом за вулканом.
        return { ...base, orbit: r6(baseRadius * 5 + 2.2), height: r6(height * 0.9 + 0.6), speed: 0.03 };
      case 'dolphin':
        return { ...base, orbit: r6(craterRadius + 0.45 + 0.15 * u('r')), height: r6(height + 0.5), speed: 0.45 };
      default:
        return { ...base, orbit: r6(baseRadius * (1.2 + 0.5 * u('r'))), height: r6(0.25 + height * 0.8 * u('y')), speed: r6(0.24 + 0.16 * u('s')) };
    }
  });
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

  // Виконані бажання в порядку дня (і id при рівних днях) — черга мешканців.
  const wishIds = (snapshot.wishes ?? [])
    .filter((w) => w.date && dayNumber(parseDay(w.date)) >= dayNumber(start) && dayNumber(parseDay(w.date)) <= dayNumber(asOf))
    .map((w) => [dayNumber(parseDay(w.date!)), w.id] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, id]) => id);

  const recent = (activityByYear.get(lastYear) ?? 0) + (activityByYear.get(lastYear - 1) ?? 0);
  const awake = volcanoAwakening(life.years);
  // Сплячий вулкан ледь тліє; прокинутий — світить, і свіжі роки додають.
  const fresh = Math.min(1, Math.log1p(recent) / Math.log1p(30));
  const glow = 0.08 + 0.92 * awake.glow * (0.7 + 0.3 * fresh);
  // Ширший конус (власник: «зробити ширшим»): підніжжя 0.78 висоти, плюс
  // асиметрія кілець (до +17% на широкому боці). Ширше не можна: острів
  // має лишатися того ж розміру, що в кристала й дерева (ADR-0235).
  const baseRadius = 0.78 * top;
  // Кратер — головний акцент і росте зі стадією «більший кратер».
  const craterRadius = (0.17 + 0.06 * top) * (0.85 + 0.35 * awake.crater);

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
    baseRadius: r6(baseRadius),
    craterRadius: r6(craterRadius),
    glow: r6(glow),
    veins: volcanoStreamCount(life.years, recent),
    streamReach: r6(0.3 + 0.45 * awake.streams),
    innerGlow: r6(awake.inner),
    awakening: { glow: r6(awake.glow), streams: r6(awake.streams), crater: r6(awake.crater), inner: r6(awake.inner) },
    vents: Array.from({ length: volcanoVentCount(plans) }, (_, i) => ({
      index: i,
      azimuth: r6(((unit(life.startDate, `vent${i}:a`) * 360) + i * 137.5) % 360),
      at: r6(0.16 + 0.14 * unit(life.startDate, `vent${i}:at`)),
      size: r6((0.34 + 0.1 * unit(life.startDate, `vent${i}:s`)) * (0.55 + 0.45 * Math.min(1, life.years / 8))),
    })),
    fishKinds: 1 + VOLCANO_FISH_YEARS.filter((year) => life.years >= year).length,
    creatures: volcanoCreatures(wishIds, life.startDate, { height: r6(top), baseRadius: r6(baseRadius), craterRadius: r6(craterRadius) }),
    life,
  };
}

/** Радіус схилу на висоті `y`: увігнутий конус стратовулкана. */
export function volcanoSlopeRadius(model: Pick<VolcanoModel, 'height' | 'baseRadius' | 'craterRadius'>, y: number): number {
  const f = Math.min(1, Math.max(0, y / model.height));
  return model.craterRadius + (model.baseRadius - model.craterRadius) * Math.pow(1 - f, 1.35);
}
