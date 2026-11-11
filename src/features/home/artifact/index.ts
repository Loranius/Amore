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
  DominantSystem,
  EvolutionPressures,
  GrowthDomainId,
  NodeKind,
} from './artifactTypes';

// Attachment Junction (Volume IV, `CAI-REQ-004`).
export type { JunctionBody } from './composition/attachment';
export { buildJunctions, findOrphans, ATTACHMENT_JUNCTION_VERSION } from './composition/attachment';

// Evolution Engine (Volume I) — універсальна історія і канонічні сили.
export { buildEvolutionTimeline, historyAt, solveForces } from './evolution';

// Species Layer (Volume II) — SDK виду: перекладач історії у Growth Instructions.
export { crystalSpecies } from './species';

export { generateArtifactDNA } from './artifactDNA';

export { computeEvolutionPressures } from './evolutionPressure';
export { isArtifactEmpty, bucketByFixedSize } from './growthEvents';
export { MATURITY_HEIGHT_SCALE, MATURITY_RADIUS_SCALE, distanceToSurface } from './growthSurface';

// Growth Engine (Volume III) — ЯК росте: Growth Instructions → Growth State.
export { runGrowth, depositMineralMass, depositMineralMassWithScore } from './growth';

/** Історичний псевдонім публічного API: рендерери викликали buildArtifactNodes —
 *  тепер це той самий вихід Growth Engine (growth/growthEngine.ts). */
export { depositMineralMass as buildArtifactNodes } from './growth';
