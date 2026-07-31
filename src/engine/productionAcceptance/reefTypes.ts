import type {
  ReefColonyLayoutState,
  ReefColonyMeshState,
  ReefColonySkeletonState,
  ReefFoundationMeshState,
  ReefLifeState,
  ReefMaterialState,
  ReefSpeciesBlueprint,
} from '../species/reef';

export type ReefProductionPhaseId =
  | 'reef-species'
  | 'colony-layout'
  | 'foundation-mesh'
  | 'morphotype-skeletons'
  | 'colony-meshes'
  | 'reef-materials'
  | 'reef-life'
  | 'three-renderer';

export type ReefProductionAcceptanceStatus = 'warming' | 'pass' | 'fail';

export interface ReefProductionPhaseCheckpoint {
  id: ReefProductionPhaseId;
  sequence: number;
  rulesVersion: string;
  fingerprint: string;
  status: 'pass' | 'fail';
}

export interface ReefProductionRendererInput {
  batchIds: readonly string[];
  vertices: number;
  triangles: number;
  estimatedDrawCalls: number;
  materials: number;
}

export interface ReefProductionMobileBudget {
  maxVertices: number;
  maxTriangles: number;
  maxBuildMs: number;
  maxDrawCalls: number;
  maxMaterials: number;
}

export interface BuildReefProductionAcceptanceInput {
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  skeletons: ReefColonySkeletonState;
  meshes: ReefColonyMeshState;
  materials: ReefMaterialState;
  life: ReefLifeState;
  renderer: ReefProductionRendererInput;
  budget?: ReefProductionMobileBudget;
}

export interface ReefProductionAcceptanceState {
  reefProductionAcceptanceVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:production-acceptance:contract';
    pipelineId: 'reef:production-pipeline:v1';
    runtimeId: 'reef:production-runtime:mobile';
    identityId: 'reef:production-identity:colony-chain';
  };
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  signature: string;
  identitySignature: string;
  phaseCheckpoints: ReefProductionPhaseCheckpoint[];
  staticStatus: 'pass' | 'fail';
  violations: string[];
  diagnostics: {
    expectedPhaseCount: number;
    emittedPhaseCount: number;
    phaseOrderPreserved: boolean;
    phaseFingerprintsPresent: boolean;
    phaseProvenancePreserved: boolean;
    temporalIdentityPreserved: boolean;
    colonyIdentityChainPreserved: boolean;
    uniqueColonyIdentityPreserved: boolean;
    rangeBindingChainPreserved: boolean;
    foundationClosedShell: boolean;
    foundationAttachmentCoveragePreserved: boolean;
    reducedMotionStatic: boolean;
    rendererBatchingPreserved: boolean;
    layoutColonyCount: number;
    foundationAttachmentCount: number;
    skeletonCount: number;
    meshRangeCount: number;
    materialBindingCount: number;
    motionBindingCount: number;
    vertices: number;
    triangles: number;
    estimatedDrawCalls: number;
    materials: number;
    mobileBudget: ReefProductionMobileBudget;
  };
}

export interface EvaluateReefProductionRuntimeInput {
  contract: ReefProductionAcceptanceState;
  buildMs: number;
  drawCalls: number | null;
  triangles: number | null;
}

export interface ReefProductionRuntimeAcceptanceResult {
  status: ReefProductionAcceptanceStatus;
  violations: string[];
}
