import {
  add,
  cross,
  distance,
  dot,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { ORGANIC_TRUNK_BRANCH_ID } from './surfaceTypes';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
  OrganicJunctionAnchor,
  OrganicSurfaceConfig,
} from './surfaceTypes';
import type { OrganicSkeletonNode, OrganicSkeletonState } from './types';

interface CurvePoint {
  node: OrganicSkeletonNode;
  position: GrowthVec3;
  radius: number;
}

function catmullRom(
  p0: GrowthVec3,
  p1: GrowthVec3,
  p2: GrowthVec3,
  p3: GrowthVec3,
  t: number,
): GrowthVec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  return scale(
    add(
      add(
        add(scale(p1, 2), scale(subtract(p2, p0), t)),
        scale(add(add(scale(p0, 2), scale(p1, -5)), add(scale(p2, 4), scale(p3, -1))), t2),
      ),
      scale(add(add(scale(p0, -1), scale(p1, 3)), add(scale(p2, -3), p3)), t3),
    ),
    0.5,
  );
}

function catmullRomTangent(
  p0: GrowthVec3,
  p1: GrowthVec3,
  p2: GrowthVec3,
  p3: GrowthVec3,
  t: number,
): GrowthVec3 {
  const t2 = t * t;
  return scale(
    add(
      add(
        subtract(p2, p0),
        scale(add(add(scale(p0, 2), scale(p1, -5)), add(scale(p2, 4), scale(p3, -1))), 2 * t),
      ),
      scale(add(add(scale(p0, -1), scale(p1, 3)), add(scale(p2, -3), p3)), 3 * t2),
    ),
    0.5,
  );
}

function branchOrder(
  left: readonly OrganicSkeletonNode[],
  right: readonly OrganicSkeletonNode[],
): number {
  const leftFirst = left[0];
  const rightFirst = right[0];
  if (!leftFirst || !rightFirst) return left.length - right.length;
  if (leftFirst.branchId === ORGANIC_TRUNK_BRANCH_ID) return -1;
  if (rightFirst.branchId === ORGANIC_TRUNK_BRANCH_ID) return 1;
  return leftFirst.sequence - rightFirst.sequence || leftFirst.branchId.localeCompare(rightFirst.branchId);
}

function collectBranches(skeleton: OrganicSkeletonState): OrganicSkeletonNode[][] {
  const grouped = new Map<string, OrganicSkeletonNode[]>();
  for (const node of skeleton.nodes) {
    const branch = grouped.get(node.branchId);
    if (branch) branch.push(node);
    else grouped.set(node.branchId, [node]);
  }
  return [...grouped.values()]
    .map((branch) => [...branch].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)))
    .sort(branchOrder);
}

function branchPoints(
  branch: readonly OrganicSkeletonNode[],
  nodesById: ReadonlyMap<string, OrganicSkeletonNode>,
): CurvePoint[] {
  const first = branch[0];
  if (!first) return [];
  const points: CurvePoint[] = [];
  if (first.branchId !== ORGANIC_TRUNK_BRANCH_ID && first.parentId) {
    const parent = nodesById.get(first.parentId);
    if (parent) {
      const collarRadius = Math.min(parent.radius, Math.max(first.radius, first.radius * 1.12));
      points.push({ node: parent, position: parent.position, radius: collarRadius });
    }
  }
  for (const node of branch) points.push({ node, position: node.position, radius: node.radius });
  return points;
}

function transportFrame(
  tangent: GrowthVec3,
  previousNormal: GrowthVec3 | null,
): { normal: GrowthVec3; binormal: GrowthVec3 } {
  const fallback = orthonormalBasis(tangent);
  const projected = previousNormal
    ? subtract(previousNormal, scale(tangent, dot(previousNormal, tangent)))
    : fallback.tangent;
  const normal = normalize(projected, fallback.tangent);
  const binormal = normalize(cross(tangent, normal), fallback.bitangent);
  return {
    normal: normalize(cross(binormal, tangent), normal),
    binormal,
  };
}

function buildBranchCurve(
  branch: readonly OrganicSkeletonNode[],
  nodesById: ReadonlyMap<string, OrganicSkeletonNode>,
  config: OrganicSurfaceConfig,
): OrganicBranchCurve | null {
  const points = branchPoints(branch, nodesById);
  if (points.length < 2) return null;
  const steps = Math.max(1, Math.floor(config.curveSamplesPerSegment));
  const samples: OrganicCurveFrameSample[] = [];
  let previousNormal: GrowthVec3 | null = null;
  const segmentCount = points.length - 1;

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const current = points[segmentIndex]!;
    const next = points[segmentIndex + 1]!;
    const p0 = points[Math.max(0, segmentIndex - 1)]!.position;
    const p1 = current.position;
    const p2 = next.position;
    const p3 = points[Math.min(points.length - 1, segmentIndex + 2)]!.position;
    const lastSegment = segmentIndex === segmentCount - 1;
    const sampleLimit = lastSegment ? steps : steps - 1;

    for (let step = 0; step <= sampleLimit; step += 1) {
      const t = step / steps;
      const rawTangent = catmullRomTangent(p0, p1, p2, p3, t);
      const tangent = roundVec(normalize(rawTangent, normalize(subtract(p2, p1))));
      const frame = transportFrame(tangent, previousNormal);
      const sampleIndex = samples.length;
      const normalizedDistance = (segmentIndex + t) / segmentCount;
      const sourceNode = t >= 1 ? next.node : current.node;
      const radius = Math.max(
        config.minimumRadius,
        current.radius + (next.radius - current.radius) * t,
      );
      const sample: OrganicCurveFrameSample = {
        id: `${branch[0]!.branchId}:frame:${sampleIndex}`,
        sourceNodeId: sourceNode.id,
        branchId: branch[0]!.branchId,
        generation: branch[0]!.generation,
        normalizedDistance: round6(normalizedDistance),
        position: roundVec(catmullRom(p0, p1, p2, p3, t)),
        tangent,
        normal: roundVec(frame.normal),
        binormal: roundVec(frame.binormal),
        radius: round6(radius),
      };
      samples.push(sample);
      previousNormal = frame.normal;
    }
  }

  const first = branch[0]!;
  const terminal = branch[branch.length - 1]!;
  return {
    branchId: first.branchId,
    generation: first.generation,
    parentNodeId: first.branchId === ORGANIC_TRUNK_BRANCH_ID ? null : first.parentId,
    terminalNodeId: terminal.id,
    junction: null,
    samples,
  };
}

function closestSample(
  curve: OrganicBranchCurve,
  position: GrowthVec3,
): OrganicCurveFrameSample | null {
  return curve.samples.reduce<OrganicCurveFrameSample | null>((best, sample) => {
    if (!best) return sample;
    return distance(sample.position, position) < distance(best.position, position) ? sample : best;
  }, null);
}

function junctionForCurve(
  curve: OrganicBranchCurve,
  curvesByBranchId: ReadonlyMap<string, OrganicBranchCurve>,
  nodesById: ReadonlyMap<string, OrganicSkeletonNode>,
  config: OrganicSurfaceConfig,
): OrganicJunctionAnchor | null {
  if (!curve.parentNodeId) return null;
  const parentNode = nodesById.get(curve.parentNodeId);
  if (!parentNode) return null;
  const parentCurve = curvesByBranchId.get(parentNode.branchId);
  if (!parentCurve) return null;
  const parentSample = closestSample(parentCurve, parentNode.position);
  const rootSample = curve.samples[0];
  const nextSample = curve.samples.find(
    (sample, index) => index > 0 && distance(sample.position, parentSample?.position ?? parentNode.position) > 1e-6,
  );
  if (!parentSample || !rootSample || !nextSample) return null;

  const childDirection = normalize(
    subtract(nextSample.position, parentSample.position),
    rootSample.tangent,
  );
  const projectedRadial = subtract(
    childDirection,
    scale(parentSample.tangent, dot(childDirection, parentSample.tangent)),
  );
  const radialDirection = normalize(projectedRadial, parentSample.normal);
  const surfacePosition = add(
    parentSample.position,
    scale(radialDirection, parentSample.radius * config.junctionSurfaceRatio),
  );
  const insetPosition = add(
    parentSample.position,
    scale(radialDirection, parentSample.radius * config.junctionInsetRatio),
  );
  const minimumJoinDistance = Math.max(
    parentSample.radius * config.junctionSurfaceRatio,
    rootSample.radius * 1.25,
  );
  const joinSampleIndex = Math.max(
    1,
    curve.samples.findIndex(
      (sample, index) => index > 0 && distance(sample.position, parentSample.position) >= minimumJoinDistance,
    ),
  );
  const resolvedJoinSampleIndex = Math.min(
    curve.samples.length - 1,
    joinSampleIndex < 1 ? 1 : joinSampleIndex,
  );
  const joinSample = curve.samples[resolvedJoinSampleIndex]!;
  const collarRadius = Math.min(
    parentSample.radius * 0.72,
    Math.max(joinSample.radius, rootSample.radius * config.junctionFlare),
  );

  return {
    childBranchId: curve.branchId,
    parentBranchId: parentCurve.branchId,
    parentNodeId: parentNode.id,
    parentPosition: parentSample.position,
    parentRadius: parentSample.radius,
    parentTangent: parentSample.tangent,
    radialDirection: roundVec(radialDirection),
    surfacePosition: roundVec(surfacePosition),
    insetPosition: roundVec(insetPosition),
    childDirection: roundVec(childDirection),
    collarRadius: round6(Math.max(config.minimumRadius, collarRadius)),
    joinSampleIndex: resolvedJoinSampleIndex,
  };
}

export function buildOrganicCurveFrames(
  skeleton: OrganicSkeletonState,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicCurveFrameState {
  const nodesById = new Map(skeleton.nodes.map((node) => [node.id, node]));
  const rawCurves: OrganicBranchCurve[] = [];
  const skippedBranchIds: string[] = [];

  for (const branch of collectBranches(skeleton)) {
    const curve = buildBranchCurve(branch, nodesById, config);
    if (curve) rawCurves.push(curve);
    else if (branch[0]) skippedBranchIds.push(branch[0].branchId);
  }

  const curvesByBranchId = new Map(rawCurves.map((curve) => [curve.branchId, curve]));
  const unresolvedJunctionBranchIds: string[] = [];
  const curves = rawCurves.map((curve) => {
    if (!curve.parentNodeId) return curve;
    const junction = junctionForCurve(curve, curvesByBranchId, nodesById, config);
    if (!junction) unresolvedJunctionBranchIds.push(curve.branchId);
    return { ...curve, junction };
  });

  return {
    organicCurveFrameVersion: 1,
    sourceSkeletonVersion: skeleton.organicSkeletonVersion,
    sourceRulesVersion: skeleton.rulesVersion,
    curves,
    diagnostics: {
      branchCount: curves.length,
      sampleCount: curves.reduce((total, curve) => total + curve.samples.length, 0),
      junctionCount: curves.filter((curve) => curve.junction !== null).length,
      skippedBranchIds,
      unresolvedJunctionBranchIds,
    },
  };
}
