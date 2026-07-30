import { distance } from '../../growth/math';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { buildOrganicSweepMesh as buildSeamlessOrganicSweepMesh } from './seamlessSweepMesh';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameState,
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from './surfaceTypes';

interface SharedFork {
  parent: OrganicBranchCurve;
  children: OrganicBranchCurve[];
}

function terminalChildren(
  parent: OrganicBranchCurve,
  frameState: OrganicCurveFrameState,
): OrganicBranchCurve[] {
  const terminal = parent.samples[parent.samples.length - 1];
  if (!terminal) return [];
  return frameState.curves.filter((curve) => {
    const junction = curve.junction;
    if (!junction || junction.parentBranchId !== parent.branchId) return false;
    return junction.parentNodeId === parent.terminalNodeId
      || distance(junction.parentPosition, terminal.position)
        <= Math.max(junction.parentRadius * 1.35, terminal.radius * 1.75);
  });
}

function findSharedFork(frameState: OrganicCurveFrameState): SharedFork | null {
  for (const parent of frameState.curves) {
    if (parent.generation > 1) continue;
    const children = terminalChildren(parent, frameState).slice(0, 3);
    if (children.length >= 2) return { parent, children };
  }
  return null;
}

function removeVertexSlice(
  values: readonly number[],
  firstVertex: number,
  vertexCount: number,
  itemSize: number,
): number[] {
  const first = firstVertex * itemSize;
  const last = (firstVertex + vertexCount) * itemSize;
  return [...values.slice(0, first), ...values.slice(last)];
}

function trimChildCollar(
  mesh: OrganicSweepMesh,
  branchId: string,
): OrganicSweepMesh {
  const target = mesh.branches.find((branch) => branch.branchId === branchId);
  if (!target || target.junctionRingCount <= 1) return mesh;

  const removedRings = target.junctionRingCount;
  const removedVertices = removedRings * target.radialSegments;
  const removedIndices = removedRings * target.radialSegments * 6;
  if (target.ringCount - removedRings < 2
    || removedVertices >= target.vertexCount
    || removedIndices >= target.indexCount) {
    return mesh;
  }

  const firstRemovedVertex = target.firstVertex;
  const lastRemovedVertex = firstRemovedVertex + removedVertices;
  const firstRemovedIndex = target.firstIndex;
  const lastRemovedIndex = firstRemovedIndex + removedIndices;
  const positions = removeVertexSlice(
    mesh.positions,
    firstRemovedVertex,
    removedVertices,
    3,
  );
  const normals = removeVertexSlice(
    mesh.normals,
    firstRemovedVertex,
    removedVertices,
    3,
  );
  const uvs = removeVertexSlice(
    mesh.uvs,
    firstRemovedVertex,
    removedVertices,
    2,
  );
  const retainedIndices = [
    ...mesh.indices.slice(0, firstRemovedIndex),
    ...mesh.indices.slice(lastRemovedIndex),
  ];
  const indices = retainedIndices.map((index) => (
    index >= lastRemovedVertex ? index - removedVertices : index
  ));

  const branches = mesh.branches.map((branch) => {
    if (branch.branchId === branchId) {
      return {
        ...branch,
        vertexCount: branch.vertexCount - removedVertices,
        indexCount: branch.indexCount - removedIndices,
        ringCount: branch.ringCount - removedRings,
        // One logical shared-shell transition replaces all explicit collar rings.
        junctionRingCount: 1,
      };
    }
    return {
      ...branch,
      firstVertex: branch.firstVertex > firstRemovedVertex
        ? branch.firstVertex - removedVertices
        : branch.firstVertex,
      firstIndex: branch.firstIndex > firstRemovedIndex
        ? branch.firstIndex - removedIndices
        : branch.firstIndex,
    };
  });

  return {
    ...mesh,
    positions,
    normals,
    uvs,
    indices,
    branches,
    diagnostics: {
      ...mesh.diagnostics,
      ringCount: mesh.diagnostics.ringCount - removedRings,
      junctionRingCount: mesh.diagnostics.junctionRingCount - removedRings + 1,
      vertexCount: mesh.diagnostics.vertexCount - removedVertices,
      triangleCount: mesh.diagnostics.triangleCount - removedIndices / 3,
    },
  };
}

function removeSharedForkCollars(
  mesh: OrganicSweepMesh,
  fork: SharedFork,
): OrganicSweepMesh {
  const orderedChildren = [...fork.children].sort((left, right) => {
    const leftRange = mesh.branches.find((branch) => branch.branchId === left.branchId);
    const rightRange = mesh.branches.find((branch) => branch.branchId === right.branchId);
    return (rightRange?.firstVertex ?? 0) - (leftRange?.firstVertex ?? 0);
  });
  return orderedChildren.reduce(
    (current, child) => trimChildCollar(current, child.branchId),
    mesh,
  );
}

/**
 * Production tree sweep: build the shared implicit Y-shell, then remove the
 * explicit child collar rings hidden underneath it so only one bark surface
 * remains visible at the main fork.
 */
export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const seamless = buildSeamlessOrganicSweepMesh(frameState, lod, config);
  const fork = findSharedFork(frameState);
  return fork ? removeSharedForkCollars(seamless, fork) : seamless;
}
