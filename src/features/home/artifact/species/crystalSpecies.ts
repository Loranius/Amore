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
// Обмеження виду живуть окремо (crystalConstraints.ts) і є ФУНКЦІЄЮ
// історії пари, а не таблицею сталих: `constraintsAt(ageDays)` дзеркалить
// `fieldAt(ageDays)`, тож і «де тіло сідає», і «за яким законом воно
// росте» заморожуються на дату події (append-only).
// ============================================================
import type { ArtifactInput, EvolutionPressures, LifeCycleStage } from '../artifactTypes';
import type { DepositionStream } from '../growthEvents';
import { buildDepositionStreams } from '../growthEvents';
import { makeFieldHistory, placementFieldAt, type PlacementField } from '../growthField';
import { computeEvolutionPressures } from '../evolutionPressure';
import { buildEvolutionTimeline, solveForces } from '../evolution';
import { CRYSTAL_BASELINE, crystalConstraintsAt, type CrystalConstraints } from './crystalConstraints';
import type { GrowthInstruction, Species } from './speciesTypes';

export type { CrystalConstraints } from './crystalConstraints';

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

  // Базова лінія виду: правила, істинні для КОЖНОЇ пари ще до першого
  // прожитого факту. Форму конкретної друзи задає `constraintsAt` в
  // інструкціях — вона зсуває цю лінію історією.
  constrain: () => CRYSTAL_BASELINE,

  buildInstructions: (input): CrystalInstruction => {
    const streams = buildDepositionStreams(input);
    const history = makeFieldHistory(input);
    const timeline = buildEvolutionTimeline(input);
    const forces = solveForces(timeline);
    const reactions = computeEvolutionPressures(input);
    return {
      streams,
      fieldAt: (ageDays) => placementFieldAt(history, ageDays),
      reactions,
      hierarchy: { monarchKey: chooseMonarchKey(streams, input.usage.daysTogether) },
      constraintsAt: (ageDays) => crystalConstraintsAt(timeline, ageDays),
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
