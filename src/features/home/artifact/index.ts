// ============================================================
// artifact/index — публічний контракт Artifact Engine. crystal3d/ (і будь-
// який майбутній рендерер) імпортує ВИКЛЮЧНО звідси, ніколи напряму з
// mineralDeposition.ts/evolutionPressure.ts/тощо — це і є межа, що робить
// «renderer-agnostic» дотримуваним, а не лише задекларованим.
// ============================================================
export type {
  ArtifactDNA,
  ArtifactNode,
  ArtifactInput,
  ColonyRole,
  CompositionTier,
  CrystalArchetype,
  DatedItem,
  DepositedCrystal,
  DepositionEvent,
  DominantSystem,
  EvolutionPressures,
  GrowthDomainId,
  GrowthSite,
  LifeCycleStage,
  NodeKind,
} from './artifactTypes';
export type { Vec3 } from './vec3';
export type { CompositionScore } from './composition/score';
export { composeMineralCluster } from './composition/mineralPreset';

// Evolution Engine (Volume I) — універсальна історія і канонічні сили.
export type {
  EvolutionCategory,
  EvolutionEvent,
  EvolutionForces,
  EvolutionHistoryCounts,
  EvolutionSource,
  EvolutionTimeline,
} from './evolution';
export { buildEvolutionTimeline, historyAt, solveForces } from './evolution';

// Species Layer (Volume II) — SDK виду: перекладач історії у Growth Instructions.
export type { GrowthInstruction, Species, CrystalConstraints, CrystalInstruction, CrystalState } from './species';
export { crystalSpecies } from './species';

export { generateArtifactDNA } from './artifactDNA';
export { maturityCurve } from './maturity';
export { computeEvolutionPressures } from './evolutionPressure';
export { isArtifactEmpty, bucketByFixedSize } from './growthEvents';
export { MATURITY_HEIGHT_SCALE, MATURITY_RADIUS_SCALE, distanceToSurface } from './growthSurface';

// Growth Engine (Volume III) — ЯК росте: Growth Instructions → Growth State.
export type { GrowthState, GrowthBody } from './growth';
export { runGrowth, depositMineralMass, depositMineralMassWithScore } from './growth';

/** Історичний псевдонім публічного API: рендерери викликали buildArtifactNodes —
 *  тепер це той самий вихід Growth Engine (growth/growthEngine.ts). */
export { depositMineralMass as buildArtifactNodes } from './growth';
