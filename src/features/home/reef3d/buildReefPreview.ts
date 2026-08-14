import type { ArtifactBlueprint } from '@/engine/evolution';
import {
  buildReefProductionAcceptance,
  REEF_PRODUCTION_MOBILE_BUDGET,
  type ReefProductionAcceptanceState,
} from '@/engine/productionAcceptance';
import {
  buildReefColonyLayout,
  buildReefColonyMeshes,
  buildReefColonySkeletons,
  buildReefFoundationMesh,
  buildReefLife,
  buildReefMaterials,
  buildReefSpeciesBlueprint,
  type ReefColonyLayoutState,
  type ReefColonyMeshState,
  type ReefColonySkeletonState,
  type ReefFoundationMeshState,
  type ReefLifeState,
  type ReefMaterialState,
  type ReefSpeciesBlueprint,
} from '@/engine/species/reef';

/** Backwards-compatible Phase 8 naming backed by the Phase 9 engine budget. */
export const REEF_PRODUCTION_BUDGET = Object.freeze({
  maximumDrawCalls: REEF_PRODUCTION_MOBILE_BUDGET.maxDrawCalls,
  maximumMaterials: REEF_PRODUCTION_MOBILE_BUDGET.maxMaterials,
  maximumVertices: REEF_PRODUCTION_MOBILE_BUDGET.maxVertices,
  maximumTriangles: REEF_PRODUCTION_MOBILE_BUDGET.maxTriangles,
  maximumBuildMs: REEF_PRODUCTION_MOBILE_BUDGET.maxBuildMs,
});

export interface ReefPreviewDiagnostics {
  vertexCount: number;
  triangleCount: number;
  colonyCount: number;
  batchCount: number;
  materialCount: number;
  expectedDrawCalls: number;
  motionBindingCount: number;
  staticStatus: 'pass' | 'fail';
  violations: string[];
}

export interface ReefPreviewBuild {
  artifact: ArtifactBlueprint;
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  skeletons: ReefColonySkeletonState;
  meshes: ReefColonyMeshState;
  materials: ReefMaterialState;
  life: ReefLifeState;
  acceptance: ReefProductionAcceptanceState;
  buildMs: number;
  diagnostics: ReefPreviewDiagnostics;
}

export interface BuildReefPreviewInput {
  artifact: ArtifactBlueprint;
  asOf: string;
  rulesVersion?: string;
  sharedDaysOff?: readonly string[];
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Runs the accepted Reef Species phases 1–7 without renderer side effects.
 * Phase 9 then consolidates the full Phase 1–8 production contract.
 */
export function buildReefPreviewFromArtifact({
  artifact,
  asOf,
  rulesVersion = 'reef-species-production-v1.1.0',
  sharedDaysOff = [],
}: BuildReefPreviewInput): ReefPreviewBuild {
  const startedAt = nowMs();
  const species = buildReefSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion, sharedDaysOff },
  });
  const layout = buildReefColonyLayout({ species });
  const foundation = buildReefFoundationMesh({ species, layout });
  const skeletons = buildReefColonySkeletons({ species, layout, foundation });
  const meshes = buildReefColonyMeshes({ species, layout, foundation, skeletons });
  const materials = buildReefMaterials({ species, layout, foundation, skeletons, meshes });
  const life = buildReefLife({
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
  });

  const colonyVertexCount = meshes.batches.reduce(
    (total, batch) => total + batch.vertices.length,
    0,
  );
  const colonyTriangleCount = meshes.batches.reduce(
    (total, batch) => total + batch.triangles.length,
    0,
  );
  const activeBatches = meshes.batches.filter((batch) => batch.index.length > 0);
  const vertexCount = foundation.vertices.length + colonyVertexCount;
  const triangleCount = foundation.triangles.length + colonyTriangleCount;
  const materialCount = 1 + materials.colonies.length;
  const expectedDrawCalls = 1 + activeBatches.length;

  const acceptance = buildReefProductionAcceptance({
    coupleId: species.coupleId,
    artifactSeed: species.artifactSeed,
    asOf: species.asOf,
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
    life,
    renderer: {
      batchIds: activeBatches.map((batch) => batch.id),
      vertices: vertexCount,
      triangles: triangleCount,
      estimatedDrawCalls: expectedDrawCalls,
      materials: materialCount,
    },
  });
  const buildMs = nowMs() - startedAt;

  return {
    artifact,
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
    life,
    acceptance,
    buildMs,
    diagnostics: {
      vertexCount,
      triangleCount,
      colonyCount: layout.colonies.length,
      batchCount: activeBatches.length,
      materialCount,
      expectedDrawCalls,
      motionBindingCount: life.bindings.length,
      staticStatus: acceptance.staticStatus,
      violations: acceptance.violations,
    },
  };
}
