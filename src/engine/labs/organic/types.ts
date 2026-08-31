import type { GrowthVec3 } from '../../growth/types';

export interface OrganicAttractor {
  id: string;
  sequence: number;
  position: GrowthVec3;
  weight: number;
}

export interface OrganicAttractorFieldConfig {
  seed: number;
  count: number;
  center: GrowthVec3;
  horizontalRadius: number;
  verticalRadius: number;
  startSequence?: number;
}

export interface OrganicSkeletonConfig {
  /** Bump whenever deterministic growth formulas change. */
  rulesVersion: string;
  trunkHeight: number;
  trunkStep: number;
  branchStep: number;
  influenceRadius: number;
  killRadius: number;
  maxBranchSegments: number;
  maxGeneration: number;
  maxNodes: number;
  crownRadius: number;
  crownHeight: number;
  upwardBias: number;
  directionMemory: number;
  lateralJitter: number;
  baseRadius: number;
  radiusDecay: number;
}

export interface OrganicSkeletonNode {
  id: string;
  branchId: string;
  parentId: string | null;
  attractorId: string | null;
  sequence: number;
  generation: number;
  position: GrowthVec3;
  direction: GrowthVec3;
  radius: number;
  terminal: boolean;
}

export interface OrganicSkeletonDiagnostics {
  consumedAttractorIds: string[];
  unresolvedAttractorIds: string[];
  truncatedAttractorIds: string[];
  fallbackHostAttractorIds: string[];
  maxGeneration: number;
  /**
   * Скільки вузлів відмерло від нестачі світла. Нуль у просторової колонізації
   * — вона нічого не скидала; у самоорганізаційній моделі це число й показує,
   * наскільки крона піднялась над власним низом.
   */
  shedNodeCount?: number;
}

export interface OrganicSkeletonState {
  organicSkeletonVersion: 1;
  rulesVersion: string;
  seed: number;
  nodes: OrganicSkeletonNode[];
  diagnostics: OrganicSkeletonDiagnostics;
}

export interface BuildOrganicSkeletonInput {
  seed: number;
  attractors: readonly OrganicAttractor[];
  config: OrganicSkeletonConfig;
}
