import type { CrystalCompositionState } from '../composition';
import type { CrystalGeometryState } from '../geometry';
import type { CrystalSpeciesBlueprint } from '../species/crystal';

export type CrystalMaterialQuality = 'high' | 'balanced' | 'low' | 'fallback';

export interface CrystalRgb {
  r: number;
  g: number;
  b: number;
}

export interface CrystalMaterialConfig {
  /** Bump whenever optical formulas, shader recipes or quality tiers change. */
  rulesVersion: string;
  quality: CrystalMaterialQuality;
  allowIridescence: boolean;
  allowProceduralReflection: boolean;
}

export interface CrystalShaderRecipe {
  shaderVersion: 1;
  rimStrength: number;
  skyStrength: number;
  skyColor: CrystalRgb;
  groundColor: CrystalRgb;
  rimColor: CrystalRgb;
  inclusionDensity: number;
  inclusionScale: number;
  inclusionContrast: number;
}

export interface CrystalBodyMaterial {
  materialVersion: 1;
  bodyId: string;
  signature: string;
  baseColor: CrystalRgb;
  emissiveColor: CrystalRgb;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  ior: number;
  reflectivity: number;
  emissiveIntensity: number;
  envMapIntensity: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessMin: number;
  iridescenceThicknessMax: number;
  /** Permanently disabled for transparent-canvas safety. */
  transmission: 0;
  opacity: 1;
  transparent: false;
  depthWrite: true;
  shader: CrystalShaderRecipe;
}

export interface CrystalMaterialPalette {
  primary: CrystalRgb;
  secondary: CrystalRgb;
  highlight: CrystalRgb;
  core: CrystalRgb;
}

export interface CrystalMaterialDiagnostics {
  missingCompositionBodyIds: string[];
  missingGeometryBodyIds: string[];
  clampedBodyIds: string[];
  transmissionForcedOff: true;
  uniqueMaterialCount: number;
}

export interface CrystalMaterialState {
  materialStateVersion: 1;
  rulesVersion: string;
  quality: CrystalMaterialQuality;
  sourceSpeciesBlueprintVersion: CrystalSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionStateVersion: CrystalCompositionState['compositionStateVersion'];
  sourceGeometryStateVersion: CrystalGeometryState['geometryStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  palette: CrystalMaterialPalette;
  bodies: CrystalBodyMaterial[];
  diagnostics: CrystalMaterialDiagnostics;
}

export interface BuildCrystalMaterialInput {
  species: CrystalSpeciesBlueprint;
  composition: CrystalCompositionState;
  geometry: CrystalGeometryState;
  config: CrystalMaterialConfig;
}
