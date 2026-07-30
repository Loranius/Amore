import type { ReefSpeciesBlueprint, ReefColonyMorphotype, ReefColonyRole, ReefColonyTier } from '../types';
import type { ReefColonyLayoutState, ReefLayoutVec3 } from '../layout';
import type { ReefFoundationMeshState } from '../foundation';

export type ReefSkeletonNodeKind =
  | 'root'
  | 'axis'
  | 'junction'
  | 'tip'
  | 'rim'
  | 'lobe'
  | 'control';

export type ReefSkeletonSegmentKind =
  | 'trunk'
  | 'branch'
  | 'rib'
  | 'stalk'
  | 'lobe'
  | 'boundary';

export type ReefSkeletonSurfaceKind =
  | 'massive-envelope'
  | 'plate-disc'
  | 'encrusting-patch'
  | 'soft-lobe-envelope'
  | 'fan-membrane';

export interface ReefColonySkeletonConfig {
  /** Bump whenever morphotype grammar, quantization or logical budgets change. */
  rulesVersion: string;
  angularQuantization: number;
  maximumNodes: number;
  maximumSegments: number;
  maximumSurfaces: number;
}

/** Stable local coordinate frame rooted at a Phase 3 foundation attachment. */
export interface ReefSkeletonBasis {
  origin: ReefLayoutVec3;
  up: ReefLayoutVec3;
  right: ReefLayoutVec3;
  forward: ReefLayoutVec3;
  facingRad: number;
}

export interface ReefSkeletonNode {
  id: string;
  sequence: number;
  kind: ReefSkeletonNodeKind;
  parentNodeId: string | null;
  /** Local position in the colony basis: x=right, y=up, z=forward. */
  localPosition: ReefLayoutVec3;
  radius: number;
  influence: number;
}

export interface ReefSkeletonSegment {
  id: string;
  sequence: number;
  kind: ReefSkeletonSegmentKind;
  fromNodeId: string;
  toNodeId: string;
  radiusStart: number;
  radiusEnd: number;
}

export interface ReefSkeletonSurface {
  id: string;
  sequence: number;
  kind: ReefSkeletonSurfaceKind;
  nodeIds: string[];
  thickness: number;
  span: number;
}

export interface ReefColonySkeleton {
  id: string;
  colonyId: string;
  attachmentId: string;
  sequence: number;
  seed: number;
  morphotype: ReefColonyMorphotype;
  role: ReefColonyRole;
  tier: ReefColonyTier;
  emphasized: boolean;
  maturity: number;
  footprintRadius: number;
  targetHeight: number;
  basis: ReefSkeletonBasis;
  nodes: ReefSkeletonNode[];
  segments: ReefSkeletonSegment[];
  surfaces: ReefSkeletonSurface[];
}

export interface ReefColonySkeletonDiagnostics {
  sourceColonyCount: number;
  skeletonCount: number;
  nodeCount: number;
  segmentCount: number;
  surfaceCount: number;
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
  colonyIdsWithoutAttachment: string[];
  attachmentIdsWithoutColony: string[];
  colonyIdsWithoutSkeleton: string[];
  invalidSegmentIds: string[];
  invalidSurfaceIds: string[];
  maximumNodes: number;
  maximumSegments: number;
  maximumSurfaces: number;
  logicalBudgetExceeded: boolean;
  rendererVertices: 0;
  rendererTriangles: 0;
  rendererInstances: 0;
  estimatedDrawCalls: 0;
  materialSlots: 0;
  perFrameUpdates: 0;
}

export interface ReefColonySkeletonState {
  reefColonySkeletonVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:colony-skeletons';
    skeletonId: 'reef:colony-skeleton';
    nodeId: 'reef:skeleton-node';
    segmentId: 'reef:skeleton-segment';
    surfaceId: 'reef:skeleton-surface';
  };
  sourceSpeciesBlueprintVersion: ReefSpeciesBlueprint['speciesBlueprintVersion'];
  sourceSpeciesRulesVersion: string;
  sourceColonyLayoutVersion: ReefColonyLayoutState['reefColonyLayoutVersion'];
  sourceColonyLayoutRulesVersion: string;
  sourceFoundationMeshVersion: ReefFoundationMeshState['reefFoundationMeshVersion'];
  sourceFoundationRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  skeletons: ReefColonySkeleton[];
  diagnostics: ReefColonySkeletonDiagnostics;
}

export interface BuildReefColonySkeletonsInput {
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  config?: ReefColonySkeletonConfig;
}
