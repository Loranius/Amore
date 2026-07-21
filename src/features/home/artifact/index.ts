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

export { generateArtifactDNA } from './artifactDNA';
export { maturityCurve } from './maturity';
export { computeEvolutionPressures } from './evolutionPressure';
export { isArtifactEmpty, bucketByFixedSize } from './growthEvents';
export { depositMineralMass, depositMineralMassWithScore } from './mineralDeposition';
export { MATURITY_HEIGHT_SCALE, MATURITY_RADIUS_SCALE, distanceToSurface } from './growthSurface';

/** Історичний псевдонім публічного API: рендерери викликали buildArtifactNodes —
 *  тепер це те саме відкладення мінеральної маси (mineralDeposition.ts). */
export { depositMineralMass as buildArtifactNodes } from './mineralDeposition';
