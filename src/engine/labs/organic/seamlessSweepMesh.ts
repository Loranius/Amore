import {
  add,
  cross,
  distance,
  dot,
  lerp,
  normalize,
  round6,
  scale,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { buildOrganicSweepMesh as buildBaseOrganicSweepMesh } from './sweepMesh';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameState,
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from './surfaceTypes';

interface ForkSegment {
  start: GrowthVec3;
  end: GrowthVec3;
  startRadius: number;
  endRadius: number;
}

interface ForkPatch {
  parentBranchId: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const GRID_BY_LOD: Readonly<Record<OrganicMeshLod, number>> = {
  high: 9,
  medium: 8,
  low: 6,
};

const CUBE_CORNERS: readonly GrowthVec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 1, y: 0, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: 0, y: 1, z: 1 },
];

const CUBE_TETRAHEDRA: readonly (readonly number[])[] = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function pushVec(target: number[], value: GrowthVec3): void {
  target.push(round6(value.x), round6(value.y), round6(value.z));
}

function taperedSegmentDistance(point: GrowthVec3, segment: ForkSegment): number {
  const direction = subtract(segment.end, segment.start);
  const denominator = Math.max(1e-9, dot(direction, direction));
  const t = clamp01(dot(subtract(point, segment.start), direction) / denominator);
  const center = lerp(segment.start, segment.end, t);
  const radius = segment.startRadius
    + (segment.endRadius - segment.startRadius) * smoothstep(t);
  return distance(point, center) - radius;
}

function smoothMinimum(left: number, right: number, radius: number): number {
  if (radius <= 1e-9) return Math.min(left, right);
  const h = clamp01(0.5 + 0.5 * (right - left) / radius);
  return right + (left - right) * h - radius * h * (1 - h);
}

function forkField(
  point: GrowthVec3,
  segments: readonly ForkSegment[],
  blendRadius: number,
): number {
  const first = segments[0];
  if (!first) return Number.POSITIVE_INFINITY;
  let result = taperedSegmentDistance(point, first);
  for (let index = 1; index < segments.length; index += 1) {
    result = smoothMinimum(
      result,
      taperedSegmentDistance(point, segments[index]!),
      blendRadius,
    );
  }
  return result;
}

function interpolateIso(
  start: GrowthVec3,
  end: GrowthVec3,
  startValue: number,
  endValue: number,
): GrowthVec3 {
  const denominator = startValue - endValue;
  const t = Math.abs(denominator) <= 1e-9 ? 0.5 : clamp01(startValue / denominator);
  return lerp(start, end, t);
}

function fieldNormal(
  point: GrowthVec3,
  field: (position: GrowthVec3) => number,
  epsilon: number,
): GrowthVec3 {
  const x = field({ x: point.x + epsilon, y: point.y, z: point.z })
    - field({ x: point.x - epsilon, y: point.y, z: point.z });
  const y = field({ x: point.x, y: point.y + epsilon, z: point.z })
    - field({ x: point.x, y: point.y - epsilon, z: point.z });
  const z = field({ x: point.x, y: point.y, z: point.z + epsilon })
    - field({ x: point.x, y: point.y, z: point.z - epsilon });
  return normalize({ x, y, z }, { x: 0, y: 1, z: 0 });
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

function findSharedFork(frameState: OrganicCurveFrameState): {
  parent: OrganicBranchCurve;
  children: OrganicBranchCurve[];
} | null {
  for (const parent of frameState.curves) {
    if (parent.generation > 1) continue;
    const children = terminalChildren(parent, frameState).slice(0, 3);
    if (children.length >= 2) return { parent, children };
  }
  return null;
}

function buildForkPatch(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
): ForkPatch | null {
  const fork = findSharedFork(frameState);
  if (!fork) return null;
  const terminal = fork.parent.samples[fork.parent.samples.length - 1];
  if (!terminal) return null;

  const minimumBlendLength = terminal.radius * 1.05;
  let lower = fork.parent.samples[0] ?? terminal;
  for (let index = fork.parent.samples.length - 2; index >= 0; index -= 1) {
    const candidate = fork.parent.samples[index];
    if (!candidate) continue;
    lower = candidate;
    if (distance(candidate.position, terminal.position) >= minimumBlendLength) break;
  }

  const origin = add(terminal.position, scale(terminal.tangent, -terminal.radius * 0.08));
  const segments: ForkSegment[] = [{
    start: lower.position,
    end: origin,
    startRadius: lower.radius * 1.01,
    endRadius: terminal.radius * 1.06,
  }];

  for (const child of fork.children) {
    const junction = child.junction;
    if (!junction) continue;
    const targetIndex = Math.min(
      child.samples.length - 1,
      Math.max(1, junction.joinSampleIndex + 1),
    );
    const target = child.samples[targetIndex];
    if (!target) continue;
    segments.push({
      start: origin,
      end: target.position,
      startRadius: Math.max(terminal.radius * 0.72, junction.collarRadius * 0.96),
      endRadius: Math.max(target.radius * 1.04, junction.collarRadius * 0.68),
    });
  }
  if (segments.length < 3) return null;

  const blendRadius = terminal.radius * 0.24;
  const maximumRadius = Math.max(
    ...segments.flatMap((segment) => [segment.startRadius, segment.endRadius]),
  );
  const expansion = maximumRadius + blendRadius * 0.75;
  const endpoints = segments.flatMap((segment) => [segment.start, segment.end]);
  const minimum = endpoints.reduce<GrowthVec3>((result, point) => ({
    x: Math.min(result.x, point.x),
    y: Math.min(result.y, point.y),
    z: Math.min(result.z, point.z),
  }), { x: Infinity, y: Infinity, z: Infinity });
  const maximum = endpoints.reduce<GrowthVec3>((result, point) => ({
    x: Math.max(result.x, point.x),
    y: Math.max(result.y, point.y),
    z: Math.max(result.z, point.z),
  }), { x: -Infinity, y: -Infinity, z: -Infinity });
  minimum.x -= expansion;
  minimum.y -= expansion;
  minimum.z -= expansion;
  maximum.x += expansion;
  maximum.y += expansion;
  maximum.z += expansion;

  const grid = GRID_BY_LOD[lod];
  const step = {
    x: (maximum.x - minimum.x) / grid,
    y: (maximum.y - minimum.y) / grid,
    z: (maximum.z - minimum.z) / grid,
  };
  const field = (point: GrowthVec3) => forkField(point, segments, blendRadius);
  const normalEpsilon = Math.max(1e-5, Math.min(step.x, step.y, step.z) * 0.2);
  const axialLength = Math.max(
    1e-6,
    distance(lower.position, terminal.position) + terminal.radius * 2.4,
  );
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const emitTriangle = (first: GrowthVec3, second: GrowthVec3, third: GrowthVec3) => {
    const face = cross(subtract(second, first), subtract(third, first));
    if (dot(face, face) <= 1e-12) return;
    const triangle = [first, second, third];
    const triangleNormals = triangle.map((vertex) => fieldNormal(vertex, field, normalEpsilon));
    const averageNormal = add(add(triangleNormals[0]!, triangleNormals[1]!), triangleNormals[2]!);
    if (dot(face, averageNormal) < 0) {
      [triangle[1], triangle[2]] = [triangle[2]!, triangle[1]!];
      [triangleNormals[1], triangleNormals[2]] = [triangleNormals[2]!, triangleNormals[1]!];
    }

    const firstVertex = positions.length / 3;
    triangle.forEach((vertex, index) => {
      const relative = subtract(vertex, lower.position);
      const angle = Math.atan2(
        dot(relative, terminal.binormal),
        dot(relative, terminal.normal),
      );
      pushVec(positions, vertex);
      pushVec(normals, triangleNormals[index]!);
      uvs.push(
        round6(clamp01(dot(relative, terminal.tangent) / axialLength)),
        round6((angle / (Math.PI * 2) + 1) % 1),
      );
    });
    indices.push(firstVertex, firstVertex + 1, firstVertex + 2);
  };

  for (let xIndex = 0; xIndex < grid; xIndex += 1) {
    for (let yIndex = 0; yIndex < grid; yIndex += 1) {
      for (let zIndex = 0; zIndex < grid; zIndex += 1) {
        const cornerPositions = CUBE_CORNERS.map((corner) => ({
          x: minimum.x + (xIndex + corner.x) * step.x,
          y: minimum.y + (yIndex + corner.y) * step.y,
          z: minimum.z + (zIndex + corner.z) * step.z,
        }));
        const cornerValues = cornerPositions.map(field);

        for (const tetrahedron of CUBE_TETRAHEDRA) {
          const inside = tetrahedron.filter((corner) => cornerValues[corner]! <= 0);
          const outside = tetrahedron.filter((corner) => cornerValues[corner]! > 0);
          if (inside.length === 0 || inside.length === 4) continue;
          const edge = (left: number, right: number) => interpolateIso(
            cornerPositions[left]!,
            cornerPositions[right]!,
            cornerValues[left]!,
            cornerValues[right]!,
          );

          if (inside.length === 1) {
            emitTriangle(
              edge(inside[0]!, outside[0]!),
              edge(inside[0]!, outside[1]!),
              edge(inside[0]!, outside[2]!),
            );
          } else if (inside.length === 3) {
            emitTriangle(
              edge(outside[0]!, inside[0]!),
              edge(outside[0]!, inside[1]!),
              edge(outside[0]!, inside[2]!),
            );
          } else {
            const a = edge(inside[0]!, outside[0]!);
            const b = edge(inside[0]!, outside[1]!);
            const c = edge(inside[1]!, outside[0]!);
            const d = edge(inside[1]!, outside[1]!);
            emitTriangle(a, b, c);
            emitTriangle(b, d, c);
          }
        }
      }
    }
  }

  return {
    parentBranchId: fork.parent.branchId,
    positions,
    normals,
    uvs,
    indices,
  };
}

function insertForkPatch(base: OrganicSweepMesh, patch: ForkPatch): OrganicSweepMesh {
  const parent = base.branches.find((branch) => branch.branchId === patch.parentBranchId);
  if (!parent || patch.indices.length === 0) return base;
  const insertVertex = parent.firstVertex + parent.vertexCount;
  const insertIndex = parent.firstIndex + parent.indexCount;
  const patchVertexCount = patch.positions.length / 3;
  const patchIndexCount = patch.indices.length;

  const positions = [
    ...base.positions.slice(0, insertVertex * 3),
    ...patch.positions,
    ...base.positions.slice(insertVertex * 3),
  ];
  const normals = [
    ...base.normals.slice(0, insertVertex * 3),
    ...patch.normals,
    ...base.normals.slice(insertVertex * 3),
  ];
  const uvs = [
    ...base.uvs.slice(0, insertVertex * 2),
    ...patch.uvs,
    ...base.uvs.slice(insertVertex * 2),
  ];
  const shiftedBaseIndices = base.indices.map((index) => (
    index >= insertVertex ? index + patchVertexCount : index
  ));
  const indices = [
    ...shiftedBaseIndices.slice(0, insertIndex),
    ...patch.indices.map((index) => index + insertVertex),
    ...shiftedBaseIndices.slice(insertIndex),
  ];
  const branches = base.branches.map((branch) => {
    if (branch.branchId === patch.parentBranchId) {
      return {
        ...branch,
        vertexCount: branch.vertexCount + patchVertexCount,
        indexCount: branch.indexCount + patchIndexCount,
      };
    }
    return {
      ...branch,
      firstVertex: branch.firstVertex >= insertVertex
        ? branch.firstVertex + patchVertexCount
        : branch.firstVertex,
      firstIndex: branch.firstIndex >= insertIndex
        ? branch.firstIndex + patchIndexCount
        : branch.firstIndex,
    };
  });

  return {
    ...base,
    positions,
    normals,
    uvs,
    indices,
    branches,
    diagnostics: {
      ...base.diagnostics,
      vertexCount: base.diagnostics.vertexCount + patchVertexCount,
      triangleCount: base.diagnostics.triangleCount + patchIndexCount / 3,
    },
  };
}

/**
 * Production organic sweep. The stable base sweep stays untouched, then one
 * local implicit shell fuses the first major terminal fork into one surface.
 */
export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const base = buildBaseOrganicSweepMesh(frameState, lod, config);
  const patch = buildForkPatch(frameState, lod);
  return patch ? insertForkPatch(base, patch) : base;
}
