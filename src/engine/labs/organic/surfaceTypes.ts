import type { GrowthVec3 } from '../../growth/types';
import type { OrganicSkeletonState } from './types';

export type OrganicMeshLod = 'high' | 'medium' | 'low';

export interface OrganicSurfaceConfig {
  curveSamplesPerSegment: number;
  minimumRadius: number;
  radialSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
  axialStrideByLod: Readonly<Record<OrganicMeshLod, number>>;
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

export interface OrganicBranchCurve {
  branchId: string;
  generation: number;
  parentNodeId: string | null;
  terminalNodeId: string;
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
    skippedBranchIds: string[];
  };
}

export interface OrganicSweepBranchRange {
  branchId: string;
  firstVertex: number;
  vertexCount: number;
  firstIndex: number;
  indexCount: number;
  ringCount: number;
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
    ringCount: number;
    vertexCount: number;
    triangleCount: number;
  };
}
