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
import {
  DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
  buildTreeCrownSilhouette,
  type TreeCrownSilhouetteState,
} from '@/engine/crownSilhouette';
import { stableHash32, type ArtifactBlueprint } from '@/engine/evolution';
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
  DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
  buildTreeLeafOrientation,
  type TreeLeafOrientationState,
} from '@/engine/leafOrientation';
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
  DEFAULT_TREE_PHENOLOGY_CONFIG,
  buildTreePhenology,
  type TreePhenologyState,
} from '@/engine/phenology';
import {
  buildTreeProductionAcceptance,
  type TreeProductionAcceptanceState,
  type TreeProductionAsOfPolicy,
  type TreeProductionPhaseCheckpointInput,
  type TreeProductionPhaseId,
} from '@/engine/productionAcceptance';
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
  phenology: TreePhenologyState;
  leafOrientation: TreeLeafOrientationState;
  crownSilhouette: TreeCrownSilhouetteState;
  soilSurface: TreeSoilSurfaceState;
  barkSurface: TreeBarkSurfaceState;
  groundDetails: TreeGroundDetailState;
  life: TreeLifeState;
  productionAcceptance: TreeProductionAcceptanceState;
  mesh: OrganicSweepMesh;
  buildMs: number;
}

export interface BuildTreeLabPreviewFromArtifactInput {
  artifact: ArtifactBlueprint;
  asOf: string;
  lod: OrganicMeshLod;
  rulesVersion: string;
  asOfPolicy?: TreeProductionAsOfPolicy;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function scalarFingerprint(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  const directSignature = record['signature'];
  if (typeof directSignature === 'string' && directSignature.trim()) {
    return directSignature.trim();
  }

  const tokens: string[] = [];
  const visit = (prefix: string, source: Record<string, unknown>) => {
    for (const [key, entry] of Object.entries(source).sort(([left], [right]) => left.localeCompare(right))) {
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
        tokens.push(`${prefix}${key}:${String(entry)}`);
      } else if (Array.isArray(entry)) {
        tokens.push(`${prefix}${key}.length:${entry.length}`);
      }
    }
  };
  visit('', record);
  for (const nestedKey of ['descriptor', 'diagnostics', 'state', 'binding']) {
    const nested = record[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      visit(`${nestedKey}.`, nested as Record<string, unknown>);
    }
  }
  return stableHash32(tokens.join('\u001f')).toString(16).padStart(8, '0');
}

function rulesVersion(value: unknown, fallback: string): string {
  if (value && typeof value === 'object') {
    const candidate = (value as Record<string, unknown>)['rulesVersion'];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function checkpoint(
  id: TreeProductionPhaseId,
  value: unknown,
  fallbackRulesVersion: string,
): TreeProductionPhaseCheckpointInput {
  return {
    id,
    rulesVersion: rulesVersion(value, fallbackRulesVersion),
    fingerprint: scalarFingerprint(value),
  };
}

export function buildTreeLabPreviewFromArtifact({
  artifact,
  asOf,
  lod,
  rulesVersion: speciesRulesVersion,
  asOfPolicy = 'fixed-fixture',
}: BuildTreeLabPreviewFromArtifactInput): TreeLabPreviewBuild {
  const startedAt = now();
  const species = buildTreeSpeciesBlueprint({ artifact, config: { asOf, rulesVersion: speciesRulesVersion } });
  const field = treeToOrganicField(species);
  const skeleton = buildOrganicSkeleton({ seed: field.seed, attractors: field.attractors, config: field.skeletonConfig });
  const frames = buildOrganicCurveFrames(skeleton);
  const composition = buildTreeComposition({ species, skeleton, frames, config: DEFAULT_TREE_COMPOSITION_CONFIG });
  const roots = buildTreeRootArchitecture({ species, composition, frames, config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG });
  const groundContact = buildTreeGroundContact({ species, roots, config: DEFAULT_TREE_GROUND_CONTACT_CONFIG });
  const terrain = buildTreeTerrainBinding({ species, contact: groundContact, lod, config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG });
  const rootGeometry = buildTreeRootGeometry({ roots, contact: groundContact, terrain, lod, config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG });
  const foliage = buildTreeFoliage({ species, frames, composition, config: DEFAULT_TREE_FOLIAGE_CONFIG });
  const leaves = buildTreeLeafGeometry({ foliage, lod, config: DEFAULT_TREE_LEAF_GEOMETRY_CONFIG });
  const materials = buildTreeMaterialState({ species, composition, foliage, leaves, config: DEFAULT_TREE_MATERIAL_CONFIG });
  const canopyDepth = buildTreeCanopyDepth({ composition, foliage, leaves, materials, config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG });
  const canopyLight = buildTreeCanopyLight({ composition, leaves, canopy: canopyDepth, materials, config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG });
  const phenology = buildTreePhenology({
    species,
    leaves,
    canopyLight,
    materials,
    asOf,
    config: DEFAULT_TREE_PHENOLOGY_CONFIG,
  });
  const leafOrientation = buildTreeLeafOrientation({
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    config: DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
  });
  const crownSilhouette = buildTreeCrownSilhouette({
    composition,
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    leafOrientation,
    config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
  });
  const soilSurface = buildTreeSoilSurface({ species, terrain, rootGeometry, materials, config: DEFAULT_TREE_SOIL_SURFACE_CONFIG });
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
  const groundDetails = buildTreeGroundDetail({ species, terrain, soil: soilSurface, config: DEFAULT_TREE_GROUND_DETAIL_CONFIG });
  const life = buildTreeLifeState({ species, composition, leaves, materials, config: DEFAULT_TREE_LIFE_CONFIG });

  const totalVertices = mesh.diagnostics.vertexCount
    + rootGeometry.diagnostics.vertexCount
    + leaves.diagnostics.sharedVertexCount
    + groundDetails.diagnostics.sharedVertexCount;
  const totalTriangles = mesh.diagnostics.triangleCount
    + rootGeometry.diagnostics.triangleCount
    + leaves.diagnostics.renderedTriangleCount
    + groundDetails.diagnostics.renderedTriangleCount;
  const estimatedDrawCalls = 1
    + rootGeometry.diagnostics.estimatedDrawCalls
    + leaves.diagnostics.estimatedDrawCalls
    + groundDetails.diagnostics.estimatedDrawCalls;
  const totalMaterials = materials.diagnostics.uniqueMaterialCount
    + groundDetails.diagnostics.estimatedAdditionalMaterials;

  const productionAcceptance = buildTreeProductionAcceptance({
    coupleId: artifact.coupleId,
    artifactSeed: species.artifactSeed,
    lod,
    asOf,
    asOfPolicy,
    phases: [
      checkpoint('tree-species', species, speciesRulesVersion),
      checkpoint('organic-skeleton', skeleton, field.skeletonConfig.rulesVersion),
      checkpoint('curve-frames', frames, 'organic-curve-frames-v1.0.0'),
      checkpoint('tree-composition', composition, DEFAULT_TREE_COMPOSITION_CONFIG.rulesVersion),
      checkpoint('root-architecture', roots, DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG.rulesVersion),
      checkpoint('ground-contact', groundContact, DEFAULT_TREE_GROUND_CONTACT_CONFIG.rulesVersion),
      checkpoint('terrain-binding', terrain, DEFAULT_TREE_TERRAIN_BINDING_CONFIG.rulesVersion),
      checkpoint('root-geometry', rootGeometry, DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.rulesVersion),
      checkpoint('foliage-architecture', foliage, DEFAULT_TREE_FOLIAGE_CONFIG.rulesVersion),
      checkpoint('leaf-geometry', leaves, DEFAULT_TREE_LEAF_GEOMETRY_CONFIG.rulesVersion),
      checkpoint('tree-material', materials, DEFAULT_TREE_MATERIAL_CONFIG.rulesVersion),
      checkpoint('canopy-depth', canopyDepth, DEFAULT_TREE_CANOPY_DEPTH_CONFIG.rulesVersion),
      checkpoint('canopy-light', canopyLight, DEFAULT_TREE_CANOPY_LIGHT_CONFIG.rulesVersion),
      checkpoint('phenology', phenology, DEFAULT_TREE_PHENOLOGY_CONFIG.rulesVersion),
      checkpoint('leaf-orientation', leafOrientation, DEFAULT_TREE_LEAF_ORIENTATION_CONFIG.rulesVersion),
      checkpoint('crown-silhouette', crownSilhouette, DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.rulesVersion),
      checkpoint('soil-surface', soilSurface, DEFAULT_TREE_SOIL_SURFACE_CONFIG.rulesVersion),
      checkpoint('bark-surface', barkSurface, DEFAULT_TREE_BARK_SURFACE_CONFIG.rulesVersion),
      checkpoint('ground-detail', groundDetails, DEFAULT_TREE_GROUND_DETAIL_CONFIG.rulesVersion),
      checkpoint('tree-life', life, DEFAULT_TREE_LIFE_CONFIG.rulesVersion),
    ],
    identities: {
      sourceLeafIds: leaves.instances.map((leaf) => leaf.id),
      canopyDepthLeafIds: canopyDepth.profiles.map((profile) => profile.leafInstanceId),
      canopyLightLeafIds: canopyLight.profiles.map((profile) => profile.leafInstanceId),
      phenologyLeafIds: phenology.profiles.map((profile) => profile.leafInstanceId),
      leafOrientationLeafIds: leafOrientation.profiles.map((profile) => profile.leafInstanceId),
      crownSilhouetteLeafIds: crownSilhouette.profiles.map((profile) => profile.leafInstanceId),
      lifeLeafIds: life.leaves.map((profile) => profile.leafInstanceId),
    },
    preservation: {
      negativeSpaceAccepted: crownSilhouette.diagnostics.negativeSpaceAccepted,
      groundAnchored: rootGeometry.diagnostics.anchoredToGround,
      terrainMergedIntoStaticGeometry: rootGeometry.diagnostics.terrainMergedIntoStaticMesh,
      soilTerrainTintPreserved: barkSurface.diagnostics.soilTerrainTintPreserved,
      barkGeometryPreserved: barkSurface.diagnostics.geometryPreserved
        && barkSurface.diagnostics.branchRangesPreserved,
      groundDetailsAnchored: groundDetails.diagnostics.anchoredToTerrain,
      groundDetailPrefixPreserved: groundDetails.diagnostics.stablePrefixPreserved,
    },
    budgets: {
      vertices: totalVertices,
      triangles: totalTriangles,
      estimatedDrawCalls,
      materials: totalMaterials,
      leafInstances: leaves.instances.length,
      estimatedMatrixUpdatesPerFrame: life.diagnostics.estimatedMatrixUpdatesPerFrame,
    },
  });
  const buildMs = now() - startedAt;

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
    phenology,
    leafOrientation,
    crownSilhouette,
    soilSurface,
    barkSurface,
    groundDetails,
    life,
    productionAcceptance,
    mesh,
    buildMs,
  };
}

export function buildTreeLabPreview(lod: OrganicMeshLod): TreeLabPreviewBuild {
  return buildTreeLabPreviewFromArtifact({
    artifact: buildTreeSpeciesPreviewArtifact(),
    asOf: TREE_SPECIES_PREVIEW_AS_OF,
    lod,
    rulesVersion: TREE_FIXTURE_RULES_VERSION,
    asOfPolicy: 'fixed-fixture',
  });
}
