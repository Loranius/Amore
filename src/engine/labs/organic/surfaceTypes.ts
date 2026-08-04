import type { GrowthVec3 } from '../../growth/types';
import type { OrganicSkeletonState } from './types';

export type OrganicMeshLod = 'high' | 'medium' | 'low';

/** Shape of the wood itself — see `barkRelief.ts` for why it is geometry. */
export interface BarkReliefConfig {
  /** Primary lobes around the circumference. Bounded by the ring's vertices. */
  lobeCount: number;
  /** Finer overtone, so the cross-section is not a regular polygon. */
  overtoneCount: number;
  /** Swellings along the branch, in radians per engine unit of arc length. */
  swellFrequency: number;
  /** How far the lobes spiral, in radians per engine unit of arc length. */
  twist: number;
  /** Relief amplitude as a fraction of the local radius. */
  depth: number;
  /** Radius at which relief reaches full strength; thinner stays smooth. */
  fadeRadius: number;
}

export interface OrganicSurfaceConfig {
  curveSamplesPerSegment: number;
  minimumRadius: number;
  junctionInsetRatio: number;
  junctionSurfaceRatio: number;
  junctionFlare: number;
  junctionSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
  radialSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
  axialStrideByLod: Readonly<Record<OrganicMeshLod, number>>;
  bark: BarkReliefConfig;
}

export interface OrganicCurveFrameSample {
  id: string;
  sourceNodeId: string;
  branchId: string;
  generation: number;
  normalizedDistance: number;
  position: GrowthVec3;
  tangent: GrowthVec3;
  normal: GrowthVec3;
  binormal: GrowthVec3;
  radius: number;
}

export interface OrganicJunctionAnchor {
  childBranchId: string;
  parentBranchId: string;
  parentNodeId: string;
  parentPosition: GrowthVec3;
  parentRadius: number;
  parentTangent: GrowthVec3;
  radialDirection: GrowthVec3;
  surfacePosition: GrowthVec3;
  insetPosition: GrowthVec3;
  childDirection: GrowthVec3;
  collarRadius: number;
  joinSampleIndex: number;
}

export interface OrganicBranchCurve {
  branchId: string;
  generation: number;
  parentNodeId: string | null;
  terminalNodeId: string;
  junction: OrganicJunctionAnchor | null;
  samples: OrganicCurveFrameSample[];
}

export interface OrganicCurveFrameState {
  organicCurveFrameVersion: 1;
  sourceSkeletonVersion: OrganicSkeletonState['organicSkeletonVersion'];
  sourceRulesVersion: string;
  curves: OrganicBranchCurve[];
  diagnostics: {
    branchCount: number;
    sampleCount: number;
    junctionCount: number;
    skippedBranchIds: string[];
    unresolvedJunctionBranchIds: string[];
  };
}

export interface OrganicSweepBranchRange {
  branchId: string;
  firstVertex: number;
  vertexCount: number;
  firstIndex: number;
  indexCount: number;
  ringCount: number;
  junctionRingCount: number;
  radialSegments: number;
}

export interface OrganicSweepMesh {
  organicSweepMeshVersion: 1;
  lod: OrganicMeshLod;
  sourceRulesVersion: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  branches: OrganicSweepBranchRange[];
  diagnostics: {
    branchCount: number;
    junctionCount: number;
    ringCount: number;
    junctionRingCount: number;
    vertexCount: number;
    triangleCount: number;
  };
}
