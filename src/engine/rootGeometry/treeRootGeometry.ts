import { buildOrganicSweepMesh } from '../labs/organic';
import type {
  BuildTreeRootGeometryInput,
  TreeRootGeometryState,
} from './types';

function validateInput(input: BuildTreeRootGeometryInput): void {
  const { roots, lod, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Root Geometry requires a non-empty rulesVersion.');
  }
  for (const currentLod of ['high', 'medium', 'low'] as const) {
    const vertices = config.maximumVerticesByLod[currentLod];
    const triangles = config.maximumTrianglesByLod[currentLod];
    if (!Number.isInteger(vertices) || vertices < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} vertex budget must be a non-negative integer.`);
    }
    if (!Number.isInteger(triangles) || triangles < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} triangle budget must be a non-negative integer.`);
    }
  }
  if (!(lod in config.maximumVerticesByLod) || !(lod in config.maximumTrianglesByLod)) {
    throw new Error(`Tree Root Geometry received unsupported LOD: ${String(lod)}.`);
  }
  if (roots.frames.diagnostics.branchCount !== roots.roots.length) {
    throw new Error('Tree Root Geometry root descriptors and canonical curves do not match.');
  }
  if (roots.frames.sourceRulesVersion !== roots.rulesVersion) {
    throw new Error('Tree Root Geometry received root frames from another rules version.');
  }
}

/**
 * Pure root meshing step. It consumes accepted canonical root curves and never
 * edits the root architecture, trunk geometry, material state or Tree Life.
 */
export function buildTreeRootGeometry(
  input: BuildTreeRootGeometryInput,
): TreeRootGeometryState {
  validateInput(input);
  const { roots, lod, config } = input;
  const mesh = buildOrganicSweepMesh(roots.frames, lod, config.surface);
  const expectedRootIds = roots.roots.map((root) => root.id);
  const renderedRootIds = mesh.branches.map((branch) => branch.branchId);
  const renderedRootSet = new Set(renderedRootIds);
  const expectedRootSet = new Set(expectedRootIds);
  const missingRootMeshIds = expectedRootIds.filter((id) => !renderedRootSet.has(id));
  const unexpectedMeshBranchIds = renderedRootIds.filter((id) => !expectedRootSet.has(id));
  const vertexBudget = config.maximumVerticesByLod[lod];
  const triangleBudget = config.maximumTrianglesByLod[lod];
  const vertexBudgetExceeded = mesh.diagnostics.vertexCount > vertexBudget;
  const triangleBudgetExceeded = mesh.diagnostics.triangleCount > triangleBudget;

  if (missingRootMeshIds.length > 0 || unexpectedMeshBranchIds.length > 0) {
    throw new Error('Tree Root Geometry mesh provenance does not match accepted root IDs.');
  }
  if (vertexBudgetExceeded || triangleBudgetExceeded) {
    throw new Error(
      `Tree Root Geometry exceeded the ${lod} mobile mesh budget: `
        + `${mesh.diagnostics.vertexCount}/${vertexBudget} vertices, `
        + `${mesh.diagnostics.triangleCount}/${triangleBudget} triangles.`,
    );
  }

  return {
    treeRootGeometryVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceRootArchitectureVersion: roots.treeRootArchitectureVersion,
    sourceRootRulesVersion: roots.rulesVersion,
    artifactSeed: roots.artifactSeed,
    lod,
    mesh,
    diagnostics: {
      sourceRootCount: roots.roots.length,
      renderedRootCount: mesh.diagnostics.branchCount,
      vertexCount: mesh.diagnostics.vertexCount,
      triangleCount: mesh.diagnostics.triangleCount,
      estimatedDrawCalls: mesh.diagnostics.branchCount > 0 ? 1 : 0,
      anchoredToGround: true,
      vertexBudget,
      triangleBudget,
      vertexBudgetExceeded,
      triangleBudgetExceeded,
      missingRootMeshIds,
      unexpectedMeshBranchIds,
    },
  };
}
