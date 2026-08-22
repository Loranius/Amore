import {
  clamp,
  distance,
  lerp,
  normalize,
  round6,
  roundVec,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
} from '../labs/organic';
import type {
  BuildTreeGroundContactInput,
  TreeGroundContactRootDescriptor,
  TreeGroundContactState,
} from './types';

function validateInput(input: BuildTreeGroundContactInput): void {
  const { species, roots, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Ground Contact requires a non-empty rulesVersion.');
  }
  if (species.artifactSeed !== roots.artifactSeed) {
    throw new Error('Tree Ground Contact received roots from another artifact.');
  }
  for (const [name, value] of [
    ['burialDepthBaseRadiusRatio', config.burialDepthBaseRadiusRatio],
    ['minimumBurialDepth', config.minimumBurialDepth],
    ['maximumBurialDepth', config.maximumBurialDepth],
    ['collarHeightBaseRadiusRatio', config.collarHeightBaseRadiusRatio],
    ['collarBottomRadiusRatio', config.collarBottomRadiusRatio],
    ['collarTopRadiusRatio', config.collarTopRadiusRatio],
    ['collarProfileExponent', config.collarProfileExponent],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Tree Ground Contact ${name} must be positive and finite.`);
    }
  }
  if (config.minimumBurialDepth > config.maximumBurialDepth) {
    throw new Error('Tree Ground Contact minimum burial depth cannot exceed maximum burial depth.');
  }
  if (config.collarBottomRadiusRatio < config.collarTopRadiusRatio) {
    throw new Error('Tree Ground Contact collar must taper toward the trunk.');
  }
  if (config.collarProfileExponent <= 1) {
    throw new Error('Tree Ground Contact collar profile exponent must be greater than one.');
  }
  for (const lod of ['high', 'medium', 'low'] as const) {
    const segments = config.collarRadialSegmentsByLod[lod];
    if (!Number.isInteger(segments) || segments < 3) {
      throw new Error(`Tree Ground Contact ${lod} collar requires at least three segments.`);
    }
  }
}

function pathLength(samples: readonly OrganicCurveFrameSample[]): number {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    total += distance(samples[index - 1]!.position, samples[index]!.position);
  }
  return round6(total);
}

function interpolateSample(
  previous: OrganicCurveFrameSample,
  next: OrganicCurveFrameSample,
  groundLevelY: number,
): OrganicCurveFrameSample {
  const denominator = previous.position.y - next.position.y;
  const t = denominator <= 1e-9
    ? 1
    : clamp((previous.position.y - groundLevelY) / denominator, 0, 1);
  const fallbackTangent = previous.tangent;
  return {
    id: `${previous.branchId}:ground-contact`,
    sourceNodeId: next.sourceNodeId,
    branchId: previous.branchId,
    generation: previous.generation,
    normalizedDistance: round6(
      previous.normalizedDistance
        + (next.normalizedDistance - previous.normalizedDistance) * t,
    ),
    position: roundVec({ ...lerp(previous.position, next.position, t), y: groundLevelY }),
    tangent: roundVec(normalize(lerp(previous.tangent, next.tangent, t), fallbackTangent)),
    normal: roundVec(normalize(lerp(previous.normal, next.normal, t), previous.normal)),
    binormal: roundVec(normalize(lerp(previous.binormal, next.binormal, t), previous.binormal)),
    radius: round6(previous.radius + (next.radius - previous.radius) * t),
  };
}

function clipCurve(
  curve: OrganicBranchCurve,
  groundLevelY: number,
): { curve: OrganicBranchCurve; descriptor: TreeGroundContactRootDescriptor } | null {
  const source = curve.samples;
  if (source.length < 2) return null;

  const visible: OrganicCurveFrameSample[] = [source[0]!];
  for (let index = 1; index < source.length; index += 1) {
    const previous = source[index - 1]!;
    const current = source[index]!;
    if (current.position.y >= groundLevelY) {
      visible.push(current);
      continue;
    }
    visible.push(interpolateSample(previous, current, groundLevelY));
    break;
  }

  if (visible.length < 2) {
    visible.push(interpolateSample(source[0]!, source[1]!, groundLevelY));
  }

  const retainedSourceIds = new Set(visible.map((sample) => sample.id));
  const buriedSampleIds = source
    .filter((sample) => !retainedSourceIds.has(sample.id))
    .map((sample) => sample.id);
  const sourcePathLength = pathLength(source);
  const visiblePathLength = pathLength(visible);

  return {
    curve: {
      ...curve,
      terminalNodeId: `${curve.branchId}:ground-contact-terminal`,
      samples: visible,
    },
    descriptor: {
      rootId: curve.branchId,
      sourceSampleCount: source.length,
      visibleSampleCount: visible.length,
      sourcePathLength,
      visiblePathLength,
      visibleFraction: sourcePathLength <= 1e-9
        ? 0
        : round6(visiblePathLength / sourcePathLength),
      buriedSampleIds,
    },
  };
}

/**
 * Pure contact layer. Accepted root curves remain immutable; this state exposes
 * stable visible prefixes and a future terrain binding at an explicit Y level.
 */
export function buildTreeGroundContact(
  input: BuildTreeGroundContactInput,
): TreeGroundContactState {
  validateInput(input);
  const { species, roots, config } = input;
  const firstSample = roots.frames.curves[0]?.samples[0];
  const basePosition: GrowthVec3 = firstSample?.position ?? { x: 0, y: 0, z: 0 };
  const burialDepth = round6(clamp(
    species.structure.baseRadius * config.burialDepthBaseRadiusRatio,
    config.minimumBurialDepth,
    config.maximumBurialDepth,
  ));
  const groundLevelY = round6(basePosition.y - burialDepth);
  const clipped = roots.frames.curves
    .map((curve) => clipCurve(curve, groundLevelY))
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const visibleCurves = clipped.map((value) => value.curve);
  const rootDescriptors = clipped.map((value) => value.descriptor);
  const visibleIds = new Set(visibleCurves.map((curve) => curve.branchId));
  const missingRootCurveIds = roots.roots
    .map((root) => root.id)
    .filter((id) => !visibleIds.has(id));
  const sourceSampleCount = roots.frames.diagnostics.sampleCount;
  const visibleSampleCount = visibleCurves.reduce((sum, curve) => sum + curve.samples.length, 0);
  const sourcePathLength = rootDescriptors.reduce((sum, root) => sum + root.sourcePathLength, 0);
  const visiblePathLength = rootDescriptors.reduce((sum, root) => sum + root.visiblePathLength, 0);
  const collarHeight = round6(species.structure.baseRadius * config.collarHeightBaseRadiusRatio);

  return {
    treeGroundContactVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceRootArchitectureVersion: roots.treeRootArchitectureVersion,
    sourceRootRulesVersion: roots.rulesVersion,
    artifactSeed: species.artifactSeed,
    ground: {
      id: 'tree:ground:contact-plane',
      levelY: groundLevelY,
      normal: { x: 0, y: 1, z: 0 },
      terrainBindingId: 'tree:terrain:future',
    },
    burialDepth,
    roots: rootDescriptors,
    visibleRootFrames: {
      organicCurveFrameVersion: 1,
      sourceSkeletonVersion: roots.frames.sourceSkeletonVersion,
      sourceRulesVersion: config.rulesVersion.trim(),
      curves: visibleCurves,
      diagnostics: {
        branchCount: visibleCurves.length,
        sampleCount: visibleSampleCount,
        junctionCount: 0,
        skippedBranchIds: missingRootCurveIds,
        unresolvedJunctionBranchIds: [],
      },
    },
    collar: {
      id: 'tree:ground:trunk-collar',
      center: { ...basePosition },
      bottomY: groundLevelY,
      topY: round6(basePosition.y + collarHeight),
      bottomRadius: round6(species.structure.baseRadius * config.collarBottomRadiusRatio),
      topRadius: round6(species.structure.baseRadius * config.collarTopRadiusRatio),
      ringCount: 7,
      profileExponent: round6(config.collarProfileExponent),
      radialSegmentsByLod: { ...config.collarRadialSegmentsByLod },
    },
    diagnostics: {
      sourceRootCount: roots.roots.length,
      visibleRootCount: visibleCurves.length,
      sourceSampleCount,
      visibleSampleCount,
      buriedSampleCount: Math.max(0, sourceSampleCount - visibleSampleCount),
      visiblePathFraction: sourcePathLength <= 1e-9
        ? 0
        : round6(visiblePathLength / sourcePathLength),
      groundLevelY,
      burialDepth,
      missingRootCurveIds,
      appendOnlyPrefixPreserved: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
    },
  };
}
