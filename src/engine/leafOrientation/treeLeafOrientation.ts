import {
  add,
  dot,
  normalize,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type { TreeLeafInstance } from '../leafGeometry';
import type { TreeCanopyDepthProfile } from '../canopyDepth';
import type {
  BuildTreeLeafOrientationInput,
  TreeLeafOrientationProfile,
  TreeLeafOrientationState,
} from './types';

function validateInput(input: BuildTreeLeafOrientationInput): void {
  const { leaves, canopyDepth, canopyLight, phenology, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Leaf Orientation requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.quantizationBands)
    || config.quantizationBands < 3
    || config.quantizationBands > 65
    || config.quantizationBands % 2 === 0) {
    throw new Error('Tree Leaf Orientation quantizationBands must be an odd integer between 3 and 65.');
  }
  if (!Number.isFinite(config.minimumFrontFacingDot)
    || config.minimumFrontFacingDot < 0
    || config.minimumFrontFacingDot > 1) {
    throw new Error('Tree Leaf Orientation minimumFrontFacingDot must be in [0, 1].');
  }
  for (const layer of ['inner', 'middle', 'outer'] as const) {
    const bounds = config.orientationByLayer[layer];
    for (const [name, value] of Object.entries(bounds)) {
      if (!Number.isFinite(value) || value < 0 || value > 0.35) {
        throw new Error(`Tree Leaf Orientation ${layer}.${name} must be in [0, 0.35].`);
      }
    }
    const facingStrength = config.frontFacingStrengthByLayer[layer];
    if (!Number.isFinite(facingStrength) || facingStrength < 0 || facingStrength > 1) {
      throw new Error(`Tree Leaf Orientation frontFacingStrengthByLayer.${layer} must be in [0, 1].`);
    }
  }
  if (leaves.artifactSeed !== canopyDepth.artifactSeed
    || leaves.artifactSeed !== canopyLight.artifactSeed
    || leaves.artifactSeed !== phenology.artifactSeed) {
    throw new Error('Tree Leaf Orientation received states from different artifacts.');
  }
  if (canopyDepth.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyDepth.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyDepth.lod !== leaves.lod) {
    throw new Error('Tree Leaf Orientation Canopy Depth provenance does not match leaves.');
  }
  if (canopyLight.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyLight.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyLight.sourceCanopyDepthSignature !== canopyDepth.signature
    || canopyLight.lod !== leaves.lod) {
    throw new Error('Tree Leaf Orientation Canopy Light provenance does not match.');
  }
  if (phenology.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || phenology.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || phenology.sourceCanopyLightSignature !== canopyLight.signature
    || phenology.lod !== leaves.lod) {
    throw new Error('Tree Leaf Orientation Phenology provenance does not match.');
  }
  if (canopyDepth.profiles.length !== leaves.instances.length
    || canopyLight.profiles.length !== leaves.instances.length
    || phenology.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Leaf Orientation requires one upstream profile per accepted leaf.');
  }
}

function quantizedSigned(
  seed: number,
  key: string,
  maximum: number,
  bands: number,
): number {
  if (maximum === 0) return 0;
  const band = Math.min(bands - 1, Math.floor(seededUnit(seed, key) * bands));
  const normalized = band / (bands - 1) * 2 - 1;
  return round6(normalized * maximum);
}

interface PresentationNormalResult {
  presentationNormal: GrowthVec3;
  sourceFacingDot: number;
  renderFacingDot: number;
  frontFacingAdjusted: boolean;
  candidate: boolean;
}

function buildPresentationNormal(
  leaf: TreeLeafInstance,
  depth: TreeCanopyDepthProfile,
  input: BuildTreeLeafOrientationInput,
): PresentationNormalResult {
  const frontDirection = normalize(
    input.canopyDepth.diagnostics.presentationFrontDirection,
    { x: 0, y: 0, z: 1 },
  );
  const leafDirection = normalize(leaf.direction, { x: 0, y: 1, z: 0 });
  const projectedFront = normalize(
    subtract(frontDirection, scale(leafDirection, dot(frontDirection, leafDirection))),
    leaf.normal,
  );
  const sourceNormal = normalize(leaf.normal, projectedFront);
  const alignedSource = dot(sourceNormal, projectedFront) < 0
    ? scale(sourceNormal, -1)
    : sourceNormal;
  const candidate = depth.renderFrontDepth >= 0 || depth.presentationShifted;
  const sourceFacingDot = round6(Math.abs(dot(sourceNormal, projectedFront)));

  if (!candidate) {
    return {
      presentationNormal: roundVec(sourceNormal),
      sourceFacingDot,
      renderFacingDot: sourceFacingDot,
      frontFacingAdjusted: false,
      candidate: false,
    };
  }

  const baseStrength = input.config.frontFacingStrengthByLayer[depth.layer];
  const variation = 0.92 + seededUnit(
    input.leaves.artifactSeed,
    `${leaf.id}:front-facing-strength`,
  ) * 0.16;
  const strength = Math.min(1, Math.max(
    input.config.minimumFrontFacingDot,
    baseStrength * variation,
  ));
  const presentationNormal = normalize(
    add(
      scale(alignedSource, 1 - strength),
      scale(projectedFront, strength),
    ),
    projectedFront,
  );
  const renderFacingDot = round6(Math.abs(dot(presentationNormal, projectedFront)));

  return {
    presentationNormal: roundVec(presentationNormal),
    sourceFacingDot,
    renderFacingDot,
    frontFacingAdjusted: renderFacingDot > sourceFacingDot + 1e-6,
    candidate: true,
  };
}

function signatureFor(state: Omit<TreeLeafOrientationState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.sourcePhenologySignature,
    state.profiles.length,
    state.diagnostics.innerLeafCount,
    state.diagnostics.middleLeafCount,
    state.diagnostics.outerLeafCount,
    state.diagnostics.frontFacingAdjustedLeafCount,
    state.diagnostics.averageRenderFacingDot.toFixed(6),
    state.diagnostics.maximumRotationRad.toFixed(6),
    state.diagnostics.averageRotationRad.toFixed(6),
  ].join('|');
}

/**
 * Publishes deterministic local rotations and stable presentation normals for
 * accepted leaves. Positions, colors, IDs, crown cells and Tree Life state stay untouched.
 */
export function buildTreeLeafOrientation(
  input: BuildTreeLeafOrientationInput,
): TreeLeafOrientationState {
  validateInput(input);
  const profiles: TreeLeafOrientationProfile[] = [];
  let innerLeafCount = 0;
  let middleLeafCount = 0;
  let outerLeafCount = 0;
  let nonZeroProfileCount = 0;
  let frontFacingAdjustedLeafCount = 0;
  let frontFacingCandidateCount = 0;
  let sourceFacingSum = 0;
  let renderFacingSum = 0;
  const sourceFacingValues: number[] = [];
  const renderFacingValues: number[] = [];

  for (let index = 0; index < input.leaves.instances.length; index += 1) {
    const leaf = input.leaves.instances[index]!;
    const depth = input.canopyDepth.profiles[index]!;
    const light = input.canopyLight.profiles[index]!;
    const phenology = input.phenology.profiles[index]!;
    if (depth.leafInstanceId !== leaf.id
      || light.leafInstanceId !== leaf.id
      || light.canopyProfileId !== depth.id
      || phenology.leafInstanceId !== leaf.id
      || phenology.canopyLightProfileId !== light.id) {
      throw new Error(`Tree Leaf Orientation cannot resolve upstream profiles for "${leaf.id}".`);
    }

    const facing = buildPresentationNormal(leaf, depth, input);
    const bounds = input.config.orientationByLayer[depth.layer];
    const tiltRad = quantizedSigned(
      input.leaves.artifactSeed,
      `${leaf.id}:leaf-orientation:tilt`,
      bounds.maximumTiltRad,
      input.config.quantizationBands,
    );
    const fanRad = quantizedSigned(
      input.leaves.artifactSeed,
      `${leaf.id}:leaf-orientation:fan`,
      bounds.maximumFanRad,
      input.config.quantizationBands,
    );
    const twistRad = quantizedSigned(
      input.leaves.artifactSeed,
      `${leaf.id}:leaf-orientation:twist`,
      bounds.maximumTwistRad,
      input.config.quantizationBands,
    );
    const totalRotationRad = round6(Math.hypot(tiltRad, fanRad, twistRad));

    if (depth.layer === 'inner') innerLeafCount += 1;
    else if (depth.layer === 'middle') middleLeafCount += 1;
    else outerLeafCount += 1;
    if (totalRotationRad > 1e-9) nonZeroProfileCount += 1;
    if (facing.candidate) {
      frontFacingCandidateCount += 1;
      sourceFacingSum += facing.sourceFacingDot;
      renderFacingSum += facing.renderFacingDot;
      sourceFacingValues.push(facing.sourceFacingDot);
      renderFacingValues.push(facing.renderFacingDot);
    }
    if (facing.frontFacingAdjusted) frontFacingAdjustedLeafCount += 1;

    profiles.push({
      id: `tree:leaf-orientation:${leaf.id}`,
      leafInstanceId: leaf.id,
      canopyDepthProfileId: depth.id,
      canopyLightProfileId: light.id,
      phenologyProfileId: phenology.id,
      sequence: leaf.sequence,
      layer: depth.layer,
      presentationNormal: facing.presentationNormal,
      sourceFacingDot: facing.sourceFacingDot,
      renderFacingDot: facing.renderFacingDot,
      frontFacingAdjusted: facing.frontFacingAdjusted,
      tiltRad,
      fanRad,
      twistRad,
      totalRotationRad,
    });
  }

  const rotations = profiles.map((profile) => profile.totalRotationRad);
  const minimumRotationRad = rotations.length > 0 ? Math.min(...rotations) : 0;
  const maximumRotationRad = rotations.length > 0 ? Math.max(...rotations) : 0;
  const averageRotationRad = rotations.length > 0
    ? rotations.reduce((sum, value) => sum + value, 0) / rotations.length
    : 0;
  const averageSourceFacingDot = frontFacingCandidateCount > 0
    ? sourceFacingSum / frontFacingCandidateCount
    : 0;
  const averageRenderFacingDot = frontFacingCandidateCount > 0
    ? renderFacingSum / frontFacingCandidateCount
    : 0;
  if (averageRenderFacingDot + 1e-6 < averageSourceFacingDot) {
    throw new Error('Tree Leaf Orientation front-facing projection must not reduce front readability.');
  }
  const stableLeafOrderPreserved = profiles.every((profile, index) => (
    profile.sequence === input.leaves.instances[index]?.sequence
    && profile.leafInstanceId === input.leaves.instances[index]?.id
  ));
  if (!stableLeafOrderPreserved || profiles.length !== input.leaves.instances.length) {
    throw new Error('Tree Leaf Orientation must preserve accepted leaf order and instance count.');
  }

  const stateWithoutSignature: Omit<TreeLeafOrientationState, 'signature'> = {
    treeLeafOrientationVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: input.leaves.rulesVersion,
    sourceCanopyDepthVersion: input.canopyDepth.treeCanopyDepthVersion,
    sourceCanopyDepthRulesVersion: input.canopyDepth.rulesVersion,
    sourceCanopyDepthSignature: input.canopyDepth.signature,
    sourceCanopyLightVersion: input.canopyLight.treeCanopyLightVersion,
    sourceCanopyLightRulesVersion: input.canopyLight.rulesVersion,
    sourceCanopyLightSignature: input.canopyLight.signature,
    sourcePhenologyVersion: input.phenology.treePhenologyVersion,
    sourcePhenologyRulesVersion: input.phenology.rulesVersion,
    sourcePhenologySignature: input.phenology.signature,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    descriptor: {
      id: 'tree:leaf-orientation:micro-variation',
      profileId: 'tree:leaf-orientation:instance-profile',
      matrixAttributeId: 'tree:leaf-orientation:instance-matrix',
      sourceGeometryId: 'tree:leaf:instances',
    },
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      innerLeafCount,
      middleLeafCount,
      outerLeafCount,
      nonZeroProfileCount,
      frontFacingAdjustedLeafCount,
      frontFacingCandidateCount,
      minimumSourceFacingDot: round6(sourceFacingValues.length > 0 ? Math.min(...sourceFacingValues) : 0),
      minimumRenderFacingDot: round6(renderFacingValues.length > 0 ? Math.min(...renderFacingValues) : 0),
      averageSourceFacingDot: round6(averageSourceFacingDot),
      averageRenderFacingDot: round6(averageRenderFacingDot),
      frontFacingNotReduced: true,
      minimumRotationRad: round6(minimumRotationRad),
      maximumRotationRad: round6(maximumRotationRad),
      averageRotationRad: round6(averageRotationRad),
      quantizationBands: input.config.quantizationBands,
      stableLeafOrderPreserved: true,
      instanceCountPreserved: true,
      canopyDepthProvenancePreserved: true,
      canopyLightProvenancePreserved: true,
      phenologyProvenancePreserved: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };

  return {
    ...stateWithoutSignature,
    signature: signatureFor(stateWithoutSignature),
  };
}