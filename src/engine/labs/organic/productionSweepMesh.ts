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

function shiftAfterRemoval(
  mesh: OrganicSweepMesh,
  input: {
    branchId: string;
    firstRemovedVertex: number;
    removedVertices: number;
    firstRemovedIndex: number;
    removedIndices: number;
    removedRings: number;
    junctionRingCount?: number;
    junctionRingDelta?: number;
  },
): OrganicSweepMesh {
  const {
    branchId,
    firstRemovedVertex,
    removedVertices,
    firstRemovedIndex,
    removedIndices,
    removedRings,
    junctionRingCount,
    junctionRingDelta = 0,
  } = input;
  const lastRemovedVertex = firstRemovedVertex + removedVertices;
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
        junctionRingCount: junctionRingCount ?? branch.junctionRingCount,
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
      junctionRingCount: mesh.diagnostics.junctionRingCount + junctionRingDelta,
      vertexCount: mesh.diagnostics.vertexCount - removedVertices,
      triangleCount: mesh.diagnostics.triangleCount - removedIndices / 3,
    },
  };
}

function sampledCurveIndices(
  curve: OrganicBranchCurve,
  stride: number,
): number[] {
  return curve.samples
    .map((_sample, index) => index)
    .filter((index) => (
      index === 0
      || index === curve.samples.length - 1
      || index % stride === 0
    ));
}

function parentRingsCoveredByShell(
  parent: OrganicBranchCurve,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): number {
  const terminal = parent.samples[parent.samples.length - 1];
  if (!terminal) return 0;
  const minimumBlendLength = terminal.radius * 1.05;
  let lowerIndex = Math.max(0, parent.samples.length - 2);
  for (let index = parent.samples.length - 2; index >= 0; index -= 1) {
    const candidate = parent.samples[index];
    if (!candidate) continue;
    lowerIndex = index;
    if (distance(candidate.position, terminal.position) >= minimumBlendLength) break;
  }

  const stride = Math.max(1, Math.floor(config.axialStrideByLod[lod]));
  const sampled = sampledCurveIndices(parent, stride);
  const firstCovered = sampled.findIndex((index) => index >= lowerIndex);
  if (firstCovered < 0) return 0;
  return sampled.length - firstCovered;
}

function trimParentForkTube(
  mesh: OrganicSweepMesh,
  fork: SharedFork,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): OrganicSweepMesh {
  const target = mesh.branches.find(
    (branch) => branch.branchId === fork.parent.branchId,
  );
  if (!target) return mesh;
  const coveredRings = parentRingsCoveredByShell(fork.parent, lod, config);
  const removedRings = Math.min(
    Math.max(0, coveredRings - 1),
    Math.max(0, target.ringCount - 2),
  );
  if (removedRings <= 0) return mesh;

  const retainedRings = target.ringCount - removedRings;
  const removedVertices = removedRings * target.radialSegments;
  const removedIndices = removedRings * target.radialSegments * 6;
  const firstRemovedVertex = target.firstVertex
    + retainedRings * target.radialSegments;
  const firstRemovedIndex = target.firstIndex
    + (retainedRings - 1) * target.radialSegments * 6;
  if (removedVertices >= target.vertexCount
    || removedIndices >= target.indexCount) {
    return mesh;
  }

  return shiftAfterRemoval(mesh, {
    branchId: target.branchId,
    firstRemovedVertex,
    removedVertices,
    firstRemovedIndex,
    removedIndices,
    removedRings,
  });
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

  return shiftAfterRemoval(mesh, {
    branchId,
    firstRemovedVertex: target.firstVertex,
    removedVertices,
    firstRemovedIndex: target.firstIndex,
    removedIndices,
    removedRings,
    // One logical shared-shell transition replaces all explicit collar rings.
    junctionRingCount: 1,
    junctionRingDelta: -removedRings + 1,
  });
}

function removeSharedForkOverlaps(
  mesh: OrganicSweepMesh,
  fork: SharedFork,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): OrganicSweepMesh {
  const parentTrimmed = trimParentForkTube(mesh, fork, lod, config);
  const orderedChildren = [...fork.children].sort((left, right) => {
    const leftRange = parentTrimmed.branches.find(
      (branch) => branch.branchId === left.branchId,
    );
    const rightRange = parentTrimmed.branches.find(
      (branch) => branch.branchId === right.branchId,
    );
    return (rightRange?.firstVertex ?? 0) - (leftRange?.firstVertex ?? 0);
  });
  return orderedChildren.reduce(
    (current, child) => trimChildCollar(current, child.branchId),
    parentTrimmed,
  );
}

/**
 * Production tree sweep: build the shared implicit Y-shell, then remove every
 * parent/child ring hidden underneath it while retaining the shared boundary
 * ring that seals the trunk to the new fork surface.
 */
export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const seamless = buildSeamlessOrganicSweepMesh(frameState, lod, config);
  const fork = findSharedFork(frameState);
  return fork
    ? removeSharedForkOverlaps(seamless, fork, lod, config)
    : seamless;
}
