import type { ArtifactBlueprint } from '@/engine/evolution';
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

export const REEF_PRODUCTION_BUDGET = Object.freeze({
  maximumDrawCalls: 7,
  maximumMaterials: 7,
  maximumVertices: 24_256,
  maximumTriangles: 36_512,
  maximumBuildMs: 220,
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
  buildMs: number;
  diagnostics: ReefPreviewDiagnostics;
}

export interface BuildReefPreviewInput {
  artifact: ArtifactBlueprint;
  asOf: string;
  rulesVersion?: string;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Runs the accepted Reef Species phases 1–7 without renderer side effects.
 * The returned state is the sole production input for the Phase 8 Three.js adapter.
 */
export function buildReefPreviewFromArtifact({
  artifact,
  asOf,
  rulesVersion = 'reef-species-production-v1.0.0',
}: BuildReefPreviewInput): ReefPreviewBuild {
  const startedAt = nowMs();
  const species = buildReefSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion },
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
  const buildMs = nowMs() - startedAt;

  const colonyVertexCount = meshes.batches.reduce(
    (total, batch) => total + batch.vertices.length,
    0,
  );
  const colonyTriangleCount = meshes.batches.reduce(
    (total, batch) => total + batch.triangles.length,
    0,
  );
  const activeBatches = meshes.batches.filter((batch) => batch.index.length > 0);
  const materialBindingCount = materials.colonies.reduce(
    (total, assignment) => total + assignment.bindings.length,
    0,
  );
  const rangeCount = meshes.batches.reduce(
    (total, batch) => total + batch.ranges.length,
    0,
  );
  const vertexCount = foundation.vertices.length + colonyVertexCount;
  const triangleCount = foundation.triangles.length + colonyTriangleCount;
  const materialCount = 1 + materials.colonies.length;
  const expectedDrawCalls = 1 + activeBatches.length;
  const violations: string[] = [];

  if (!foundation.diagnostics.closedShell) violations.push('foundation-open-shell');
  if (foundation.diagnostics.geometryBudgetExceeded) violations.push('foundation-geometry-budget');
  if (meshes.diagnostics.geometryBudgetExceeded) violations.push('colony-geometry-budget');
  if (life.diagnostics.motionBindingBudgetExceeded) violations.push('motion-binding-budget');
  if (rangeCount !== life.bindings.length) violations.push('motion-range-count');
  if (materialBindingCount !== life.bindings.length) violations.push('motion-material-count');
  if (life.diagnostics.invalidBindingIds.length > 0) violations.push('invalid-motion-bindings');
  if (life.diagnostics.missingRangeIds.length > 0) violations.push('missing-motion-ranges');
  if (life.diagnostics.missingMaterialBindingIds.length > 0) {
    violations.push('missing-motion-materials');
  }
  if (expectedDrawCalls > REEF_PRODUCTION_BUDGET.maximumDrawCalls) violations.push('draw-call-budget');
  if (materialCount > REEF_PRODUCTION_BUDGET.maximumMaterials) violations.push('material-budget');
  if (vertexCount > REEF_PRODUCTION_BUDGET.maximumVertices) violations.push('vertex-budget');
  if (triangleCount > REEF_PRODUCTION_BUDGET.maximumTriangles) violations.push('triangle-budget');
  if (buildMs > REEF_PRODUCTION_BUDGET.maximumBuildMs) violations.push('build-time-budget');

  return {
    artifact,
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
    life,
    buildMs,
    diagnostics: {
      vertexCount,
      triangleCount,
      colonyCount: layout.colonies.length,
      batchCount: activeBatches.length,
      materialCount,
      expectedDrawCalls,
      motionBindingCount: life.bindings.length,
      staticStatus: violations.length === 0 ? 'pass' : 'fail',
      violations,
    },
  };
}
