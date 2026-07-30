import {
  DEFAULT_TREE_BARK_SURFACE_CONFIG,
  buildTreeBarkSurface,
  type TreeBarkSurfaceState,
} from '@/engine/barkSurface';
import {
  DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
  buildTreeCanopyDepth,
  type TreeCanopyDepthState,
} from '@/engine/canopyDepth';
import {
  DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
  buildTreeCanopyLight,
  type TreeCanopyLightState,
} from '@/engine/canopyLight';
import {
  DEFAULT_TREE_COMPOSITION_CONFIG,
  buildTreeComposition,
  type TreeCompositionState,
} from '@/engine/composition';
import type { ArtifactBlueprint } from '@/engine/evolution';
import {
  DEFAULT_TREE_FOLIAGE_CONFIG,
  buildTreeFoliage,
  type TreeFoliageState,
} from '@/engine/foliage';
import {
  DEFAULT_TREE_GROUND_CONTACT_CONFIG,
  buildTreeGroundContact,
  type TreeGroundContactState,
} from '@/engine/groundContact';
import {
  DEFAULT_TREE_GROUND_DETAIL_CONFIG,
  buildTreeGroundDetail,
  type TreeGroundDetailState,
} from '@/engine/groundDetail';
import {
  DEFAULT_TREE_LEAF_GEOMETRY_CONFIG,
  buildTreeLeafGeometry,
  type TreeLeafGeometryState,
} from '@/engine/leafGeometry';
import {
  buildOrganicCurveFrames,
  buildOrganicSkeleton,
  buildOrganicSweepMesh,
  type OrganicCurveFrameState,
  type OrganicMeshLod,
  type OrganicSkeletonState,
  type OrganicSweepMesh,
} from '@/engine/labs/organic';
import {
  DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
  buildTreeRootArchitecture,
  type TreeRootArchitectureState,
} from '@/engine/rootArchitecture';
import {
  DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  buildTreeRootGeometry,
  type TreeRootGeometryState,
} from '@/engine/rootGeometry';
import {
  buildTreeSpeciesBlueprint,
  treeToOrganicField,
  type TreeOrganicField,
  type TreeSpeciesBlueprint,
} from '@/engine/species/tree';
import {
  DEFAULT_TREE_SOIL_SURFACE_CONFIG,
  buildTreeSoilSurface,
  type TreeSoilSurfaceState,
} from '@/engine/soilSurface';
import {
  DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
  buildTreeTerrainBinding,
  type TreeTerrainBindingState,
} from '@/engine/terrainBinding';
import {
  DEFAULT_TREE_LIFE_CONFIG,
  buildTreeLifeState,
  type TreeLifeState,
} from '@/engine/treeLife';
import {
  DEFAULT_TREE_MATERIAL_CONFIG,
  buildTreeMaterialState,
  type TreeMaterialState,
} from '@/engine/treeMaterial';
import {
  buildTreeSpeciesPreviewArtifact,
  TREE_SPECIES_PREVIEW_AS_OF,
} from './treeSpeciesFixture';

const TREE_FIXTURE_RULES_VERSION = 'tree-species-preview-v1.0.0';

export interface TreeLabPreviewBuild {
  seed: number;
  lod: OrganicMeshLod;
  artifact: ArtifactBlueprint;
  species: TreeSpeciesBlueprint;
  field: TreeOrganicField;
  skeleton: OrganicSkeletonState;
  frames: OrganicCurveFrameState;
  composition: TreeCompositionState;
  roots: TreeRootArchitectureState;
  groundContact: TreeGroundContactState;
  terrain: TreeTerrainBindingState;
  rootGeometry: TreeRootGeometryState;
  foliage: TreeFoliageState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  canopyDepth: TreeCanopyDepthState;
  canopyLight: TreeCanopyLightState;
  soilSurface: TreeSoilSurfaceState;
  barkSurface: TreeBarkSurfaceState;
  groundDetails: TreeGroundDetailState;
  life: TreeLifeState;
  mesh: OrganicSweepMesh;
  buildMs: number;
}

export interface BuildTreeLabPreviewFromArtifactInput {
  artifact: ArtifactBlueprint;
  asOf: string;
  lod: OrganicMeshLod;
  rulesVersion: string;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * Pure artifact-to-mesh path. It accepts either the fixed regression fixture or
 * a read-only ArtifactBlueprint assembled from normalized portal events.
 */
export function buildTreeLabPreviewFromArtifact({
  artifact,
  asOf,
  lod,
  rulesVersion,
}: BuildTreeLabPreviewFromArtifactInput): TreeLabPreviewBuild {
  const startedAt = now();
  const species = buildTreeSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion },
  });
  const field = treeToOrganicField(species);
  const skeleton = buildOrganicSkeleton({
    seed: field.seed,
    attractors: field.attractors,
    config: field.skeletonConfig,
  });
  const frames = buildOrganicCurveFrames(skeleton);
  const composition = buildTreeComposition({
    species,
    skeleton,
    frames,
    config: DEFAULT_TREE_COMPOSITION_CONFIG,
  });
  const roots = buildTreeRootArchitecture({
    species,
    composition,
    frames,
    config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
  });
  const groundContact = buildTreeGroundContact({
    species,
    roots,
    config: DEFAULT_TREE_GROUND_CONTACT_CONFIG,
  });
  const terrain = buildTreeTerrainBinding({
    species,
    contact: groundContact,
    lod,
    config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
  });
  const rootGeometry = buildTreeRootGeometry({
    roots,
    contact: groundContact,
    terrain,
    lod,
    config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  });
  const foliage = buildTreeFoliage({
    species,
    frames,
    composition,
    config: DEFAULT_TREE_FOLIAGE_CONFIG,
  });
  const leaves = buildTreeLeafGeometry({
    foliage,
    lod,
    config: DEFAULT_TREE_LEAF_GEOMETRY_CONFIG,
  });
  const materials = buildTreeMaterialState({
    species,
    composition,
    foliage,
    leaves,
    config: DEFAULT_TREE_MATERIAL_CONFIG,
  });
  const canopyDepth = buildTreeCanopyDepth({
    composition,
    foliage,
    leaves,
    materials,
    config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
  });
  const canopyLight = buildTreeCanopyLight({
    composition,
    leaves,
    canopy: canopyDepth,
    materials,
    config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
  });
  const soilSurface = buildTreeSoilSurface({
    species,
    terrain,
    rootGeometry,
    materials,
    config: DEFAULT_TREE_SOIL_SURFACE_CONFIG,
  });
  const mesh = buildOrganicSweepMesh(frames, lod);
  const barkSurface = buildTreeBarkSurface({
    species,
    frames,
    mesh,
    rootGeometry,
    soil: soilSurface,
    materials,
    config: DEFAULT_TREE_BARK_SURFACE_CONFIG,
  });
  const groundDetails = buildTreeGroundDetail({
    species,
    terrain,
    soil: soilSurface,
    config: DEFAULT_TREE_GROUND_DETAIL_CONFIG,
  });
  const life = buildTreeLifeState({
    species,
    composition,
    leaves,
    materials,
    config: DEFAULT_TREE_LIFE_CONFIG,
  });

  return {
    seed: field.seed,
    lod,
    artifact,
    species,
    field,
    skeleton,
    frames,
    composition,
    roots,
    groundContact,
    terrain,
    rootGeometry,
    foliage,
    leaves,
    materials,
    canopyDepth,
    canopyLight,
    soilSurface,
    barkSurface,
    groundDetails,
    life,
    mesh,
    buildMs: now() - startedAt,
  };
}

/** Fixed fixture retained as the deterministic regression baseline. */
export function buildTreeLabPreview(lod: OrganicMeshLod): TreeLabPreviewBuild {
  return buildTreeLabPreviewFromArtifact({
    artifact: buildTreeSpeciesPreviewArtifact(),
    asOf: TREE_SPECIES_PREVIEW_AS_OF,
    lod,
    rulesVersion: TREE_FIXTURE_RULES_VERSION,
  });
}
