// ============================================================
// growthField — Stress / Density / Competition solvers Growth Engine
// (Volume III) + ймовірнісне поле росту над поверхнею мінеральної маси.
// (surfaceStress=Stress Solver, localDensity=Density Solver,
//  growthEnergyAt=Competition Solver/Growth Shadow, scoreGrowthSite=оцінка
//  Attachment; placementFieldAt — історичне поле, яке Species Layer замикає
//  в instruction.fieldAt.)
// ------------------------------------------------------------
// Модулі застосунку НІКОЛИ не породжують геометрію напряму: Evolution
// Pressures (evolutionPressure.ts) лише перерозподіляють, ДЕ наступне
// відкладення мінералу стає ймовірнішим. Оцінка кожного Growth Site:
//
//   score = Pressure × GrowthPotential × SurfaceStress × LocalDensity
//           × GrowthShadow × DomainAffinity × Compactness
//
// (замість старого «клин домену → рулетка»). Жорсткі кутові клини зникли:
// dna.domainOrder тепер задає лише М'ЯКИЙ переважний азимут кожного
// домену (гаусіана), тож регіональні кольорові родини зберігаються, але
// кристали різних доменів можуть змішуватись — як у справжній друзі.
//
// SurfaceStress — детермінований value-noise по решітці простору: саме він
// вбиває радіальну симетрію (одні регіони стають тісними, інші лишаються
// порожніми — «crowded regions and empty regions»).
//
// ІСТОРИЧНЕ ПОЛЕ (ключ до append-only): рулетка події оцінюється НЕ живими
// EvolutionPressures (ті стрибають від кожного нового запису БД і зривали б
// рулетку старих подій), а полем, ЯКИМ ВОНО БУЛО на дату події —
// placementFieldAt() відтворює тиски з датованих списків, відфільтрованих
// «не молодше за подію». Дані, додані сьогоднішньою датою, не змінюють
// історію жодної існуючої події → її рулетка заморожена назавжди. Запис
// заднім числом переоцінює лише молодші за нього шари («зміна минулого
// переосаджує все, що нашарувалось поверх») — задокументований компроміс,
// див. політику в growthEvents.ts.
// ============================================================
import { mulberry32, hashSeedString } from '../mulberry32';
import { type Vec3, dot, distSq, lengthOf, v3, add, scale } from './vec3';
import type { ArtifactDNA, ArtifactInput, DepositedCrystal, DepositionEvent, GrowthDomainId } from './artifactTypes';
import { buildEvolutionTimeline, categoryShares, evenness, historyAt, type EvolutionTimeline } from './evolution';

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];
const WEDGE_WIDTH = (Math.PI * 2) / DOMAIN_IDS.length;

/** М'який переважний азимут домену — центр колишнього клину (dna.domainOrder). */
export function domainAzimuth(dna: ArtifactDNA, domain: GrowthDomainId): number {
  return dna.domainOrder.indexOf(domain) * WEDGE_WIDTH + WEDGE_WIDTH / 2;
}

// ── Історичне ймовірнісне поле ───────────────────────────────────
// Volume I: єдине джерело правди про «стан історії на вік N» — Evolution
// Engine (evolution/pressureSolver.ts::historyAt). Тут лишається тільки
// КРИСТАЛІЧНА проєкція цих рахунків у тиски розміщення.

/** Обгортка таймлайна Evolution Engine — рахується один раз на побудову. */
export interface FieldHistory {
  timeline: EvolutionTimeline;
}

export function makeFieldHistory(input: ArtifactInput): FieldHistory {
  return { timeline: buildEvolutionTimeline(input) };
}

/** Тиски, що керують РОЗМІЩЕННЯМ, станом на дату події. Формули дзеркалять
 *  computeEvolutionPressures — але по відфільтрованій історії. */
export interface PlacementField {
  expansion: number;
  luminosity: number;
  stability: number;
  harmony: number;
  domainShare: Record<GrowthDomainId, number>;
}

export function placementFieldAt(h: FieldHistory, ageDays: number): PlacementField {
  const c = historyAt(h.timeline, ageDays);
  const shares = categoryShares(c);
  const total = DOMAIN_IDS.reduce((acc, id) => acc + shares[id], 0) || 1;
  const domainShare = {} as Record<GrowthDomainId, number>;
  for (const id of DOMAIN_IDS) domainShare[id] = shares[id] / total;

  return {
    expansion: Math.min(1, (c.countries * 3 + c.cities) / 28),
    luminosity: Math.min(0.85, c.memories * 0.035),
    stability: Math.max(
      0,
      Math.min(
        1,
        (c.goals / 8) * 0.5 +
          (Math.min(c.anniversaries, 4) / 4) * 0.3 +
          (Math.min(c.daysTogetherThen, 1000) / 1000) * 0.2,
      ),
    ),
    harmony: evenness(DOMAIN_IDS.map((id) => shares[id])),
    domainShare,
  };
}

// ── Surface Stress: 2-октавний value-noise по решітці ────────────
// Seed-офсет hash('stress') — див. реєстр у mineralDeposition.ts.

const STRESS_FREQ = 2.4;

function latticeValue(seedNum: number, ix: number, iy: number, iz: number): number {
  return mulberry32(seedNum + hashSeedString('stress') + hashSeedString(`${ix}|${iy}|${iz}`))();
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function valueNoise(seedNum: number, p: Vec3): number {
  const ix = Math.floor(p.x);
  const iy = Math.floor(p.y);
  const iz = Math.floor(p.z);
  const fx = smooth(p.x - ix);
  const fy = smooth(p.y - iy);
  const fz = smooth(p.z - iz);
  let acc = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
        acc += w * latticeValue(seedNum, ix + dx, iy + dy, iz + dz);
      }
    }
  }
  return acc;
}

/** 0.3..1.8 — локальна «напруга поверхні»: де їй високо, там мінерал охочіше
 *  відкладається. Контраст навмисно різкий — саме він лишає «мертві зони». */
export function surfaceStress(seedNum: number, point: Vec3): number {
  const n1 = valueNoise(seedNum, scale(point, STRESS_FREQ));
  const n2 = valueNoise(seedNum, add(scale(point, STRESS_FREQ * 2.7), v3(11.7, 5.3, 8.9)));
  return 0.3 + 1.5 * (n1 * 0.65 + n2 * 0.35);
}

// ── Growth Potential уздовж тіла ─────────────────────────────────

/**
 * Потенціал росту бічної поверхні: пік БІЛЯ ОСНОВИ тіла (референсна друза:
 * дочірні кристали виходять з-під підніжжя головного і тягнуться вгору) —
 * щільний курган замість «гілок на гілках».
 */
export function growthPotential(t: number): number {
  const d = (t - 0.14) / 0.18;
  return 0.18 + 0.82 * Math.exp(-d * d);
}

/** Тяжіння до «ґрунту» маси: підніжжя привабливіше, але не настільки, щоб
 *  усе злипалось в одну точку — дочірні шпилі чіпляються й трохи вище,
 *  утворюючи об'ємне віяло. */
export function groundTerm(y: number): number {
  return 1 / (1 + Math.max(0, y + 0.3) * 1.3);
}

// ── Local Density і Growth Shadow ────────────────────────────────

const bodyMid = (c: DepositedCrystal): Vec3 => add(c.anchor, scale(c.direction, c.length * 0.5));

/** Скільки мінеральної маси вже зібралось навколо точки (гладка сума). */
export function localDensity(point: Vec3, substrate: readonly DepositedCrystal[]): number {
  let acc = 0;
  for (const c of substrate) acc += Math.exp(-distSq(point, bodyMid(c)) / 0.36);
  return acc;
}

/**
 * Growth Shadow: великі зрілі тіла поглинають енергію росту поблизу —
 * сусіди виростають коротшими/тоншими/повільнішими. Повертає 0..1
 * (1 = повна енергія). Рахується по тому САМОМУ замороженому набору
 * субстрату, що й вибір місця — крос-стрімова стабільність не ламається.
 */
export function growthEnergyAt(point: Vec3, substrate: readonly DepositedCrystal[]): number {
  let shade = 0;
  for (const c of substrate) {
    const bulk = c.radius * c.length;
    shade += bulk / (0.25 + distSq(point, bodyMid(c)));
  }
  return Math.max(0.3, Math.min(1, 1.12 - shade * 0.16));
}

// ── Повна оцінка Growth Site ─────────────────────────────────────

export interface GrowthFieldContext {
  seedNum: number;
  dna: ArtifactDNA;
  /** Історичне поле тисків — станом на дату події (див. заголовок). */
  field: PlacementField;
  substrate: readonly DepositedCrystal[];
  /** Центроїд середин тіл субстрату — «звідки» міряється expansion. */
  centroid: Vec3;
  /** Азимутальна анізотропія друзи (проти «морської зірки»): два протилежні
   *  напрямки стиснені, перпендикулярні — розкриті. Раз назавжди з seed
   *  (реєстр: +hash('anisotropy')). */
  anisoAzimuth: number;
  anisoAmp: number;
}

export function makeFieldContext(
  seedNum: number,
  dna: ArtifactDNA,
  field: PlacementField,
  substrate: readonly DepositedCrystal[],
): GrowthFieldContext {
  let centroid = v3(0, 0, 0);
  if (substrate.length > 0) {
    for (const c of substrate) centroid = add(centroid, bodyMid(c));
    centroid = scale(centroid, 1 / substrate.length);
  }
  const anisoRng = mulberry32(seedNum + hashSeedString('anisotropy'));
  const anisoAzimuth = anisoRng() * Math.PI * 2;
  const anisoAmp = 0.35 + anisoRng() * 0.2;
  return { seedNum, dna, field, substrate, centroid, anisoAzimuth, anisoAmp };
}

/**
 * Множник тисків для конкретного виду події:
 *  • Travel → Expansion: назовні від центроїда маси (кластер розповзається);
 *  • Memories → Internal Density: туди, де маса вже зібралась (ущільнення,
 *    дрібні кристали в «тріщинах» між старими);
 *  • Goals → Structural: майже вертикальні нормалі (стійка архітектура);
 *  • Wishlist → Luminosity: ближче до вістря (периферійні іскри);
 *  • domainShare → багатий домен додатково ущільнює свій регіон.
 * (Photos → Refinement свідомо НЕ впливає на розміщення — лише полірує
 * матеріал/грані, див. deriveClusterMaterial і buildBranchGeometry.)
 */
function pressureTerm(ctx: GrowthFieldContext, event: DepositionEvent, point: Vec3, normal: Vec3, t: number, density: number): number {
  const { field } = ctx;
  let term = 1;

  const fromCenter = v3(point.x - ctx.centroid.x, 0, point.z - ctx.centroid.z);
  const horiz = lengthOf(fromCenter);
  if (horiz > 1e-6) {
    const outward = Math.max(0, dot(scale(fromCenter, 1 / horiz), normal)) * Math.min(1, horiz / 0.9);
    term *= 1 + field.expansion * 0.9 * outward;
  }

  term *= 1 + field.luminosity * 0.6 * Math.min(1, density * 0.5);
  term *= 1 + field.stability * 0.45 * Math.max(0, normal.y);
  if (event.kind === 'wish') term *= 0.7 + 0.6 * t;
  if (event.domain !== null) term *= 1 + (field.domainShare[event.domain] ?? 0) * 0.35;

  return term;
}

/** М'яка регіональна прив'язка домену — гаусіана по азимуту замість клину. */
function domainAffinity(ctx: GrowthFieldContext, event: DepositionEvent, point: Vec3): number {
  const horiz = Math.hypot(point.x, point.z);
  if (event.domain === null) {
    // 'core' тяжіє до центру маси — головний стрижень друзи.
    return 1 / (1 + horiz * 1.6);
  }
  if (horiz < 0.08) return 1; // біля осі азимут не визначений — без штрафу
  const az = Math.atan2(point.z, point.x);
  const target = domainAzimuth(ctx.dna, event.domain);
  let d = Math.abs(az - target) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  // Harmony розмиває регіони (рівномірне життя пари → однорідніша друза).
  const sigma = 0.55 + ctx.field.harmony * 0.55;
  const g = Math.exp(-(d * d) / (2 * sigma * sigma));
  const weight = Math.min(1, horiz / 0.3);
  return 1 - weight * (1 - g) * 0.85;
}

/** Штраф далеких/високих місць — композиція лишається однією тісною масою. */
function compactness(point: Vec3): number {
  return 1 / (1 + Math.max(0, lengthOf(point) - 1.25) * 2.4);
}

/** Анізотропія силуету: cos(2·Δaz) стискає два протилежні азимути, лишаючи
 *  «важкий» нерівний профіль замість рівномірної зірки. Біля осі — нейтрально. */
function silhouetteAnisotropy(ctx: GrowthFieldContext, point: Vec3): number {
  const horiz = Math.hypot(point.x, point.z);
  if (horiz < 0.08) return 1;
  const az = Math.atan2(point.z, point.x);
  const squeeze = 0.5 + 0.5 * Math.cos(2 * (az - ctx.anisoAzimuth));
  return 1 - Math.min(1, horiz / 0.3) * ctx.anisoAmp * squeeze;
}

/** Доцентрове тяжіння: серце друзи щільніше, але помірно — інакше все
 *  збивається в одну колону замість віяла окремих шпилів. */
function centerPull(point: Vec3): number {
  const horizSq = point.x * point.x + point.z * point.z;
  return 1 + 0.12 * Math.exp(-horizSq / 0.5);
}

export function scoreGrowthSite(
  ctx: GrowthFieldContext,
  event: DepositionEvent,
  point: Vec3,
  normal: Vec3,
  t: number,
): number {
  const density = localDensity(point, ctx.substrate);
  const densityTerm = 0.55 + 0.45 / (1 + density * 0.45);
  return (
    pressureTerm(ctx, event, point, normal, t, density) *
    growthPotential(t) *
    surfaceStress(ctx.seedNum, point) *
    densityTerm *
    growthEnergyAt(point, ctx.substrate) *
    domainAffinity(ctx, event, point) *
    compactness(point) *
    silhouetteAnisotropy(ctx, point) *
    centerPull(point) *
    groundTerm(point.y)
  );
}
