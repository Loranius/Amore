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
}

const CRYSTAL_CONSTRAINTS: CrystalConstraints = {
  // Нуклеація вздовж більшої частини тіла (не лише біля основи) — дочірні
  // кристали чіпляються на різній висоті й розходяться віялом, а не
  // збиваються в одну колону.
  siteTMin: 0.04,
  siteTMax: 0.5,
  // Менше поховання — тіла НЕ тонуть одне в одному в суцільний ком; видно
  // окремі шпилі з проміжками (референс — кристали, а не оплавлена брила).
  burial: 0.4,
  // Кристал не росте вниз, але друза — це ВІЯЛО спрямованих шпилів під
  // різними кутами, а не пучок вертикалей: мінімальна вертикаль низька,
  // діагоналі часті. Саме це дає органічний «сплеск», а не моноліт.
  minUpwardMain: 0.42,
  minUpwardRare: 0.2,
  diagonalChance: 0.28,
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
  // Головний кристал — виразно найбільший, АЛЕ один шпиль серед друзи, а не
  // моноліт: помірна довжина (≈1.6 у зрілої пари), струнка призма (не колона).
  monarch: { baseLength: 0.95, lengthGain: 0.75, growthDays: 1200, radiusBoost: 1.05, heightCeiling: 0.82 },
  // М'який профіль кургану: бічні шпилі лишаються ВИСОКИМИ (друза-віяло, не
  // конус, що прибиває все навколо центру до землі).
  moundFalloff: (horiz) => 0.62 + 0.38 / (1 + horiz * 1.4),
  heightDamp: (anchorY) => 1 / (1 + 0.5 * Math.max(0, anchorY + 0.1)),
  // Стрункіші тіла — шпилі, не самоцвіти-галька.
  slenderness: 8,
  monarchSlenderness: 6.5,
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
