// ============================================================
// mineralDeposition — геологічний симулятор росту кристалічної маси.
// ------------------------------------------------------------
// Рушій НЕ «створює кристали» — він ТРАНСПОРТУЄ І ВІДКЛАДАЄ мінеральну
// речовину: артефакт — одне безперервно зростаюче геологічне тіло, кожен
// видимий кристал — лише поточний вираз однієї живої системи.
//
// Потік симуляції: Growth Event → Growth Center → Colony.
// Для кожної події відкладення (growthEvents.ts, стабільний ранг у своєму
// стрімі):
//   1. K фіксованих кандидатів Growth Site на бічних поверхнях видимого
//      субстрату (аналітика growthSurface.ts — жодного меш-рейкасту);
//   2. рулетка за score ймовірнісного поля (growthField.ts) — Evolution
//      Pressures лише перерозподіляють імовірність, ніколи не кладуть
//      геометрію напряму;
//   3. успадкування напрямку від локальної нормалі + осі субстрату
//      (кристалічні родини, не гілки дерева);
//   4. Growth Shadow → енергія росту (конкуренція: біля великих зрілих тіл
//      нові виростають коротшими/тоншими);
//   5. base burial — основа ховається ПІД поверхню субстрату: мешi
//      перекриваються і зливаються в одну мінеральну масу;
//   6. іноді — колонія: 2-5 кристалів-супутників майже з тієї самої точки
//      (кварцова нуклеація).
//
// ДЕТЕРМІНІЗМ (правила, які не можна ламати):
//   • кожна подія має ВЛАСНИЙ mulberry32-потік (реєстр офсетів нижче);
//     порядок draw фіксований і НЕ залежить від розміру субстрату чи
//     результату колонії (draw-and-discard);
//   • субстрат — завжди масив у порядку відкладення (ніколи Map/Set);
//   • шлях розміщення не читає сьогоднішню дату: вибір місця йде по
//     «скелетній» геометрії (повні розміри), гейтинг — по різницях віків;
//     зрілість масштабує лише rendered-геометрію (growthSurface.ts);
//   • стадія 'stabilization' НЕ зменшує growthPotential субстрату (як
//     радила архітектурна нотатка): це зробило б score залежним від
//     зрілості → від дати → рулетка могла б перескочити між днями.
//     Стабілізація — суто рендерна якість (stage в ArtifactNode).
//
// Реєстр seed-офсетів (продовження реєстру попереднього покоління; щоб
// нові додавання не колізували з існуючими):
//   +5100 + i*173             — core-відкладення i
//   +7789 + id*97             — milestone
//   +3311 + id*53             — wish
//   +6203 + id*41             — goal
//   +8317 + id*41             — anniversary
//   +hash('memory')+i*71      — memory-бакет i
//   +hash('creation:S')+i*83  — creation-бакет i джерела S
//   +hash('baseline:D')+i*61  — baseline-відкладення домену D
//   +90210                    — генерація ArtifactDNA (artifactDNA.ts)
//   +hash('nucleus')          — параметри віртуального ядра-нуклеуса
//   +hash('stress')           — value-noise Surface Stress (growthField.ts)
//   +hash('anisotropy')       — азимутальна анізотропія силуету (growthField.ts)
//   +hash('satellite:KEY')+s*29 — супутник s колонії події KEY
//   Composition Framework (composition/):
//   +hash('silhouette')       — вибір силуету і базовий азимут осей
//   +hash('sectors')          — seeded-багатство секторів щільності
//   +hash('archetype:KEY')    — тайбрейк архетипу тіла KEY
//   +hash('companion:KEY')    — компаньйони архетипу (twin/fan/split)
//   +hash('crook:KEY')        — «кривизна молодості» тіла KEY
//   +hash('micro:KEY')        — мікрошар на тілі KEY
//   +hash('composed:KEY')     — дихання/spin синтезованих композитором тіл
// ============================================================
import { mulberry32, hashSeedString } from '../mulberry32';
import { maturityCurve } from './maturity';
import { type Vec3, add, scale, normalize, v3 } from './vec3';
import {
  MATURITY_HEIGHT_SCALE,
  MATURITY_RADIUS_SCALE,
  radiusAtT,
  sampleSurfacePoint,
  type SurfaceBody,
} from './growthSurface';
import {
  growthEnergyAt,
  makeFieldContext,
  makeFieldHistory,
  placementFieldAt,
  scoreGrowthSite,
  type PlacementField,
} from './growthField';
import { buildDepositionStreams } from './growthEvents';
import { composeMineralCluster } from './composition/mineralPreset';
import type { CompositionScore } from './composition/score';
import type {
  ArtifactInput,
  ArtifactNode,
  DepositedCrystal,
  DepositionEvent,
  EvolutionPressures,
  LifeCycleStage,
  NodeKind,
} from './artifactTypes';

/** Кандидатів на місце росту за подію — фіксовано (детермінізм draw-порядку). */
const SITE_CANDIDATES = 12;
/** Частка бічної поверхні, де нуклеюється нове тіло: біля ОСНОВИ — дочірні
 *  кристали виростають з-під підніжжя маси і тягнуться вгору (референс:
 *  вертикальна друза, не «гілки на стовбурах»). */
const SITE_T_MIN = 0.03;
const SITE_T_MAX = 0.42;
/** Глибина поховання основи, у власних радіусах нового тіла. Глибоко —
 *  перехідна зона між тілами повністю ховається, стики читаються зрощеними. */
const BURIAL = 0.62;
/** Мінімальна вертикальна складова напрямку: друза з референсу — майже
 *  вертикальні призми (нахил ≤ ~35°); зрідка (RARE) — діагональне тіло. */
const MIN_UPWARD_MAIN = 0.82;
const MIN_UPWARD_RARE = 0.55;
const DIAGONAL_CHANCE = 0.14;
/** A/B-вимикач колоній (перф-запобіжник для слабких мобільних GPU). */
const COLONIES_ENABLED = true;

/** Монарх: центральний головний кристал. Висота росте РІВНОМІРНО з днями
 *  разом (лінійно до MONARCH_GROWTH_DAYS), не стрибком; стеля висоти для
 *  всіх інших — око одразу бачить центр друзи. */
const MONARCH_BASE_LENGTH = 1.15;
const MONARCH_LENGTH_GAIN = 1.5;
const MONARCH_GROWTH_DAYS = 1200;
const MONARCH_RADIUS_BOOST = 1.5;
const MONARCH_HEIGHT_CEILING = 0.9;

/** Профіль «кургану»: що далі від осі, то нижчі дочірні кристали —
 *  висоти спадають від центру, як у музейній друзі з референсів. */
const moundFalloff = (horiz: number): number => 0.34 + 0.66 / (1 + horiz * 2.3);

/** Базовий шанс колонії за видом відкладення (великі події нуклеюють охочіше;
 *  дрібні види — стриманіше, щоб композиція «дихала», а не шуміла). */
const COLONY_CHANCE: Record<NodeKind, number> = {
  core: 0.12,
  country: 0.45,
  city: 0.35,
  milestone: 0.45,
  goal: 0.25,
  anniversary: 0.25,
  creation: 0.25,
  memory: 0.25,
  wish: 0.2,
};

interface BodyPair {
  /** Скелетне тіло (повні розміри) — по ньому йде вибір місць. */
  skeletal: SurfaceBody;
  /** Rendered-тіло (розміри × зрілість) — по ньому кладеться фактична основа. */
  rendered: SurfaceBody;
}

const toBodies = (c: DepositedCrystal): BodyPair => ({
  skeletal: { anchor: c.anchor, direction: c.direction, length: c.length, radius: c.radius },
  rendered: {
    anchor: c.renderedAnchor,
    direction: c.direction,
    length: c.length * MATURITY_HEIGHT_SCALE(c.maturity),
    radius: c.radius * MATURITY_RADIUS_SCALE(c.maturity),
  },
});

/**
 * Віртуальне ядро-нуклеус: перша «порода», на якій нуклеює core-0 (і будь-яка
 * подія, старша за весь bedrock). Ніколи не рендериться — його поверхня
 * миттєво ховається під першими ж відкладеннями. (export — лише для тестів
 * інваріанта поверхневого прикріплення; публічний контракт — index.ts.)
 */
export function makeNucleus(seedNum: number): DepositedCrystal {
  const rng = mulberry32(seedNum + hashSeedString('nucleus'));
  const direction = normalize(v3((rng() - 0.5) * 0.16, 1, (rng() - 0.5) * 0.16));
  // Ширше серце → більше тіл нуклеює біля центру (щільне ядро друзи).
  const radius = 0.17 + rng() * 0.05;
  const anchor = v3(0, -0.62, 0);
  return {
    key: '__nucleus',
    kind: 'core',
    domain: null,
    anchor,
    renderedAnchor: anchor,
    direction,
    length: 0.7,
    radius,
    maturity: 1,
    ageDays: Number.MAX_SAFE_INTEGER,
    growthEnergy: 1,
    colonyId: '__nucleus',
    role: 'dominant',
    primary: false,
    breathePhase: 0,
    breatheSpeed: 0,
    spin: 0,
  };
}

function lifeCycleStage(maturity: number, energy: number, refinement: number): LifeCycleStage {
  if (maturity < 0.15) return 'nucleation';
  if (maturity < 0.55) return 'growth';
  if (energy < 0.6) return 'competition';
  if (maturity > 0.9) return 'stabilization';
  if (refinement > 0.6 && maturity > 0.7) return 'polishing';
  return 'growth';
}

/** Випадковий одиничний вектор з 2 draw (детермінований внесок збурення). */
function perturbVec(rng: () => number): Vec3 {
  const az = rng() * Math.PI * 2;
  const y = rng() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return v3(Math.cos(az) * r, y, Math.sin(az) * r);
}

/** Успадкування напрямку (3 draw): вертикальна друза з референсу — кожен
 *  кристал тягнеться ВГОРУ, зовнішні ледь віялом назовні (нахил росте з
 *  відстанню від осі), нормаль/вісь субстрату дають лише органічний
 *  відтінок. Діагональні тіла — зрідка (DIAGONAL_CHANCE). */
function inheritDirection(normal: Vec3, substrateDirection: Vec3, at: Vec3, rng: () => number): Vec3 {
  const perturb = perturbVec(rng);
  const rare = rng();
  const horiz = Math.hypot(at.x, at.z);
  const radial = horiz > 1e-6 ? v3(at.x / horiz, 0, at.z / horiz) : v3(0, 0, 0);
  const lean = 0.1 + 0.32 * Math.min(1, horiz / 0.85);
  const dir = normalize(
    add(
      add(v3(0, 1, 0), scale(radial, lean)),
      add(add(scale(normal, 0.12), scale(substrateDirection, 0.08)), scale(perturb, 0.07)),
    ),
  );
  const minUp = rare < DIAGONAL_CHANCE ? MIN_UPWARD_RARE : MIN_UPWARD_MAIN;
  if (dir.y >= minUp) return dir;
  // М'яке підняття до мінімальної вертикалі — без стрибка напрямку.
  return normalize(v3(dir.x, minUp + (dir.y < 0 ? 0.08 : 0), dir.z));
}

/** «Гравітаційна компакція»: що вище нуклеювало тіло, то стриманіший ріст —
 *  маса лишається тісною брилою, а не вежею (і не вилазить за кадр камери). */
const heightDamp = (anchorY: number): number => 1 / (1 + 0.5 * Math.max(0, anchorY + 0.1));

/** Занурена в поверхню тіла основа: скелетна і rendered водночас. Глибина —
 *  частка ВЛАСНОГО радіуса, але не глибша за локальну товщу субстрату:
 *  товсте тіло на тонкому стеблі інакше «прошило б» його наскрізь і
 *  вистромилось би з протилежного боку. */
function buriedAnchors(body: BodyPair, t: number, angle: number, radius: number, maturity: number) {
  const skeletalSample = sampleSurfacePoint(body.skeletal, t, angle);
  const renderedSample = sampleSurfacePoint(body.rendered, t, angle);
  const skeletalDepth = Math.min(radius * BURIAL, radiusAtT(body.skeletal.radius, t) * 0.85);
  const renderedDepth = Math.min(
    radius * MATURITY_RADIUS_SCALE(maturity) * BURIAL,
    radiusAtT(body.rendered.radius, t) * 0.85,
  );
  return {
    skeletalSample,
    anchor: add(skeletalSample.point, scale(skeletalSample.normal, -skeletalDepth)),
    renderedAnchor: add(renderedSample.point, scale(renderedSample.normal, -renderedDepth)),
  };
}

/** Стан монарха друзи: ключ обирається до симуляції, довжина фіксується
 *  в момент його відкладення і стає стелею висоти для решти тіл. */
interface MonarchState {
  key: string | null;
  length: number | null;
}

/**
 * Одна подія відкладення: домінантне тіло + (іноді) колонія супутників.
 * Всі draw головного потоку йдуть у фіксованому, задокументованому порядку:
 * 6 (розміри/girth/оберт/дихання) → K×3 (кандидати) → 1 (рулетка) →
 * 3 (напрямок) → 2 (колонія: шанс, розмір). Супутники читають ВЛАСНІ
 * потоки реєстру.
 */
function depositMineral(
  event: DepositionEvent,
  substrate: readonly DepositedCrystal[],
  seedNum: number,
  dna: ArtifactInput['dna'],
  field: PlacementField,
  monarch: MonarchState,
): DepositedCrystal[] {
  const rng = mulberry32(seedNum + event.seedOffset);
  const isMonarch = event.key === monarch.key;

  let rawLength = event.lengthMin + rng() * event.lengthRange;
  let rawRadius = event.radiusMin + rng() * event.radiusRange;
  // «Обхват»: квадрат зміщує більшість тіл у стрункі, лишаючи кільком
  // помітну масивність — сильна варіація пропорцій замість клонів.
  const girthDraw = rng();
  const bigKind = event.kind === 'core' || event.kind === 'country' || event.kind === 'milestone';
  const girth = Math.max(bigKind ? 0.8 : 0.65, 0.65 + girthDraw * girthDraw * 1.3);
  rawRadius *= girth;
  if (isMonarch) {
    // Головний кристал росте РІВНОМІРНО з кількістю днів разом: висота —
    // лінійна функція віку стосунків (ageDays монарха = daysTogether),
    // а не випадковий draw. Щодня — трошки вищий.
    rawLength = MONARCH_BASE_LENGTH + (Math.min(event.ageDays, MONARCH_GROWTH_DAYS) / MONARCH_GROWTH_DAYS) * MONARCH_LENGTH_GAIN;
    rawRadius *= MONARCH_RADIUS_BOOST;
  }
  const spin = rng() * Math.PI * 2;
  const breathePhase = rng() * Math.PI * 2;
  const breatheSpeed = event.breatheMin + rng() * event.breatheRange;

  // K кандидатів Growth Site — завжди рівно K×3 draw, незалежно від
  // розміру субстрату чи оцінок. Оцінка — за ІСТОРИЧНИМ полем події
  // (growthField.ts): рулетка існуючої події заморожена назавжди.
  const ctx = makeFieldContext(seedNum, dna, field, substrate);
  const bodies = substrate.map(toBodies);
  const candidates: { idx: number; t: number; angle: number; score: number }[] = [];
  for (let c = 0; c < SITE_CANDIDATES; c++) {
    const idx = Math.min(substrate.length - 1, Math.floor(rng() * substrate.length));
    const t = SITE_T_MIN + rng() * (SITE_T_MAX - SITE_T_MIN);
    const angle = rng() * Math.PI * 2;
    const { point, normal } = sampleSurfacePoint(bodies[idx]!.skeletal, t, angle);
    candidates.push({ idx, t, angle, score: 1e-6 + scoreGrowthSite(ctx, event, point, normal, t) });
  }

  // Рулетка ймовірнісного поля (1 draw).
  const total = candidates.reduce((acc, s) => acc + s.score, 0);
  let pick = rng() * total;
  let chosen = candidates[candidates.length - 1]!;
  for (const cand of candidates) {
    pick -= cand.score;
    if (pick <= 0) {
      chosen = cand;
      break;
    }
  }
  // Монарх ігнорує рулетку МІСЦЯ (draw однаково витрачені — форма потоку
  // фіксована): він сидить точно ПО ЦЕНТРУ, на осі ядра-нуклеуса — головний
  // кристал композиції, з-під основи якого росте решта друзи.
  if (isMonarch) chosen = { idx: 0, t: 0.45, angle: chosen.angle, score: chosen.score };
  const host = substrate[chosen.idx]!;
  const hostBody = bodies[chosen.idx]!;

  // Growth Shadow → енергія; розміри звужуються в тіні великих сусідів;
  // профіль кургану — що далі від осі, то нижче тіло (референсна друза).
  const probe = sampleSurfacePoint(hostBody.skeletal, chosen.t, chosen.angle);
  const energy = growthEnergyAt(probe.point, substrate);
  const falloff = isMonarch ? 1 : moundFalloff(Math.hypot(probe.point.x, probe.point.z));
  let length = rawLength * (0.55 + 0.45 * energy) * heightDamp(probe.point.y) * falloff;
  if (isMonarch) length = rawLength; // рівномірний ріст без випадкових модуляцій
  let radius = rawRadius * (0.7 + 0.3 * energy);
  // Правдоподібні кварцові пропорції (референс): довге тіло не буває
  // голкою-волосиною — стрункість обмежена, король особливо кремезний.
  if (length > 0.6) radius = Math.max(radius, length / (isMonarch ? 5.5 : 7.5));
  // Ієрархія: ніхто не переростає монарха (той відкладається найпершим).
  if (!isMonarch && monarch.length !== null) length = Math.min(length, monarch.length * MONARCH_HEIGHT_CEILING);

  // Успадкування напрямку (3 draw); монарх — ідеально вертикальний стрижень.
  let direction = inheritDirection(probe.normal, host.direction, probe.point, rng);
  if (isMonarch) direction = normalize(add(scale(direction, 0.06), scale(v3(0, 1, 0), 0.94)));

  const maturity = maturityCurve(event.ageDays, event.maturityHalfLife);
  const { anchor, renderedAnchor } = buriedAnchors(hostBody, chosen.t, chosen.angle, radius, maturity);

  const dominant: DepositedCrystal = {
    key: event.key,
    kind: event.kind,
    domain: event.domain,
    ...(event.label !== undefined ? { label: event.label } : {}),
    anchor,
    renderedAnchor,
    direction,
    length,
    radius,
    maturity,
    ageDays: event.ageDays,
    growthEnergy: energy,
    colonyId: event.key,
    role: 'dominant',
    primary: isMonarch,
    ...(event.emphasized !== undefined ? { emphasized: event.emphasized } : {}),
    breathePhase,
    breatheSpeed,
    spin,
  };

  // ── Колонія (2 draw головного потоку: шанс + розмір) ───────────
  const roll = rng();
  const countRoll = rng();
  if (!COLONIES_ENABLED) return [dominant];
  // Історичне поле й тут: жива domainShare перемикала б колонії заднім числом.
  const shareBoost = event.domain !== null ? (field.domainShare[event.domain] ?? 0) * 0.25 : 0;
  // Монарх завжди в оточенні компаньйонів — серце кварцової друзи.
  if (!isMonarch && roll >= Math.min(0.55, COLONY_CHANCE[event.kind] + shareBoost)) return [dominant];

  // Дрібні тіла нуклеюють максимум пару супутників; стеля 3 (менше шуму,
  // композиція «дихає» — негативний простір важливий).
  const maxCount = rawRadius < 0.08 ? 2 : 3;
  const count = Math.min(maxCount, 2 + Math.floor(countRoll * 4));

  const colony: DepositedCrystal[] = [dominant];
  for (let s = 0; s < 5; s++) {
    // Власний потік реєстру; читається ЗАВЖДИ повний набір draw, навіть коли
    // s ≥ count (draw-and-discard) — форма потоку не залежить від count.
    const srng = mulberry32(seedNum + hashSeedString(`satellite:${event.key}`) + s * 29);
    const dt = (srng() - 0.5) * 0.1;
    const dAngle = (srng() - 0.5) * 0.56;
    // s=0 — «середній компаньйон» поруч (один великий → кілька крихітних →
    // ще один середній), решта — справді крихітні: жодних самотніх
    // супутників, що плавають довкола, і жодних повторених силуетів.
    const lenFactor = s === 0 ? 0.45 + srng() * 0.17 : 0.22 + srng() * 0.22;
    const radFactor = s === 0 ? 0.5 + srng() * 0.2 : 0.35 + srng() * 0.25;
    const dirJitter = perturbVec(srng);
    const satSpin = srng() * Math.PI * 2;
    const satPhase = srng() * Math.PI * 2;
    const satSpeed = 0.4 + srng() * 0.3;
    if (s >= count) continue;

    const st = Math.max(SITE_T_MIN, Math.min(SITE_T_MAX, chosen.t + dt));
    const sAngle = chosen.angle + dAngle;
    const satRadius = Math.max(0.03, radius * radFactor);
    const satLength = Math.max(0.1, length * lenFactor);
    // Супутники діляться майже тією самою точкою зародження (кварцова
    // друза): той самий хост, ледь помітний зсув по t/куту, вузьке віяло
    // ВГОРУ навколо осі домінанта — компаньйони теж тягнуться до неба.
    const satDirection = normalize(
      add(add(scale(direction, 0.68), scale(v3(0, 1, 0), 0.25)), scale(dirJitter, 0.1)),
    );
    const sat = buriedAnchors(hostBody, st, sAngle, satRadius, maturity);

    colony.push({
      key: `${event.key}~s${s}`,
      kind: event.kind,
      domain: event.domain,
      ...(event.label !== undefined ? { label: event.label } : {}),
      anchor: sat.anchor,
      renderedAnchor: sat.renderedAnchor,
      direction: satDirection,
      length: satLength,
      radius: satRadius,
      maturity,
      ageDays: event.ageDays,
      growthEnergy: energy,
      colonyId: event.key,
      role: 'satellite',
      primary: false,
      breathePhase: satPhase,
      breatheSpeed: satSpeed,
      spin: satSpin,
    });
  }
  return colony;
}

const toArtifactNode = (c: DepositedCrystal, pressures: EvolutionPressures): ArtifactNode => ({
  key: c.key,
  kind: c.kind,
  domain: c.domain,
  ...(c.label !== undefined ? { label: c.label } : {}),
  growthScale: c.length,
  // «Цілі/річниці/тривалість стосунків → Stability»: товщає ВСЕ, постфактум —
  // одна точка застосування (та сама, що була в попередньому поколінні).
  massScale: c.radius * (1 + pressures.stability * 0.15),
  anchor: c.renderedAnchor,
  direction: c.direction,
  spin: c.spin,
  maturity: c.maturity,
  breathePhase: c.breathePhase,
  breatheSpeed: c.breatheSpeed,
  growthEnergy: c.growthEnergy,
  role: c.role,
  stage: lifeCycleStage(c.maturity, c.growthEnergy, pressures.refinement),
  primary: c.primary,
  tier: c.tier ?? (c.primary ? 'king' : 'family'),
  archetype: c.archetype ?? 'spear',
  ...(c.emphasized !== undefined ? { emphasized: c.emphasized } : {}),
});

/**
 * Монарх друзи: найстаріше центральне відкладення — core-0 (найкраще місце
 * нуклеації, як у справжній друзі), а без bedrock (пара ще не вказала дату
 * стосунків) — найстаріша подія даних. Детерміновано і стабільно: core-0
 * ніколи не рухається, його субстрат — лише нуклеус.
 */
function chooseMonarchKey(streams: readonly { events: readonly DepositionEvent[] }[], daysTogether: number): string | null {
  if (daysTogether > 0) return 'core-0';
  let best: DepositionEvent | null = null;
  for (const stream of streams) {
    for (const event of stream.events) {
      if (best === null || event.ageDays > best.ageDays || (event.ageDays === best.ageDays && event.key < best.key)) {
        best = event;
      }
    }
  }
  return best?.key ?? null;
}

/** Прогін Growth Engine: сирі відкладення до композиції. (Тисків тут нема —
 *  розміщення керує ІСТОРИЧНЕ поле, живі pressures лишаються рендеру.) */
function runDeposition(input: ArtifactInput): DepositedCrystal[] {
  const { seedNum, dna } = input;
  const nucleus = makeNucleus(seedNum);
  const streams = buildDepositionStreams(input);
  const history = makeFieldHistory(input);
  const monarch: MonarchState = { key: chooseMonarchKey(streams, input.usage.daysTogether), length: null };

  const bedrock: DepositedCrystal[] = [];
  const deposited: DepositedCrystal[] = [];

  for (const stream of streams) {
    const isBedrock = stream.id === 'bedrock';
    // Лише домінанти стають субстратом наступних подій: супутники — дрібна
    // «текстура» колонії, а не несуча порода (і так субстрат події не
    // залежить від шансу колонії — менша площа перерозподілу).
    const streamPrior: DepositedCrystal[] = [];

    for (const event of stream.events) {
      // Заморожений субстрат події (політика growthEvents.ts): нуклеус ∪
      // bedrock-не-молодший-за-подію ∪ раніші домінанти свого стріму.
      const substrate = isBedrock
        ? [nucleus, ...streamPrior]
        : [nucleus, ...bedrock.filter((b) => b.ageDays >= event.ageDays), ...streamPrior];

      const field = placementFieldAt(history, event.ageDays);
      const colony = depositMineral(event, substrate, seedNum, dna, field, monarch);
      const dominant = colony[0]!;
      if (dominant.primary) monarch.length = dominant.length;

      streamPrior.push(dominant);
      if (isBedrock) bedrock.push(dominant);
      deposited.push(...colony);
    }
  }

  return deposited;
}

/**
 * Відкладає всю мінеральну масу і компонує її. pressures обчислюється окремо
 * (computeEvolutionPressures) і передається сюди — та сама структура
 * споживається й deriveClusterMaterial, тому рахується лише один раз.
 * Composition Framework (composition/) — фінальний художній шар поверх
 * недоторканного Growth Engine: перетворює коректну геологію на «музейний
 * зразок».
 */
export function depositMineralMass(input: ArtifactInput, pressures: EvolutionPressures): ArtifactNode[] {
  return depositMineralMassWithScore(input, pressures).nodes;
}

/** Той самий результат + самооцінка композиції (Stage 10) — для тестів,
 *  дев-проб і майбутньої телеметрії якості. */
export function depositMineralMassWithScore(
  input: ArtifactInput,
  pressures: EvolutionPressures,
): { nodes: ArtifactNode[]; score: CompositionScore; passes: number } {
  const deposited = runDeposition(input);
  const { crystals, score, passes } = composeMineralCluster(deposited, input.seedNum, input.dna.compactnessBias);
  return { nodes: crystals.map((c) => toArtifactNode(c, pressures)), score, passes };
}
