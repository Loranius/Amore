import type { OrganicMeshLod } from '../labs/organic';

export type TreeProductionPhaseId =
  | 'tree-species'
  | 'organic-skeleton'
  | 'curve-frames'
  | 'tree-composition'
  | 'root-architecture'
  | 'ground-contact'
  | 'terrain-binding'
  | 'root-geometry'
  | 'foliage-architecture'
  | 'leaf-geometry'
  | 'tree-material'
  | 'canopy-depth'
  | 'canopy-light'
  | 'phenology'
  | 'leaf-orientation'
  | 'crown-silhouette'
  | 'soil-surface'
  | 'bark-surface'
  | 'ground-detail'
  | 'tree-life';

export type TreeProductionAsOfPolicy = 'fixed-fixture' | 'couple-day';
export type TreeProductionAcceptanceStatus = 'warming' | 'pass' | 'fail';

export interface TreeProductionPhaseCheckpointInput {
  id: TreeProductionPhaseId;
  rulesVersion: string;
  fingerprint: string;
}

export interface TreeProductionPhaseCheckpoint extends TreeProductionPhaseCheckpointInput {
  sequence: number;
  status: 'pass' | 'fail';
}

export interface TreeProductionLeafIdentityInput {
  sourceLeafIds: readonly string[];
  canopyDepthLeafIds: readonly string[];
  canopyLightLeafIds: readonly string[];
  phenologyLeafIds: readonly string[];
  leafOrientationLeafIds: readonly string[];
  crownSilhouetteLeafIds: readonly string[];
  lifeLeafIds: readonly string[];
}

export interface TreeProductionPreservationInput {
  negativeSpaceAccepted: boolean;
  groundAnchored: boolean;
  terrainMergedIntoStaticGeometry: boolean;
  soilTerrainTintPreserved: boolean;
  barkGeometryPreserved: boolean;
  groundDetailsAnchored: boolean;
  groundDetailPrefixPreserved: boolean;
}

export interface TreeProductionStaticBudgetInput {
  vertices: number;
  triangles: number;
  estimatedDrawCalls: number;
  materials: number;
  leafInstances: number;
  estimatedMatrixUpdatesPerFrame: number;
}

export interface TreeProductionMobileBudget {
  maxVertices: number;
  maxTriangles: number;
  maxBuildMs: number;
  maxDrawCalls: number;
  maxMaterials: number;
}

export interface BuildTreeProductionAcceptanceInput {
  coupleId: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  asOf: string;
  asOfPolicy: TreeProductionAsOfPolicy;
  phases: readonly TreeProductionPhaseCheckpointInput[];
  identities: TreeProductionLeafIdentityInput;
  preservation: TreeProductionPreservationInput;
  budgets: TreeProductionStaticBudgetInput;
  budget?: TreeProductionMobileBudget;
}

export interface TreeProductionAcceptanceState {
  treeProductionAcceptanceVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'tree:production-acceptance:contract';
    pipelineId: 'tree:production-pipeline:v1';
    runtimeId: 'tree:production-runtime:mobile';
    identityId: 'tree:production-identity:leaf-chain';
  };
  coupleId: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  asOf: string;
  asOfPolicy: TreeProductionAsOfPolicy;
  signature: string;
  phaseCheckpoints: TreeProductionPhaseCheckpoint[];
  identitySignature: string;
  staticStatus: 'pass' | 'fail';
  violations: string[];
  diagnostics: {
    expectedPhaseCount: number;
    emittedPhaseCount: number;
    phaseOrderPreserved: boolean;
    phaseFingerprintsPresent: boolean;
    sourceLeafCount: number;
    leafIdentityChainPreserved: boolean;
    lifeLeafPrefixPreserved: boolean;
    negativeSpaceAccepted: boolean;
    groundAnchored: boolean;
    terrainMergedIntoStaticGeometry: boolean;
    soilTerrainTintPreserved: boolean;
    barkGeometryPreserved: boolean;
    groundDetailsAnchored: boolean;
    groundDetailPrefixPreserved: boolean;
    vertices: number;
    triangles: number;
    estimatedDrawCalls: number;
    materials: number;
    leafInstances: number;
    estimatedMatrixUpdatesPerFrame: number;
    mobileBudget: TreeProductionMobileBudget;
  };
}

export interface EvaluateTreeProductionRuntimeInput {
  contract: TreeProductionAcceptanceState;
  buildMs: number;
  drawCalls: number | null;
}

export interface TreeProductionRuntimeAcceptanceResult {
  status: TreeProductionAcceptanceStatus;
  violations: string[];
}
