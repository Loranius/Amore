import type { OrganicSkeletonConfig } from './types';

export const DEFAULT_ORGANIC_SKELETON_CONFIG: OrganicSkeletonConfig = {
  rulesVersion: 'tree-lab-v0.1.0',
  trunkHeight: 2.8,
  trunkStep: 0.35,
  branchStep: 0.24,
  influenceRadius: 2.1,
  killRadius: 0.16,
  maxBranchSegments: 10,
  maxGeneration: 3,
  maxNodes: 180,
  crownRadius: 2.2,
  crownHeight: 2.5,
  upwardBias: 0.18,
  directionMemory: 0.34,
  lateralJitter: 0.11,
  baseRadius: 0.28,
  radiusDecay: 0.72,
};
