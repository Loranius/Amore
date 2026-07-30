import {
  clamp,
  round6,
  roundVec,
} from '../growth/math';
import type { TreeSilhouette } from '../composition';
import type {
  BuildTreeCrownSilhouetteInput,
  TreeCrownSilhouetteProfile,
  TreeCrownSilhouetteState,
} from './types';

const TAU = Math.PI * 2;
const EPSILON = 1e-9;

function validateInput(input: BuildTreeCrownSilhouetteInput): void {
  const {
    composition,
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    leafOrientation,
    config,
  } = input;

  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Crown Silhouette requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.azimuthSectorCount)
    || config.azimuthSectorCount < 8
    || config.azimuthSectorCount > 64) {
    throw new Error('Tree Crown Silhouette azimuthSectorCount must be an integer between 8 and 64.');
  }
  if (!Number.isInteger(config.verticalBandCount)
    || config.verticalBandCount < 3
    || config.verticalBandCount > 16) {
    throw new Error('Tree Crown Silhouette verticalBandCount must be an integer between 3 and 16.');
  }
  if (!Number.isFinite(config.maximumRadialOffsetRatio)
    || config.maximumRadialOffsetRatio < 0
    || config.maximumRadialOffsetRatio > 0.08) {
    throw new Error('Tree Crown Silhouette maximumRadialOffsetRatio must stay in [0, 0.08].');
  }
  if (!Number.isFinite(config.maximumScaleDelta)
    || config.maximumScaleDelta < 0
    || config.maximumScaleDelta > 0.12) {
    throw new Error('Tree Crown Silhouette maximumScaleDelta must stay in [0, 0.12].');
  }
  if (!Number.isFinite(config.envelopeResponse)
    || config.envelopeResponse <= 0
    || config.envelopeResponse > 1) {
    throw new Error('Tree Crown Silhouette envelopeResponse must stay in (0, 1].');
  }
  if (!Number.isFinite(composition.bounds.radius) || composition.bounds.radius <= 0) {
    throw new Error('Tree Crown Silhouette requires a positive accepted crown radius.');
  }
  if (!Number.isFinite(composition.bounds.height) || composition.bounds.height <= 0) {
    throw new Error('Tree Crown Silhouette requires a positive accepted crown height.');
  }

  const artifactSeed = leaves.artifactSeed;
  if (composition.artifactSeed !== artifactSeed
    || canopyDepth.artifactSeed !== artifactSeed
    || canopyLight.artifactSeed !== artifactSeed
    || phenology.artifactSeed !== artifactSeed
    || leafOrientation.artifactSeed !== artifactSeed) {
    throw new Error('Tree Crown Silhouette received states from different artifacts.');
  }
  if (canopyDepth.sourceCompositionVersion !== composition.treeCompositionVersion
    || canopyDepth.sourceCompositionRulesVersion !== composition.rulesVersion
    || canopyDepth.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyDepth.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyDepth.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Canopy Depth provenance does not match.');
  }
  if (canopyLight.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyLight.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyLight.sourceCanopyDepthSignature !== canopyDepth.signature
    || canopyLight.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Canopy Light provenance does not match.');
  }
  if (phenology.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || phenology.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || phenology.sourceCanopyLightSignature !== canopyLight.signature
    || phenology.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Phenology provenance does not match.');
  }
  if (leafOrientation.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || leafOrientation.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || leafOrientation.sourceCanopyDepthSignature !== canopyDepth.signature
    || leafOrientation.sourceCanopyLightSignature !== canopyLight.signature
    || leafOrientation.sourcePhenologySignature !== phenology.signature
    || leafOrientation.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Leaf Orientation provenance does not match.');
  }
  if (canopyDepth.profiles.length !== leaves.instances.length
    || canopyLight.profiles.length !== leaves.instances.length
    || phenology.profiles.length !== leaves.instances.length
    || leafOrientation.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Crown Silhouette requires one upstream profile per accepted leaf.');
  }
}

function sectorIndex(x: number, z: number, count: number): number {
  const angle = (Math.atan2(z, x) + TAU) % TAU;
  return Math.min(count - 1, Math.floor(angle / TAU * count));
}

function verticalBandIndex(
  y: number,
  minimumY: number,
  height: number,
  count: number,
): number {
  const normalized = clamp((y - minimumY) / height, 0, 1);
  return Math.min(count - 1, Math.floor(normalized * count));
}

function targetEnvelopeRatio(silhouette: TreeSilhouette, normalizedHeight: number): number {
  const h = clamp(normalizedHeight, 0, 1);
  const centered = h * 2 - 1;
  const ovalArc = Math.sqrt(Math.max(0, 1 - centered * centered));

  if (silhouette === 'columnar') {
    return round6(clamp(0.68 + ovalArc * 0.16, 0.62, 0.9));
  }
  if (silhouette === 'umbrella') {
    const crownArc = Math.pow(Math.sin(Math.PI * clamp(h * 0.82 + 0.09, 0, 1)), 0.68);
    return round6(clamp(0.62 + crownArc * 0.34, 0.62, 0.98));
  }
  if (silhouette === 'windswept') {
    return round6(clamp(0.7 + ovalArc * 0.22 + (h - 0.5) * 0.04, 0.64, 0.98));
  }
  return round6(clamp(0.68 + ovalArc * 0.28, 0.64, 0.98));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function signatureFor(state: Omit<TreeCrownSilhouetteState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.sourceLeafOrientationSignature,
    state.profiles.length,
    state.diagnostics.adjustedLeafCount,
    state.diagnostics.emptyOuterSectorIndices.join(','),
    state.diagnostics.maximumRadialOffsetRatio.toFixed(6),
    state.diagnostics.maximumScaleDelta.toFixed(6),
    state.diagnostics.averageEnvelopeErrorAfter.toFixed(6),
  ].join('|');
}

/**
 * Refines only accepted outer-leaf matrices toward the published silhouette envelope.
 * It never changes leaf identity, crown cells, colors, topology or Tree Life state.
 */
export function buildTreeCrownSilhouette(
  input: BuildTreeCrownSilhouetteInput,
): TreeCrownSilhouetteState {
  validateInput(input);

  const profiles: TreeCrownSilhouetteProfile[] = [];
  const sourceOuterSectors = new Set<number>();
  const renderOuterSectors = new Set<number>();
  const outerErrorsBefore: number[] = [];
  const outerErrorsAfter: number[] = [];
  let adjustedLeafCount = 0;
  let adjustedOuterLeafCount = 0;
  let untouchedInnerLeafCount = 0;
  let untouchedMiddleLeafCount = 0;
  let maximumRadialOffset = 0;
  let maximumRadialOffsetRatio = 0;
  let maximumScaleDelta = 0;

  for (let index = 0; index < input.leaves.instances.length; index += 1) {
    const leaf = input.leaves.instances[index]!;
    const depth = input.canopyDepth.profiles[index]!;
    const light = input.canopyLight.profiles[index]!;
    const phenology = input.phenology.profiles[index]!;
    const orientation = input.leafOrientation.profiles[index]!;

    if (depth.leafInstanceId !== leaf.id
      || light.leafInstanceId !== leaf.id
      || light.canopyProfileId !== depth.id
      || phenology.leafInstanceId !== leaf.id
      || phenology.canopyLightProfileId !== light.id
      || orientation.leafInstanceId !== leaf.id
      || orientation.canopyDepthProfileId !== depth.id
      || orientation.canopyLightProfileId !== light.id
      || orientation.phenologyProfileId !== phenology.id) {
      throw new Error(`Tree Crown Silhouette cannot resolve upstream profiles for "${leaf.id}".`);
    }

    const sourcePosition = depth.renderPosition;
    const relativeX = sourcePosition.x - input.composition.bounds.center.x;
    const relativeZ = sourcePosition.z - input.composition.bounds.center.z;
    const horizontalDistance = Math.hypot(relativeX, relativeZ);
    const sourceRadialRatio = round6(horizontalDistance / input.composition.bounds.radius);
    const normalizedHeight = clamp(
      (sourcePosition.y - input.composition.bounds.min.y) / input.composition.bounds.height,
      0,
      1,
    );
    const targetRatio = targetEnvelopeRatio(input.composition.silhouette, normalizedHeight);
    const sourceSectorIndex = sectorIndex(relativeX, relativeZ, input.config.azimuthSectorCount);
    const sourceVerticalBandIndex = verticalBandIndex(
      sourcePosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    );

    let radialOffsetRatio = 0;
    let radialOffset = 0;
    let scaleMultiplier = 1;
    let renderPosition = { ...sourcePosition };
    const errorBefore = Math.abs(targetRatio - sourceRadialRatio);

    if (depth.layer === 'outer' && horizontalDistance > EPSILON) {
      const signedError = targetRatio - sourceRadialRatio;
      radialOffsetRatio = round6(clamp(
        signedError * input.config.envelopeResponse,
        -input.config.maximumRadialOffsetRatio,
        input.config.maximumRadialOffsetRatio,
      ));
      radialOffset = round6(radialOffsetRatio * input.composition.bounds.radius);
      const inverseDistance = 1 / horizontalDistance;
      renderPosition = roundVec({
        x: sourcePosition.x + relativeX * inverseDistance * radialOffset,
        y: sourcePosition.y,
        z: sourcePosition.z + relativeZ * inverseDistance * radialOffset,
      });
      const scaleDelta = clamp(
        signedError * input.config.envelopeResponse * 0.45,
        -input.config.maximumScaleDelta,
        input.config.maximumScaleDelta,
      );
      scaleMultiplier = round6(1 + scaleDelta);
    }

    const renderRelativeX = renderPosition.x - input.composition.bounds.center.x;
    const renderRelativeZ = renderPosition.z - input.composition.bounds.center.z;
    const renderRadialRatio = Math.hypot(renderRelativeX, renderRelativeZ)
      / input.composition.bounds.radius;
    const renderSectorIndex = sectorIndex(
      renderRelativeX,
      renderRelativeZ,
      input.config.azimuthSectorCount,
    );
    const renderVerticalBandIndex = verticalBandIndex(
      renderPosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    );
    const errorAfter = Math.abs(targetRatio - renderRadialRatio);
    const adjusted = Math.abs(radialOffset) > EPSILON || Math.abs(scaleMultiplier - 1) > EPSILON;

    if (depth.layer === 'inner') untouchedInnerLeafCount += 1;
    if (depth.layer === 'middle') untouchedMiddleLeafCount += 1;
    if (depth.layer === 'outer') {
      sourceOuterSectors.add(sourceSectorIndex);
      renderOuterSectors.add(renderSectorIndex);
      outerErrorsBefore.push(errorBefore);
      outerErrorsAfter.push(errorAfter);
      if (adjusted) adjustedOuterLeafCount += 1;
    }
    if (adjusted) adjustedLeafCount += 1;
    maximumRadialOffset = Math.max(maximumRadialOffset, Math.abs(radialOffset));
    maximumRadialOffsetRatio = Math.max(maximumRadialOffsetRatio, Math.abs(radialOffsetRatio));
    maximumScaleDelta = Math.max(maximumScaleDelta, Math.abs(scaleMultiplier - 1));

    profiles.push({
      id: `tree:crown-silhouette:${leaf.id}`,
      leafInstanceId: leaf.id,
      canopyDepthProfileId: depth.id,
      canopyLightProfileId: light.id,
      phenologyProfileId: phenology.id,
      leafOrientationProfileId: orientation.id,
      sequence: leaf.sequence,
      layer: depth.layer,
      crownCellId: depth.crownCellId,
      sourcePosition: { ...sourcePosition },
      renderPosition,
      sourceSectorIndex,
      renderSectorIndex,
      verticalBandIndex: sourceVerticalBandIndex,
      sourceRadialRatio,
      targetEnvelopeRatio: targetRatio,
      radialOffset,
      radialOffsetRatio,
      scaleMultiplier,
      envelopeErrorBefore: round6(errorBefore),
      envelopeErrorAfter: round6(errorAfter),
      adjusted,
    });

    if (sourceVerticalBandIndex !== renderVerticalBandIndex) {
      throw new Error('Tree Crown Silhouette must preserve vertical bands.');
    }
  }

  const occupiedOuterSectorIndices = [...sourceOuterSectors].sort((left, right) => left - right);
  const emptyOuterSectorIndices = Array.from(
    { length: input.config.azimuthSectorCount },
    (_, index) => index,
  ).filter((index) => !sourceOuterSectors.has(index));
  const renderEmptyOuterSectorIndices = Array.from(
    { length: input.config.azimuthSectorCount },
    (_, index) => index,
  ).filter((index) => !renderOuterSectors.has(index));
  const stableLeafOrderPreserved = profiles.every((profile, index) => (
    profile.sequence === input.leaves.instances[index]?.sequence
    && profile.leafInstanceId === input.leaves.instances[index]?.id
  ));
  const instanceCountPreserved = profiles.length === input.leaves.instances.length;
  const crownCellProvenancePreserved = profiles.every((profile, index) => (
    profile.crownCellId === input.canopyDepth.profiles[index]?.crownCellId
  ));
  const preservedEmptySectorIndices = emptyOuterSectorIndices.length === renderEmptyOuterSectorIndices.length
    && emptyOuterSectorIndices.every((value, index) => value === renderEmptyOuterSectorIndices[index]);
  const preservedVerticalBands = profiles.every((profile) => (
    profile.verticalBandIndex === verticalBandIndex(
      profile.renderPosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    )
  ));
  const averageEnvelopeErrorBefore = average(outerErrorsBefore);
  const averageEnvelopeErrorAfter = average(outerErrorsAfter);
  const silhouetteErrorNotIncreased = averageEnvelopeErrorAfter <= averageEnvelopeErrorBefore + 1e-9;

  if (!stableLeafOrderPreserved
    || !instanceCountPreserved
    || !crownCellProvenancePreserved
    || !preservedEmptySectorIndices
    || !preservedVerticalBands
    || !silhouetteErrorNotIncreased) {
    throw new Error('Tree Crown Silhouette preservation or acceptance contract failed.');
  }

  const stateWithoutSignature: Omit<TreeCrownSilhouetteState, 'signature'> = {
    treeCrownSilhouetteVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceCompositionRulesVersion: input.composition.rulesVersion,
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
    sourceLeafOrientationVersion: input.leafOrientation.treeLeafOrientationVersion,
    sourceLeafOrientationRulesVersion: input.leafOrientation.rulesVersion,
    sourceLeafOrientationSignature: input.leafOrientation.signature,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    descriptor: {
      id: 'tree:crown-silhouette:polish',
      profileId: 'tree:crown-silhouette:instance-profile',
      matrixAttributeId: 'tree:crown-silhouette:instance-matrix',
      negativeSpaceId: 'tree:crown-silhouette:negative-space',
      sourceGeometryId: 'tree:leaf:instances',
    },
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      adjustedLeafCount,
      adjustedOuterLeafCount,
      untouchedInnerLeafCount,
      untouchedMiddleLeafCount,
      occupiedOuterSectorIndices,
      emptyOuterSectorIndices,
      occupiedOuterSectorCount: occupiedOuterSectorIndices.length,
      emptyOuterSectorCount: emptyOuterSectorIndices.length,
      maximumRadialOffset: round6(maximumRadialOffset),
      maximumRadialOffsetRatio: round6(maximumRadialOffsetRatio),
      maximumScaleDelta: round6(maximumScaleDelta),
      averageEnvelopeErrorBefore: round6(averageEnvelopeErrorBefore),
      averageEnvelopeErrorAfter: round6(averageEnvelopeErrorAfter),
      stableLeafOrderPreserved: true,
      instanceCountPreserved: true,
      crownCellProvenancePreserved: true,
      preservedEmptySectorIndices: true,
      filledPreviouslyEmptySectors: false,
      preservedVerticalBands: true,
      silhouetteErrorNotIncreased: true,
      negativeSpaceAccepted: true,
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
