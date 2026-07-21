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
import { growthEnergyAt, makeFieldContext, scoreGrowthSite, type PlacementField } from './growthField';
import { composeMineralCluster } from './composition/mineralPreset';
import type { CompositionScore } from './composition/score';
import { crystalSpecies, type CrystalConstraints } from './species';
import type {
  ArtifactInput,
  ArtifactNode,
  DepositedCrystal,
  DepositionEvent,
  EvolutionPressures,
} from './artifactTypes';

/** Кандидатів на місце росту за подію — фіксовано (детермінізм draw-порядку).
 *  Це МЕХАНІКА рушія, не біологія виду — тому лишається тут. */
const SITE_CANDIDATES = 12;

// Volume II: усі ВИДОВІ числа (діапазони нуклеації, глибина поховання,
// вертикаль росту, колонії, монарх, профіль кургану, стрункість) живуть у
// Species Layer (species/crystalSpecies.ts::CrystalConstraints) і приходять
// сюди через GrowthInstruction — Growth Engine не знає, що він вирощує.

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

/** Випадковий одиничний вектор з 2 draw (детермінований внесок збурення). */
function perturbVec(rng: () => number): Vec3 {
  const az = rng() * Math.PI * 2;
  const y = rng() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return v3(Math.cos(az) * r, y, Math.sin(az) * r);
}

/** Успадкування напрямку (3 draw): кожне тіло тягнеться ВГОРУ, зовнішні
 *  ледь віялом назовні (нахил росте з відстанню від осі), нормаль/вісь
 *  субстрату дають лише органічний відтінок. Мінімальна вертикаль і шанс
 *  діагоналі — природні правила виду (constraints). */
function inheritDirection(
  normal: Vec3,
  substrateDirection: Vec3,
  at: Vec3,
  rng: () => number,
  c: CrystalConstraints,
): Vec3 {
  const perturb = perturbVec(rng);
  const rare = rng();
  const horiz = Math.hypot(at.x, at.z);
  const radial = horiz > 1e-6 ? v3(at.x / horiz, 0, at.z / horiz) : v3(0, 0, 0);
  // Сильний нахил НАЗОВНІ, що росте з відстанню від осі — саме він робить
  // друзу віялом шпилів (референс), а не пучком вертикалей. Плюс відчутне
  // азимутальне збурення (perturb) — сплеск об'ємний, а не плаский.
  const lean = 0.5 + Math.min(1, horiz / 0.7);
  const dir = normalize(
    add(
      add(v3(0, 1, 0), scale(radial, lean)),
      add(add(scale(normal, 0.15), scale(substrateDirection, 0.08)), scale(perturb, 0.35)),
    ),
  );
  const minUp = rare < c.diagonalChance ? c.minUpwardRare : c.minUpwardMain;
  if (dir.y >= minUp) return dir;
  // М'яке підняття до мінімальної вертикалі — без стрибка напрямку.
  return normalize(v3(dir.x, minUp + (dir.y < 0 ? 0.08 : 0), dir.z));
}

/** Занурена в поверхню тіла основа: скелетна і rendered водночас. Глибина —
 *  частка ВЛАСНОГО радіуса, але не глибша за локальну товщу субстрату:
 *  товсте тіло на тонкому стеблі інакше «прошило б» його наскрізь і
 *  вистромилось би з протилежного боку. */
function buriedAnchors(body: BodyPair, t: number, angle: number, radius: number, maturity: number, burial: number) {
  const skeletalSample = sampleSurfacePoint(body.skeletal, t, angle);
  const renderedSample = sampleSurfacePoint(body.rendered, t, angle);
  const skeletalDepth = Math.min(radius * burial, radiusAtT(body.skeletal.radius, t) * 0.85);
  const renderedDepth = Math.min(
    radius * MATURITY_RADIUS_SCALE(maturity) * burial,
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
  c: CrystalConstraints,
): DepositedCrystal[] {
  const rng = mulberry32(seedNum + event.seedOffset);
  const isMonarch = event.key === monarch.key;

  let rawLength = event.lengthMin + rng() * event.lengthRange;
  let rawRadius = event.radiusMin + rng() * event.radiusRange;
  // «Обхват»: квадрат зміщує більшість тіл у стрункі, лишаючи кільком
  // помітну масивність — сильна варіація пропорцій замість клонів.
  const girthDraw = rng();
  const bigKind = event.kind === 'core' || event.kind === 'country' || event.kind === 'milestone';
  // Стрункіше: менший розкид обхвату — тіла-шпилі, не роздуті самоцвіти.
  const girth = Math.max(bigKind ? 0.7 : 0.55, 0.55 + girthDraw * girthDraw * 0.75);
  rawRadius *= girth;
  if (isMonarch) {
    // Головний кристал росте РІВНОМІРНО з кількістю днів разом: висота —
    // лінійна функція віку стосунків (ageDays монарха = daysTogether),
    // а не випадковий draw. Щодня — трошки вищий.
    rawLength = c.monarch.baseLength + (Math.min(event.ageDays, c.monarch.growthDays) / c.monarch.growthDays) * c.monarch.lengthGain;
    rawRadius *= c.monarch.radiusBoost;
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
  for (let i = 0; i < SITE_CANDIDATES; i++) {
    const idx = Math.min(substrate.length - 1, Math.floor(rng() * substrate.length));
    const t = c.siteTMin + rng() * (c.siteTMax - c.siteTMin);
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
  const falloff = isMonarch ? 1 : c.moundFalloff(Math.hypot(probe.point.x, probe.point.z));
  let length = rawLength * (0.55 + 0.45 * energy) * c.heightDamp(probe.point.y) * falloff;
  if (isMonarch) length = rawLength; // рівномірний ріст без випадкових модуляцій
  let radius = rawRadius * (0.7 + 0.3 * energy);
  // Правдоподібні кварцові пропорції (референс): довге тіло не буває
  // голкою-волосиною — стрункість обмежена, король особливо кремезний.
  if (length > 0.6) radius = Math.max(radius, length / (isMonarch ? c.monarchSlenderness : c.slenderness));
  // Ієрархія: ніхто не переростає монарха (той відкладається найпершим).
  if (!isMonarch && monarch.length !== null) length = Math.min(length, monarch.length * c.monarch.heightCeiling);

  // Успадкування напрямку (3 draw); монарх — ідеально вертикальний стрижень.
  let direction = inheritDirection(probe.normal, host.direction, probe.point, rng, c);
  if (isMonarch) direction = normalize(add(scale(direction, 0.06), scale(v3(0, 1, 0), 0.94)));

  const maturity = maturityCurve(event.ageDays, event.maturityHalfLife);
  const { anchor, renderedAnchor } = buriedAnchors(hostBody, chosen.t, chosen.angle, radius, maturity, c.burial);

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
  if (!c.coloniesEnabled) return [dominant];
  // Історичне поле й тут: жива domainShare перемикала б колонії заднім числом.
  const shareBoost = event.domain !== null ? (field.domainShare[event.domain] ?? 0) * c.colonyShareBoost : 0;
  // Монарх завжди в оточенні компаньйонів — серце кварцової друзи.
  if (!isMonarch && roll >= Math.min(c.colonyMaxChance, c.colonyChance[event.kind] + shareBoost)) return [dominant];

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

    const st = Math.max(c.siteTMin, Math.min(c.siteTMax, chosen.t + dt));
    const sAngle = chosen.angle + dAngle;
    const satRadius = Math.max(0.03, radius * radFactor);
    const satLength = Math.max(0.1, length * lenFactor);
    // Супутники діляться майже тією самою точкою зародження (кварцова
    // друза): той самий хост, ледь помітний зсув по t/куту, вузьке віяло
    // ВГОРУ навколо осі домінанта — компаньйони теж тягнуться до неба.
    const satDirection = normalize(
      add(add(scale(direction, 0.68), scale(v3(0, 1, 0), 0.25)), scale(dirJitter, 0.1)),
    );
    const sat = buriedAnchors(hostBody, st, sAngle, satRadius, maturity, c.burial);

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
  stage: crystalSpecies.evolve(c.maturity, c.growthEnergy, pressures.refinement),
  primary: c.primary,
  tier: c.tier ?? (c.primary ? 'king' : 'family'),
  archetype: c.archetype ?? 'spear',
  ...(c.emphasized !== undefined ? { emphasized: c.emphasized } : {}),
});

/** Прогін Growth Engine: сирі відкладення до композиції. Volume II: рушій
 *  отримує від Species Layer лише GrowthInstruction (стріми, історичне
 *  поле, ієрархію, обмеження) — і не знає, що саме він вирощує. */
function runDeposition(input: ArtifactInput): DepositedCrystal[] {
  const { seedNum, dna } = input;
  const nucleus = makeNucleus(seedNum);
  const instruction = crystalSpecies.buildInstructions(input);
  const constraints = instruction.constraints;
  const monarch: MonarchState = { key: instruction.hierarchy.monarchKey, length: null };

  const bedrock: DepositedCrystal[] = [];
  const deposited: DepositedCrystal[] = [];

  for (const stream of instruction.streams) {
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

      const field = instruction.fieldAt(event.ageDays);
      const colony = depositMineral(event, substrate, seedNum, dna, field, monarch, constraints);
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
