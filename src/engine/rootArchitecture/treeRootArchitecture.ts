import {
  add,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
} from '../labs/organic';
import type {
  BuildTreeRootArchitectureInput,
  TreeRootArchitectureState,
  TreeRootDescriptor,
  TreeRootKind,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function validateInput(input: BuildTreeRootArchitectureInput): void {
  const { config, species, composition, frames } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Root Architecture requires a non-empty rulesVersion.');
  }
  for (const [name, value] of [
    ['minimumRoots', config.minimumRoots],
    ['maximumRoots', config.maximumRoots],
    ['samplesPerRoot', config.samplesPerRoot],
    ['maximumSamples', config.maximumSamples],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Tree Root Architecture ${name} must be a non-negative integer.`);
    }
  }
  if (config.minimumRoots > config.maximumRoots) {
    throw new Error('Tree Root Architecture minimumRoots cannot exceed maximumRoots.');
  }
  if (config.samplesPerRoot < 2) {
    throw new Error('Tree Root Architecture samplesPerRoot must be at least two.');
  }
  if (species.artifactSeed !== composition.artifactSeed) {
    throw new Error('Tree Root Architecture received composition from another artifact.');
  }
  if (composition.sourceFrameVersion !== frames.organicCurveFrameVersion) {
    throw new Error('Tree Root Architecture composition and curve-frame versions do not match.');
  }
}

function targetRootCount(ageDays: number, minimum: number, maximum: number): number {
  const ageStep = Math.floor(Math.log2(1 + Math.max(0, ageDays) / 45));
  return Math.min(maximum, Math.max(minimum, minimum + ageStep));
}

function rootKind(seed: number, sequence: number): TreeRootKind {
  return seededUnit(seed, `tree-root:${sequence}:kind`) < 0.68 ? 'surface' : 'near-surface';
}

function pointAt(
  base: GrowthVec3,
  azimuthRad: number,
  bendRad: number,
  length: number,
  maximumDepth: number,
  kind: TreeRootKind,
  t: number,
): GrowthVec3 {
  const angle = azimuthRad + bendRad * t * t;
  const radialDistance = length * Math.pow(t, 0.88);
  const surfaceLift = kind === 'surface' ? Math.sin(Math.PI * t) * 0.035 : 0;
  const depth = maximumDepth * (0.22 * t + 0.78 * Math.pow(t, 1.45));
  return roundVec({
    x: base.x + Math.cos(angle) * radialDistance,
    y: base.y - depth + surfaceLift,
    z: base.z + Math.sin(angle) * radialDistance,
  });
}

function createRoot(
  input: BuildTreeRootArchitectureInput,
  trunkBase: OrganicCurveFrameSample,
  sequence: number,
): { descriptor: TreeRootDescriptor; curve: OrganicBranchCurve } {
  const { species, config } = input;
  const id = `tree:root:${sequence}`;
  const kind = rootKind(species.artifactSeed, sequence);
  const azimuthJitter = (seededUnit(species.artifactSeed, `${id}:azimuth`) - 0.5) * 0.42;
  const azimuthRad = round6((sequence * GOLDEN_ANGLE + azimuthJitter) % (Math.PI * 2));
  const bendRad = round6((seededUnit(species.artifactSeed, `${id}:bend`) - 0.5) * 0.72);
  const length = round6(species.structure.crownRadius * (
    0.42 + seededUnit(species.artifactSeed, `${id}:length`) * 0.34
  ));
  const depthScale = kind === 'surface'
    ? 0.07 + seededUnit(species.artifactSeed, `${id}:depth`) * 0.08
    : 0.18 + seededUnit(species.artifactSeed, `${id}:depth`) * 0.16;
  const maximumDepth = round6(Math.max(0.025, depthScale * Math.max(0.6, species.structure.baseRadius * 2.4)));
  const startRadius = round6(Math.max(
    0.035,
    species.structure.baseRadius * (0.4 - (sequence % 4) * 0.035),
  ));
  const endRadius = round6(Math.max(0.014, startRadius * 0.18));
  const positions = Array.from({ length: config.samplesPerRoot }, (_value, index) => {
    const t = index / (config.samplesPerRoot - 1);
    return pointAt(
      trunkBase.position,
      azimuthRad,
      bendRad,
      length,
      maximumDepth,
      kind,
      t,
    );
  });
  const samples: OrganicCurveFrameSample[] = positions.map((position, index) => {
    const previous = positions[index - 1] ?? position;
    const next = positions[index + 1] ?? position;
    const fallback: GrowthVec3 = {
      x: Math.cos(azimuthRad),
      y: kind === 'surface' ? -0.04 : -0.18,
      z: Math.sin(azimuthRad),
    };
    const tangent = roundVec(normalize(subtract(next, previous), fallback));
    const basis = orthonormalBasis(tangent);
    const t = index / (positions.length - 1);
    const radius = round6(Math.max(endRadius, startRadius * Math.pow(1 - t, 1.28)));
    return {
      id: `${id}:sample:${index}`,
      sourceNodeId: trunkBase.sourceNodeId,
      branchId: id,
      generation: 0,
      normalizedDistance: round6(t),
      position,
      tangent,
      normal: roundVec(basis.tangent),
      binormal: roundVec(basis.bitangent),
      radius,
    };
  });
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const descriptor: TreeRootDescriptor = {
    id,
    sequence,
    kind,
    azimuthRad,
    bendRad,
    length,
    maximumDepth,
    startRadius,
    endRadius,
    startPosition: first.position,
    terminalPosition: last.position,
    sampleIds: samples.map((sample) => sample.id),
  };
  return {
    descriptor,
    curve: {
      branchId: id,
      generation: 0,
      parentNodeId: trunkBase.sourceNodeId,
      terminalNodeId: `${id}:terminal`,
      junction: null,
      samples,
    },
  };
}

/**
 * Pure append-only root architecture. Root descriptors depend only on stable
 * artifact DNA, the immutable trunk base and their sequence; age only exposes
 * a longer prefix of the mature root system.
 */
export function buildTreeRootArchitecture(
  input: BuildTreeRootArchitectureInput,
): TreeRootArchitectureState {
  validateInput(input);
  const { species, frames, config } = input;
  const trunkBase = frames.curves.find((curve) => curve.branchId === 'organic:trunk')?.samples[0];
  const candidateRootCount = targetRootCount(
    species.state.ageDays,
    config.minimumRoots,
    config.maximumRoots,
  );
  const sampleCapacity = Math.floor(config.maximumSamples / config.samplesPerRoot);
  const emittedRootCount = trunkBase ? Math.min(candidateRootCount, sampleCapacity) : 0;
  const emitted = trunkBase
    ? Array.from({ length: emittedRootCount }, (_value, sequence) => createRoot(input, trunkBase, sequence))
    : [];
  const roots = emitted.map((item) => item.descriptor);
  const curves = emitted.map((item) => item.curve);
  const truncatedRootIds = Array.from(
    { length: Math.max(0, candidateRootCount - emittedRootCount) },
    (_value, index) => `tree:root:${emittedRootCount + index}`,
  );

  return {
    treeRootArchitectureVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceFrameVersion: frames.organicCurveFrameVersion,
    artifactSeed: species.artifactSeed,
    roots,
    frames: {
      organicCurveFrameVersion: 1,
      sourceSkeletonVersion: frames.sourceSkeletonVersion,
      sourceRulesVersion: config.rulesVersion.trim(),
      curves,
      diagnostics: {
        branchCount: curves.length,
        sampleCount: curves.reduce((sum, curve) => sum + curve.samples.length, 0),
        junctionCount: 0,
        skippedBranchIds: [],
        unresolvedJunctionBranchIds: [],
      },
    },
    diagnostics: {
      missingTrunkBase: !trunkBase,
      candidateRootCount,
      emittedRootCount: roots.length,
      surfaceRootCount: roots.filter((root) => root.kind === 'surface').length,
      nearSurfaceRootCount: roots.filter((root) => root.kind === 'near-surface').length,
      sampleCount: curves.reduce((sum, curve) => sum + curve.samples.length, 0),
      rootBudget: config.maximumRoots,
      sampleBudget: config.maximumSamples,
      truncatedRootIds,
    },
  };
}
