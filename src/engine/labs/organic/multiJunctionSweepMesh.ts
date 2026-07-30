import {
  add,
  cross,
  distance,
  dot,
  lerp,
  normalize,
  round6,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { buildOrganicSweepMesh as buildProductionSweepMesh } from './productionSweepMesh';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from './surfaceTypes';

interface JunctionGroup {
  key: string;
  parent: OrganicBranchCurve;
  children: OrganicBranchCurve[];
  anchor: OrganicCurveFrameSample;
  parentRadius: number;
  terminal: boolean;
}

interface JunctionSegment {
  start: GrowthVec3;
  end: GrowthVec3;
  startRadius: number;
  endRadius: number;
}

interface JunctionPatch {
  parentBranchId: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

const GRID_BY_LOD: Readonly<Record<OrganicMeshLod, number>> = {
  high: 7,
  medium: 6,
  low: 5,
};

const MAX_PATCHES_BY_LOD: Readonly<Record<OrganicMeshLod, number>> = {
  high: 6,
  medium: 4,
  low: 2,
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

function closestSampleIndex(curve: OrganicBranchCurve, position: GrowthVec3): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  curve.samples.forEach((sample, index) => {
    const candidate = distance(sample.position, position);
    if (candidate < bestDistance) {
      bestDistance = candidate;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function sampleAtDistance(
  curve: OrganicBranchCurve,
  anchorIndex: number,
  direction: -1 | 1,
  minimumDistance: number,
): OrganicCurveFrameSample {
  const anchor = curve.samples[anchorIndex]!;
  let result = anchor;
  for (
    let index = anchorIndex + direction;
    index >= 0 && index < curve.samples.length;
    index += direction
  ) {
    const sample = curve.samples[index];
    if (!sample) continue;
    result = sample;
    if (distance(sample.position, anchor.position) >= minimumDistance) break;
  }
  return result;
}

function collectJunctionGroups(frameState: OrganicCurveFrameState): JunctionGroup[] {
  const curvesById = new Map(frameState.curves.map((curve) => [curve.branchId, curve]));
  const grouped = new Map<string, OrganicBranchCurve[]>();

  for (const child of frameState.curves) {
    const junction = child.junction;
    if (!junction) continue;
    const key = `${junction.parentBranchId}:${junction.parentNodeId}`;
    const existing = grouped.get(key);
    if (existing) existing.push(child);
    else grouped.set(key, [child]);
  }

  const result: JunctionGroup[] = [];
  for (const [key, children] of grouped) {
    const firstJunction = children[0]?.junction;
    if (!firstJunction) continue;
    const parent = curvesById.get(firstJunction.parentBranchId);
    if (!parent || parent.samples.length < 2) continue;
    const anchorIndex = closestSampleIndex(parent, firstJunction.parentPosition);
    const anchor = parent.samples[anchorIndex];
    const terminalSample = parent.samples[parent.samples.length - 1];
    if (!anchor || !terminalSample) continue;
    const terminal = firstJunction.parentNodeId === parent.terminalNodeId
      || distance(anchor.position, terminalSample.position)
        <= Math.max(firstJunction.parentRadius * 1.35, terminalSample.radius * 1.75);
    result.push({
      key,
      parent,
      children: [...children].sort((left, right) => left.branchId.localeCompare(right.branchId)),
      anchor,
      parentRadius: firstJunction.parentRadius,
      terminal,
    });
  }
  return result;
}

function primaryForkKey(groups: readonly JunctionGroup[]): string | null {
  const primary = groups.find((group) => (
    group.terminal
    && group.children.length >= 2
    && group.parent.generation <= 1
  ));
  return primary?.key ?? null;
}

function visibleJunctionGroups(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
): JunctionGroup[] {
  const groups = collectJunctionGroups(frameState);
  const primaryKey = primaryForkKey(groups);
  const trunk = frameState.curves.find((curve) => curve.branchId === 'organic:trunk');
  const maximumRadius = Math.max(
    1e-6,
    ...(trunk?.samples.map((sample) => sample.radius) ?? []),
    ...groups.map((group) => group.parentRadius),
  );
  const minimumRatio = lod === 'low' ? 0.24 : lod === 'medium' ? 0.14 : 0.1;

  return groups
    .filter((group) => group.key !== primaryKey)
    .filter((group) => group.parent.generation <= 3)
    .filter((group) => group.parentRadius >= maximumRadius * minimumRatio)
    .sort((left, right) => (
      right.parentRadius - left.parentRadius
      || left.key.localeCompare(right.key)
    ))
    .slice(0, MAX_PATCHES_BY_LOD[lod]);
}

function taperedSegmentDistance(point: GrowthVec3, segment: JunctionSegment): number {
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

function junctionField(
  point: GrowthVec3,
  segments: readonly JunctionSegment[],
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

function buildSegments(group: JunctionGroup): JunctionSegment[] {
  const anchorIndex = closestSampleIndex(group.parent, group.anchor.position);
  const blendLength = Math.max(group.parentRadius * 1.35, 1e-4);
  const lower = sampleAtDistance(group.parent, anchorIndex, -1, blendLength);
  const upper = group.terminal
    ? group.anchor
    : sampleAtDistance(group.parent, anchorIndex, 1, blendLength);
  const segments: JunctionSegment[] = [{
    start: lower.position,
    end: upper.position,
    startRadius: lower.radius * 1.018,
    endRadius: upper.radius * 1.035,
  }];

  for (const child of group.children.slice(0, 3)) {
    const junction = child.junction;
    if (!junction) continue;
    const targetIndex = Math.min(
      child.samples.length - 1,
      Math.max(1, junction.joinSampleIndex + 1),
    );
    const target = child.samples[targetIndex];
    if (!target) continue;
    segments.push({
      start: group.anchor.position,
      end: target.position,
      startRadius: Math.max(
        junction.collarRadius * 1.1,
        group.parentRadius * (group.terminal ? 0.56 : 0.34),
      ),
      endRadius: Math.max(target.radius * 1.045, junction.collarRadius * 0.7),
    });
  }
  return segments;
}

function buildJunctionPatch(
  group: JunctionGroup,
  lod: OrganicMeshLod,
): JunctionPatch | null {
  const segments = buildSegments(group);
  if (segments.length < 2) return null;
  const blendRadius = group.parentRadius * (group.terminal ? 0.22 : 0.17);
  const maximumRadius = Math.max(
    ...segments.flatMap((segment) => [segment.startRadius, segment.endRadius]),
  );
  const expansion = maximumRadius + blendRadius * 0.8;
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
  const field = (point: GrowthVec3) => junctionField(point, segments, blendRadius);
  const normalEpsilon = Math.max(1e-5, Math.min(step.x, step.y, step.z) * 0.2);
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
      const relative = subtract(vertex, group.anchor.position);
      const angle = Math.atan2(
        dot(relative, group.anchor.binormal),
        dot(relative, group.anchor.normal),
      );
      pushVec(positions, vertex);
      pushVec(normals, triangleNormals[index]!);
      uvs.push(
        round6(clamp01(0.5 + dot(relative, group.anchor.tangent) / Math.max(1e-6, group.parentRadius * 5))),
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
    parentBranchId: group.parent.branchId,
    positions,
    normals,
    uvs,
    indices,
  };
}

function insertPatch(base: OrganicSweepMesh, patch: JunctionPatch): OrganicSweepMesh {
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
 * Adds deterministic implicit bark shells to every structurally visible
 * junction after the primary fork has been fused by the production sweep.
 * Thin hidden twigs keep the cheaper collar path to preserve the mobile budget.
 */
export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const base = buildProductionSweepMesh(frameState, lod, config);
  return visibleJunctionGroups(frameState, lod).reduce((mesh, group) => {
    const patch = buildJunctionPatch(group, lod);
    return patch ? insertPatch(mesh, patch) : mesh;
  }, base);
}
