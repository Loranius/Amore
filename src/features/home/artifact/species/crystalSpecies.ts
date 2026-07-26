// ============================================================
// CrystalSpecies — вид «кристал» у Species SDK (Volume II).
// ------------------------------------------------------------
// Один файл = один вид. Тут зібрана вся «геологія виду»: морфологія
// (колонії/друзи/шпилі/тріщини/включення), правила реакцій на тиски
// історії, природні обмеження (кристал не росте вниз, не згинається, має
// поховані основи) і внутрішній стан. Growth Engine (mineralDeposition.ts)
// читає ЛИШЕ GrowthInstruction — числа й правила звідси; його власна
// механіка (рулетка, аналітичні поверхні, тіні) від виду не залежить.
//
// Значення обмежень — байт-в-байт ті, що жили константами в Growth Engine
// до Volume II: зміна архітектури не змінює жодного кристала (гарантія —
// існуючі детермінізм-тести).
// ============================================================
import type { ArtifactInput, EvolutionPressures, LifeCycleStage, NodeKind } from '../artifactTypes';
import type { DepositionStream } from '../growthEvents';
import { buildDepositionStreams } from '../growthEvents';
import { makeFieldHistory, placementFieldAt, type PlacementField } from '../growthField';
import { computeEvolutionPressures } from '../evolutionPressure';
import { buildEvolutionTimeline, solveForces } from '../evolution';
import type { GrowthInstruction, Species } from './speciesTypes';

/** Природні правила кристала (§10) числами — читає Growth Engine. */
export interface CrystalConstraints {
  /** Нуклеація лише біля основи субстрату (частка довжини тіла). */
  siteTMin: number;
  siteTMax: number;
  /** Глибина поховання основи у власних радіусах — основи вростають. */
  burial: number;
  /** Кристал не росте вниз: мінімальна вертикаль напрямку (± рідкісні діагоналі). */
  minUpwardMain: number;
  minUpwardRare: number;
  diagonalChance: number;
  /** Колонії нуклеації (морфологія «друза»). */
  coloniesEnabled: boolean;
  colonyChance: Readonly<Record<NodeKind, number>>;
  colonyShareBoost: number;
  colonyMaxChance: number;
  /** Головний кристал: рівномірний ріст із днями разом і стеля для решти. */
  monarch: {
    baseLength: number;
    lengthGain: number;
    growthDays: number;
    radiusBoost: number;
    heightCeiling: number;
  };
  /** Профіль кургану: висоти спадають від осі. */
  moundFalloff: (horiz: number) => number;
  /** «Гравітаційна компакція»: високо нуклейовані тіла стриманіші. */
  heightDamp: (anchorY: number) => number;
  /** Правдоподібні кварцові пропорції: стеля стрункості (довжина/радіус). */
  slenderness: number;
  monarchSlenderness: number;
  // ── Attachment-safe placement (`CAI-REQ-001..003`) ──────────────
  /** Частка радіуса, якою тіло «резервує» об'єм у перевірці зіткнень.
   *  <1, бо тіло звужується до вістря — повний радіус був би надто суворим. */
  clearanceScale: number;
  /** Мін. кут між основами двох дітей ОДНОГО господаря, радіани
   *  (проти злипання; спека вимагає non-clumping без жорсткої симетрії). */
  minAngularSeparation: number;
  /** Коефіцієнт «стискання» дитини, коли жоден кандидат не проходить
   *  кліренс (спека: reject → redirect → SHRINK → defer). */
  conflictShrink: number;
}

const CRYSTAL_CONSTRAINTS: CrystalConstraints = {
  // Нуклеація ТІЛЬКИ в нижній чверті господаря. Це найважливіше число
  // всього виду: заміри референсу (crystalsofx_viii.glb, 370k вершин)
  // показали, що 93% тіл кріпляться нижче 35% загальної висоти, а вище 40%
  // не кріпиться НІЧОГО. Доти тут стояло 0.5, діти сідали до середини
  // короля й читались як бугорки на його боці — саме це робило кристал
  // «качаном кукурудзи» замість друзи.
  siteTMin: 0.02,
  siteTMax: 0.22,
  // Глибше поховання: підошва друзи має бути ОДНІЄЮ масою, а не пучком
  // окремих торців. Дрібні проміжки внизу все одно ховає основа-матриця.
  burial: 0.55,
  // Друза — це ВІЯЛО шпилів, що розходяться від основи, а не пучок
  // вертикалей. Низька мінімальна вертикаль і часті діагоналі дають
  // спідницю навколо короля; у референсі діти саме розходяться назовні,
  // а не тягнуться вгору паралельно головному кристалу.
  minUpwardMain: 0.3,
  minUpwardRare: 0.12,
  diagonalChance: 0.5,
  coloniesEnabled: true,
  // Менше колоній (було вдвічі більше): супутники збивали композицію в
  // кущ; кілька окремих шпилів читаються як кристали краще за клуб.
  colonyChance: {
    core: 0.08,
    country: 0.22,
    city: 0.18,
    milestone: 0.25,
    goal: 0.12,
    anniversary: 0.12,
    creation: 0.12,
    memory: 0.12,
    wish: 0.1,
  },
  colonyShareBoost: 0.15,
  colonyMaxChance: 0.35,
  // Головний кристал — ВИЩИЙ і водночас ТОНШИЙ. У референсі король
  // перевищує другий за довжиною кристал у 2.7 раза, а в нас було лише
  // 1.2 — око не знаходило центру. Але просто «зробити більшим» не можна:
  // спроба з radiusBoost 1.2 дала моноліт, що проковтнув усю друзу. Тому
  // довжина вгору, а радіус ВНИЗ (0.86) — виходить шпиль, а не колона.
  // УВАГА до `heightCeiling`: це стеля для ДІТЕЙ відносно короля
  // (growthEngine рядок «length = min(length, monarch.length × ceiling)»),
  // а не висота самого короля. Я спершу підняв її до 1.1, вирішивши, що це
  // ліміт монарха, — і тим дозволив дітям бути ДОВШИМИ за нього; король
  // виходив 1.6:1 замість потрібних 2.7:1. У референсі другий за довжиною
  // кристал — 37% від короля, звідси 0.4.
  monarch: { baseLength: 1.35, lengthGain: 1.05, growthDays: 1200, radiusBoost: 0.86, heightCeiling: 0.4 },
  // Крутий профіль кургану. Тут теж розворот на 180°: раніше коментар
  // прямо декларував «бічні шпилі лишаються ВИСОКИМИ», і саме це робило
  // дітей завдовжки в третину висоти. У референсі медіанна дитина — 7%
  // висоти, тобто коротка друзка біля підніжжя.
  moundFalloff: (horiz) => 0.3 + 0.7 / (1 + horiz * 4.0),
  heightDamp: (anchorY) => 1 / (1 + 0.5 * Math.max(0, anchorY + 0.1)),
  // Стрункі шпилі, не самоцвіти-галька; король — найстрункіший з усіх.
  slenderness: 9.5,
  monarchSlenderness: 11,
  // Кристали більше не проростають один крізь одного: тіло резервує об'єм
  // (капсула) і кут на господарі. 0.8 — компроміс між «конус звужується»
  // (повний радіус надто суворий) і гарантією, що грані не перетнуться.
  clearanceScale: 0.8,
  // Щільніша спідниця: діти тепер тиснуться в нижню чверть, тож 0.55 рад
  // не давав їм там поміститись і половина відсіювалась.
  minAngularSeparation: 0.4,
  conflictShrink: 0.62,
};

/** Внутрішній стан виду (§13) — описовий, для UI/телеметрії/майбутніх
 *  рендерерів; Growth Engine його не споживає (жодного візуального впливу). */
export interface CrystalState {
  stress: number;
  purity: number;
  density: number;
  fracture: number;
  energy: number;
}

/**
 * Еволюція виду (§12): нуклеація → ріст → конкуренція → полірування →
 * стабілізація (далі, у майбутніх томах, — вивітрювання).
 */
function crystalEvolve(maturity: number, energy: number, refinement: number): LifeCycleStage {
  if (maturity < 0.15) return 'nucleation';
  if (maturity < 0.55) return 'growth';
  if (energy < 0.6) return 'competition';
  if (maturity > 0.9) return 'stabilization';
  if (refinement > 0.6 && maturity > 0.7) return 'polishing';
  return 'growth';
}

/**
 * Головний кристал друзи: найстаріше центральне відкладення — core-0, а
 * без bedrock (немає дати стосунків) — найстаріша подія даних.
 */
function chooseMonarchKey(streams: readonly DepositionStream[], daysTogether: number): string | null {
  if (daysTogether > 0) return 'core-0';
  let bestKey: string | null = null;
  let bestAge = -1;
  for (const stream of streams) {
    for (const event of stream.events) {
      if (event.ageDays > bestAge || (event.ageDays === bestAge && (bestKey === null || event.key < bestKey))) {
        bestAge = event.ageDays;
        bestKey = event.key;
      }
    }
  }
  return bestKey;
}

export type CrystalInstruction = GrowthInstruction<
  DepositionStream,
  PlacementField,
  EvolutionPressures,
  CrystalConstraints,
  CrystalState
>;

export const crystalSpecies: Species<
  ArtifactInput,
  DepositionStream,
  PlacementField,
  EvolutionPressures,
  CrystalConstraints,
  CrystalState,
  LifeCycleStage
> = {
  name: 'crystal',
  // Морфологія (§9): що взагалі може рости в кристала.
  morphology: ['colonies', 'druse', 'spires', 'cracks', 'inclusions', 'micro-druse'],

  // Правила реакцій (§11): Expansion → нові колонії/ріст назовні,
  // Memory → внутрішнє світіння, Harmony → рівномірність росту,
  // Stability → товсті основи (формули — species-проєкція Evolution Engine).
  react: (input) => computeEvolutionPressures(input),

  evolve: crystalEvolve,

  constrain: () => CRYSTAL_CONSTRAINTS,

  buildInstructions: (input): CrystalInstruction => {
    const streams = buildDepositionStreams(input);
    const history = makeFieldHistory(input);
    const forces = solveForces(buildEvolutionTimeline(input));
    const reactions = computeEvolutionPressures(input);
    return {
      streams,
      fieldAt: (ageDays) => placementFieldAt(history, ageDays),
      reactions,
      hierarchy: { monarchKey: chooseMonarchKey(streams, input.usage.daysTogether) },
      constraints: CRYSTAL_CONSTRAINTS,
      // Стан виду (§13) з канонічних сил: напруга від дисбалансу історії,
      // чистота від полірування, щільність/тріщинуватість/енергія — від
      // стабільності і живості пари.
      speciesState: {
        stress: Math.max(0, Math.min(1, 1 - forces.balance)),
        purity: reactions.refinement,
        density: Math.max(0, Math.min(1, (reactions.density - 1) / 0.3)),
        fracture: Math.max(0, Math.min(1, 1 - reactions.stability)),
        energy: Math.max(0, Math.min(1, (forces.growth + forces.memory) / 2)),
      },
    };
  },
};
