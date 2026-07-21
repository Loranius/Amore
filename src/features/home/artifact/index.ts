// ============================================================
// artifact/index — публічний контракт Artifact Engine. crystal3d/ (і будь-
// який майбутній рендерер) імпортує ВИКЛЮЧНО звідси, ніколи напряму з
// artifactNodes.ts/evolutionPressure.ts/тощо — це і є межа, що робить
// «renderer-agnostic» дотримуваним, а не лише задекларованим.
// ============================================================
export type {
  ArtifactDNA,
  ArtifactNode,
  ArtifactInput,
  DatedItem,
  DominantSystem,
  EvolutionPressures,
  GrowthDomainId,
  NodeKind,
} from './artifactTypes';

export { generateArtifactDNA } from './artifactDNA';
export { maturityCurve } from './maturity';
export { computeEvolutionPressures } from './evolutionPressure';
export { buildArtifactNodes, isArtifactEmpty, bucketByFixedSize } from './artifactNodes';
