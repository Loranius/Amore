import type { GrowthVec3 } from '../growth';
import type { TreeGroundContactState } from '../groundContact';
import type { OrganicMeshLod } from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';

export interface TreeTerrainBindingConfig {
  /** Bump whenever terrain sampling, relief or budgets change. */
  rulesVersion: string;
  radialSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
  ringCountByLod: Readonly<Record<OrganicMeshLod, number>>;
  surfaceRadiusRootCoverageRatio: number;
  minimumSurfaceRadiusBaseRatio: number;
  plateauRootCoverageRatio: number;
  reliefAmplitudeBaseRadiusRatio: number;
  /**
   * Наскільки хвиля втягує КРАЙ ґрунту всередину, у частках радіуса.
   *
   * Нуль — ідеальне коло, тобто те, що читалось килимком. Верхня межа
   * лишається `surfaceRadius` за будь-якої глибини.
   */
  rimLobeDepth: number;
  maximumVerticesByLod: Readonly<Record<OrganicMeshLod, number>>;
  maximumTrianglesByLod: Readonly<Record<OrganicMeshLod, number>>;
}

export interface TreeTerrainBindingDescriptor {
  id: 'tree:terrain:binding';
  sourceBindingId: 'tree:terrain:future';
  surfaceId: 'tree:terrain:surface';
  heightfieldId: 'tree:terrain:heightfield';
  groundPlaneId: 'tree:ground:contact-plane';
}

export interface TreeTerrainSurfaceMesh {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface TreeTerrainBindingDiagnostics {
  radialSegments: number;
  ringCount: number;
  vertexCount: number;
  triangleCount: number;
  surfaceRadius: number;
  plateauRadius: number;
  rootCoverageRadius: number;
  minimumY: number;
  maximumY: number;
  maximumHeightDelta: number;
  vertexBudget: number;
  triangleBudget: number;
  vertexBudgetExceeded: boolean;
  triangleBudgetExceeded: boolean;
  groundPlanePreserved: true;
  rootCoveragePreserved: true;
  mergedIntoRootGeometry: true;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
}

export interface TreeTerrainBindingState {
  treeTerrainBindingVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceGroundContactVersion: TreeGroundContactState['treeGroundContactVersion'];
  sourceGroundContactRulesVersion: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  binding: TreeTerrainBindingDescriptor;
  center: GrowthVec3;
  groundLevelY: number;
  surfaceRadius: number;
  plateauRadius: number;
  mesh: TreeTerrainSurfaceMesh;
  diagnostics: TreeTerrainBindingDiagnostics;
}

export interface BuildTreeTerrainBindingInput {
  species: TreeSpeciesBlueprint;
  contact: TreeGroundContactState;
  lod: OrganicMeshLod;
  config: TreeTerrainBindingConfig;
}
