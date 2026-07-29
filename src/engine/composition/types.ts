import type { GrowthState, GrowthTier, GrowthVec3 } from '../growth';

export type CrystalSilhouette = 'cathedral' | 'fan' | 'druse';
export type CrystalCompositionRole = 'focal' | 'support' | 'family' | 'companion' | 'micro';

export interface CrystalCompositionConfig {
  /** Bump whenever scoring or silhouette classification rules change. */
  rulesVersion: string;
  sectorCount: number;
  targetEmptySectorShare: number;
}

export interface CrystalCompositionBody {
  id: string;
  sourceBodyId: string;
  tier: GrowthTier;
  role: CrystalCompositionRole;
  focal: boolean;
  protected: boolean;
  decorative: boolean;
  volume: number;
  height: number;
  radialDistance: number;
  sectorIndex: number;
  anchor: GrowthVec3;
  direction: GrowthVec3;
}

export interface CrystalCompositionScore {
  hierarchy: number;
  flow: number;
  silhouette: number;
  density: number;
  balance: number;
  rhythm: number;
  negativeSpace: number;
  realism: number;
  total: number;
}

export interface CrystalCompositionDiagnostics {
  orphanBodyIds: string[];
  duplicateFocalBodyIds: string[];
  emptySectorIndices: number[];
  crowdedSectorIndices: number[];
}

export interface CrystalCompositionState {
  compositionStateVersion: 1;
  rulesVersion: string;
  sourceGrowthStateVersion: GrowthState['growthStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  silhouette: CrystalSilhouette;
  axis: GrowthVec3;
  bodies: CrystalCompositionBody[];
  score: CrystalCompositionScore;
  diagnostics: CrystalCompositionDiagnostics;
}

export interface BuildCrystalCompositionInput {
  growth: GrowthState;
  config: CrystalCompositionConfig;
}
