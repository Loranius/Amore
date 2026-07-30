import {
  add,
  cross,
  dot,
  lerp,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from './surfaceTypes';

interface PreparedCurveSamples {
  samples: OrganicCurveFrameSample[];
  junctionRingCount: number;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function sampleByStride(
  samples: readonly OrganicCurveFrameSample[],
  stride: number,
): OrganicCurveFrameSample[] {
  const sampled = samples.filter(
    (_sample, index) => index === 0 || index === samples.length - 1 || index % stride === 0,
  );
  if (sampled.length >= 2) return sampled;
  const first = samples[0];
  const last = samples[samples.length - 1];
  return first && last ? [first, last] : [];
}

function junctionCenters(
  curve: OrganicBranchCurve,
  joinSample: OrganicCurveFrameSample,
  ringCount: number,
): GrowthVec3[] {
  const junction = curve.junction;
  if (!junction || ringCount <= 0) return [];
  const centers: GrowthVec3[] = [junction.insetPosition];
  if (ringCount === 1) return centers;

  centers.push(junction.surfacePosition);
  for (let index = 2; index < ringCount; index += 1) {
    const t = (index - 1) / (ringCount - 1);
    const eased = smoothstep(t);
    const guided = lerp(junction.surfacePosition, joinSample.position, eased);
    const arcLift = Math.sin(Math.PI * t) * junction.parentRadius * 0.08;
    centers.push(add(guided, scale(junction.parentTangent, arcLift)));
  }
  return centers;
}

function frameForJunctionSample(
  tangent: GrowthVec3,
  startNormal: GrowthVec3,
  endNormal: GrowthVec3,
  t: number,
): { normal: GrowthVec3; binormal: GrowthVec3 } {
  const fallback = orthonormalBasis(tangent);
  const desired = lerp(startNormal, endNormal, smoothstep(t));
  const projected = subtract(desired, scale(tangent, dot(desired, tangent)));
  const normal = normalize(projected, fallback.tangent);
  const binormal = normalize(cross(tangent, normal), fallback.bitangent);
  return {
    normal: normalize(cross(binormal, tangent), normal),
    binormal,
  };
}

function buildJunctionSamples(
  curve: OrganicBranchCurve,
  joinSample: OrganicCurveFrameSample,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): OrganicCurveFrameSample[] {
  const junction = curve.junction;
  if (!junction) return [];
  const ringCount = Math.max(1, Math.floor(config.junctionSegmentsByLod[lod]));
  const centers = junctionCenters(curve, joinSample, ringCount);
  const startTangent = normalize(junction.radialDirection, junction.childDirection);
  const basis = orthonormalBasis(startTangent);
  const projectedParentTangent = subtract(
    junction.parentTangent,
    scale(startTangent, dot(junction.parentTangent, startTangent)),
  );
  const startNormal = normalize(projectedParentTangent, basis.tangent);

  return centers.map((position, index) => {
    const previous = centers[index - 1] ?? position;
    const next = centers[index + 1] ?? joinSample.position;
    const tangent = roundVec(normalize(subtract(next, previous), startTangent));
    const t = index / ringCount;
    const frame = frameForJunctionSample(tangent, startNormal, joinSample.normal, t);
    const radius = junction.collarRadius
      + (joinSample.radius - junction.collarRadius) * smoothstep(t);

    return {
      id: `${curve.branchId}:junction:${lod}:${index}`,
      sourceNodeId: junction.parentNodeId,
      branchId: curve.branchId,
      generation: curve.generation,
      normalizedDistance: round6(joinSample.normalizedDistance * t),
      position: roundVec(position),
      tangent,
      normal: roundVec(frame.normal),
      binormal: roundVec(frame.binormal),
      radius: round6(Math.max(config.minimumRadius, radius)),
    };
  });
}

function prepareCurveForLod(
  curve: OrganicBranchCurve,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig,
): PreparedCurveSamples {
  const stride = Math.max(1, Math.floor(config.axialStrideByLod[lod]));
  if (!curve.junction) {
    return {
      samples: sampleByStride(curve.samples, stride),
      junctionRingCount: 0,
    };
  }

  const joinIndex = Math.min(
    curve.samples.length - 1,
    Math.max(1, curve.junction.joinSampleIndex),
  );
  const tail = sampleByStride(curve.samples.slice(joinIndex), stride);
  const joinSample = tail[0];
  if (!joinSample) return { samples: [], junctionRingCount: 0 };
  const junctionSamples = buildJunctionSamples(curve, joinSample, lod, config);
  return {
    samples: [...junctionSamples, ...tail],
    junctionRingCount: junctionSamples.length,
  };
}

function pushVec(target: number[], vector: GrowthVec3): void {
  target.push(round6(vector.x), round6(vector.y), round6(vector.z));
}

function addRing(
  positions: number[],
  normals: number[],
  uvs: number[],
  sample: OrganicCurveFrameSample,
  ringIndex: number,
  ringCount: number,
  radialSegments: number,
): void {
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const angle = radialIndex / radialSegments * Math.PI * 2;
    const radialNormal = normalize(add(
      scale(sample.normal, Math.cos(angle)),
      scale(sample.binormal, Math.sin(angle)),
    ));
    pushVec(positions, add(sample.position, scale(radialNormal, sample.radius)));
    pushVec(normals, radialNormal);
    uvs.push(
      ringCount <= 1 ? 0 : round6(ringIndex / (ringCount - 1)),
      round6(radialIndex / radialSegments),
    );
  }
}

function addTubeIndices(
  indices: number[],
  firstVertex: number,
  ringCount: number,
  radialSegments: number,
): void {
  for (let ringIndex = 0; ringIndex < ringCount - 1; ringIndex += 1) {
    const currentRing = firstVertex + ringIndex * radialSegments;
    const nextRing = currentRing + radialSegments;
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadial = (radialIndex + 1) % radialSegments;
      const a = currentRing + radialIndex;
      const b = nextRing + radialIndex;
      const c = nextRing + nextRadial;
      const d = currentRing + nextRadial;
      indices.push(a, d, b, b, d, c);
    }
  }
}

function addCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  sample: OrganicCurveFrameSample,
  radialSegments: number,
  outwardNormal: GrowthVec3,
  reverse: boolean,
): void {
  const capNormal = normalize(outwardNormal);
  const centerVertex = positions.length / 3;
  pushVec(positions, sample.position);
  pushVec(normals, capNormal);
  uvs.push(0.5, 0.5);

  const capRingStart = positions.length / 3;
  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const angle = radialIndex / radialSegments * Math.PI * 2;
    const radialNormal = normalize(add(
      scale(sample.normal, Math.cos(angle)),
      scale(sample.binormal, Math.sin(angle)),
    ));
    pushVec(positions, add(sample.position, scale(radialNormal, sample.radius)));
    pushVec(normals, capNormal);
    uvs.push(
      round6(0.5 + Math.cos(angle) * 0.5),
      round6(0.5 + Math.sin(angle) * 0.5),
    );
  }

  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    const current = capRingStart + radialIndex;
    const next = capRingStart + (radialIndex + 1) % radialSegments;
    if (reverse) indices.push(centerVertex, next, current);
    else indices.push(centerVertex, current, next);
  }
}

export function buildOrganicSweepMesh(
  frameState: OrganicCurveFrameState,
  lod: OrganicMeshLod,
  config: OrganicSurfaceConfig = DEFAULT_ORGANIC_SURFACE_CONFIG,
): OrganicSweepMesh {
  const radialSegments = Math.max(3, Math.floor(config.radialSegmentsByLod[lod]));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const branches: OrganicSweepMesh['branches'] = [];
  let ringCount = 0;
  let junctionRingCount = 0;

  for (const curve of frameState.curves) {
    const prepared = prepareCurveForLod(curve, lod, config);
    const samples = prepared.samples;
    if (samples.length < 2) continue;
    const firstVertex = positions.length / 3;
    const firstIndex = indices.length;

    samples.forEach((sample, index) => {
      addRing(positions, normals, uvs, sample, index, samples.length, radialSegments);
    });
    addTubeIndices(indices, firstVertex, samples.length, radialSegments);

    if (curve.branchId === 'organic:trunk') {
      addCap(
        positions,
        normals,
        uvs,
        indices,
        samples[0]!,
        radialSegments,
        scale(samples[0]!.tangent, -1),
        true,
      );
    }
    addCap(
      positions,
      normals,
      uvs,
      indices,
      samples[samples.length - 1]!,
      radialSegments,
      samples[samples.length - 1]!.tangent,
      false,
    );

    ringCount += samples.length;
    junctionRingCount += prepared.junctionRingCount;
    branches.push({
      branchId: curve.branchId,
      firstVertex,
      vertexCount: positions.length / 3 - firstVertex,
      firstIndex,
      indexCount: indices.length - firstIndex,
      ringCount: samples.length,
      junctionRingCount: prepared.junctionRingCount,
      radialSegments,
    });
  }

  return {
    organicSweepMeshVersion: 1,
    lod,
    sourceRulesVersion: frameState.sourceRulesVersion,
    positions,
    normals,
    uvs,
    indices,
    branches,
    diagnostics: {
      branchCount: branches.length,
      junctionCount: branches.filter((branch) => branch.junctionRingCount > 0).length,
      ringCount,
      junctionRingCount,
      vertexCount: positions.length / 3,
      triangleCount: indices.length / 3,
    },
  };
}
