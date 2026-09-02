import {
  clamp,
  round6,
  roundVec,
  seededUnit,
} from '../growth/math';
import type { TreeSilhouette } from '../composition';
import type {
  BuildTreeCrownSilhouetteInput,
  TreeCrownSilhouetteProfile,
  TreeCrownSilhouetteState,
  TreeCrownViewReadability,
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
  if (!Number.isInteger(config.viewDirectionCount)
    || config.viewDirectionCount < 4
    || config.viewDirectionCount > 16) {
    throw new Error('Tree Crown Silhouette viewDirectionCount must be an integer between 4 and 16.');
  }
  if (!Number.isFinite(config.maximumRadialOffsetRatio)
    || config.maximumRadialOffsetRatio < 0
    || config.maximumRadialOffsetRatio > 0.08) {
    throw new Error('Tree Crown Silhouette maximumRadialOffsetRatio must stay in [0, 0.08].');
  }
  if (!Number.isFinite(config.maximumScaleDelta)
    || config.maximumScaleDelta < 0
    || config.maximumScaleDelta > 0.5) {
    throw new Error('Tree Crown Silhouette maximumScaleDelta must stay in [0, 0.5].');
  }
  if (!Number.isFinite(config.frontClosureMaximumInwardOffsetRatio)
    || config.frontClosureMaximumInwardOffsetRatio < 0
    || config.frontClosureMaximumInwardOffsetRatio > 0.25) {
    throw new Error('Tree Crown Silhouette frontClosureMaximumInwardOffsetRatio must stay in [0, 0.25].');
  }
  for (const [name, value] of [
    ['envelopeResponse', config.envelopeResponse],
    ['middleLayerResponse', config.middleLayerResponse],
    ['frontClosureSelectionFraction', config.frontClosureSelectionFraction],
    ['frontClosureTargetRadialRatio', config.frontClosureTargetRadialRatio],
    ['frontClosureScaleDelta', config.frontClosureScaleDelta],
    ['minimumReadableFacingDot', config.minimumReadableFacingDot],
    ['minimumReadableLeafFraction', config.minimumReadableLeafFraction],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Tree Crown Silhouette ${name} must stay in [0, 1].`);
    }
  }
  if (config.envelopeResponse <= 0) {
    throw new Error('Tree Crown Silhouette envelopeResponse must be greater than zero.');
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

function layerResponse(
  layer: TreeCrownSilhouetteProfile['layer'],
  input: BuildTreeCrownSilhouetteInput,
): number {
  if (layer === 'outer') return 1;
  if (layer === 'middle') return input.config.middleLayerResponse;
  return 0;
}

function buildViewReadability(
  input: BuildTreeCrownSilhouetteInput,
  profiles: readonly TreeCrownSilhouetteProfile[],
): TreeCrownViewReadability[] {
  const result: TreeCrownViewReadability[] = [];

  for (let viewIndex = 0; viewIndex < input.config.viewDirectionCount; viewIndex += 1) {
    const angle = viewIndex / input.config.viewDirectionCount * TAU;
    const direction = roundVec({
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    });
    let frontLeafCount = 0;
    let readableFrontLeafCount = 0;

    for (const profile of profiles) {
      const relativeX = profile.renderPosition.x - input.composition.bounds.center.x;
      const relativeZ = profile.renderPosition.z - input.composition.bounds.center.z;
      const frontProjection = relativeX * direction.x + relativeZ * direction.z;
      if (frontProjection < 0) continue;

      frontLeafCount += 1;
      const orientation = input.leafOrientation.profiles[profile.sequence]!;
      const facingDot = Math.abs(
        orientation.presentationNormal.x * direction.x
          + orientation.presentationNormal.z * direction.z,
      );
      if (facingDot >= input.config.minimumReadableFacingDot) {
        readableFrontLeafCount += 1;
      }
    }

    const readableFrontLeafFraction = frontLeafCount > 0
      ? readableFrontLeafCount / frontLeafCount
      : 0;
    const accepted = frontLeafCount > 0
      && readableFrontLeafFraction >= input.config.minimumReadableLeafFraction;

    result.push({
      viewIndex,
      direction,
      frontLeafCount,
      readableFrontLeafCount,
      readableFrontLeafFraction: round6(readableFrontLeafFraction),
      accepted,
    });
  }

  return result;
}

function signatureFor(state: Omit<TreeCrownSilhouetteState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.sourceLeafOrientationSignature,
    state.profiles.length,
    state.diagnostics.adjustedLeafCount,
    state.diagnostics.frontClosureLeafCount,
    state.diagnostics.frontClosureInwardLeafCount,
    state.diagnostics.emptyOuterSectorIndices.join(','),
    state.diagnostics.maximumRadialOffsetRatio.toFixed(6),
    state.diagnostics.maximumFrontClosureInwardOffsetRatio.toFixed(6),
    state.diagnostics.maximumScaleDelta.toFixed(6),
    state.diagnostics.averageEnvelopeErrorAfter.toFixed(6),
    state.diagnostics.minimumReadableFrontLeafFraction.toFixed(6),
  ].join('|');
}

/**
 * Refines accepted outer and middle leaf matrices toward the published crown
 * envelope, pulls a deterministic middle-layer subset into the front interior,
 * and validates readability from eight views.
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
  let adjustedMiddleLeafCount = 0;
  let frontClosureLeafCount = 0;
  let frontClosureInwardLeafCount = 0;
  let untouchedInnerLeafCount = 0;
  let untouchedMiddleLeafCount = 0;
  let maximumRadialOffset = 0;
  let maximumRadialOffsetRatio = 0;
  let maximumFrontClosureInwardOffsetRatio = 0;
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

    const response = layerResponse(depth.layer, input);
    const frontCandidate = depth.layer !== 'inner'
      && (depth.renderFrontDepth >= 0 || depth.presentationShifted);
    const frontClosureSelected = depth.layer === 'middle'
      && frontCandidate
      && normalizedHeight >= 0.24
      && seededUnit(
        input.leaves.artifactSeed,
        `${leaf.id}:crown-silhouette:front-closure`,
      ) < input.config.frontClosureSelectionFraction;

    let radialOffsetRatio = 0;
    let frontClosureInwardOffsetRatio = 0;
    let radialOffset = 0;
    let renderPosition = { ...sourcePosition };
    const errorBefore = Math.abs(targetRatio - sourceRadialRatio);
    const signedError = targetRatio - sourceRadialRatio;

    if (frontClosureSelected && horizontalDistance > EPSILON) {
      const maximumInward = Math.min(
        input.config.frontClosureMaximumInwardOffsetRatio,
        sourceRadialRatio * 0.45,
      );
      frontClosureInwardOffsetRatio = round6(clamp(
        (input.config.frontClosureTargetRadialRatio - sourceRadialRatio) * 0.82,
        -maximumInward,
        0,
      ));
      radialOffsetRatio = frontClosureInwardOffsetRatio;
    } else if (response > 0 && horizontalDistance > EPSILON) {
      const centerSafeMaximum = Math.min(
        input.config.maximumRadialOffsetRatio * response,
        sourceRadialRatio * 0.45,
      );
      radialOffsetRatio = round6(clamp(
        signedError * input.config.envelopeResponse * response,
        -centerSafeMaximum,
        centerSafeMaximum,
      ));
    }

    if (Math.abs(radialOffsetRatio) > EPSILON && horizontalDistance > EPSILON) {
      radialOffset = round6(radialOffsetRatio * input.composition.bounds.radius);
      const inverseDistance = 1 / horizontalDistance;
      renderPosition = roundVec({
        x: sourcePosition.x + relativeX * inverseDistance * radialOffset,
        y: sourcePosition.y,
        z: sourcePosition.z + relativeZ * inverseDistance * radialOffset,
      });
    }

    const envelopeScaleDelta = frontClosureSelected
      ? 0
      : signedError * input.config.envelopeResponse * 0.45 * response;
    const normalizedFrontDepth = clamp(
      depth.renderFrontDepth / input.composition.bounds.radius,
      -1,
      1,
    );
    const frontWeight = frontCandidate
      ? clamp((normalizedFrontDepth + 0.08) / 0.58, 0.3, 1)
      : 0;
    const heightWeight = frontCandidate
      ? clamp((normalizedHeight - 0.18) / 0.56, 0.35, 1)
      : 0;
    const closureLayerWeight = frontClosureSelected
      ? 1
      : depth.layer === 'outer' && frontCandidate
        ? 0.34
        : 0;
    const frontClosureScaleDelta = input.config.frontClosureScaleDelta
      * closureLayerWeight
      * frontWeight
      * heightWeight
      * (0.72 + orientation.renderFacingDot * 0.28);
    const totalScaleDelta = depth.layer === 'inner'
      ? 0
      : clamp(
        envelopeScaleDelta + frontClosureScaleDelta,
        -input.config.maximumScaleDelta,
        input.config.maximumScaleDelta,
      );
    const scaleMultiplier = round6(1 + totalScaleDelta);

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
    if (depth.layer === 'middle') {
      if (adjusted) adjustedMiddleLeafCount += 1;
      else untouchedMiddleLeafCount += 1;
    }
    if (depth.layer === 'outer') {
      sourceOuterSectors.add(sourceSectorIndex);
      renderOuterSectors.add(renderSectorIndex);
      outerErrorsBefore.push(errorBefore);
      outerErrorsAfter.push(errorAfter);
      if (adjusted) adjustedOuterLeafCount += 1;
    }
    if (frontClosureScaleDelta > EPSILON) frontClosureLeafCount += 1;
    if (frontClosureInwardOffsetRatio < -EPSILON) frontClosureInwardLeafCount += 1;
    if (adjusted) adjustedLeafCount += 1;
    maximumRadialOffset = Math.max(maximumRadialOffset, Math.abs(radialOffset));
    maximumRadialOffsetRatio = Math.max(
      maximumRadialOffsetRatio,
      frontClosureSelected ? 0 : Math.abs(radialOffsetRatio),
    );
    maximumFrontClosureInwardOffsetRatio = Math.max(
      maximumFrontClosureInwardOffsetRatio,
      Math.abs(frontClosureInwardOffsetRatio),
    );
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
      frontClosureSelected,
      frontClosureInwardOffsetRatio,
      frontClosureScaleDelta: round6(frontClosureScaleDelta),
      scaleMultiplier,
      envelopeErrorBefore: round6(errorBefore),
      envelopeErrorAfter: round6(errorAfter),
      adjusted,
    });

    if (sourceVerticalBandIndex !== renderVerticalBandIndex) {
      throw new Error('Tree Crown Silhouette must preserve vertical bands.');
    }
    if (sourceSectorIndex !== renderSectorIndex) {
      throw new Error('Tree Crown Silhouette must preserve azimuth sectors.');
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
  const viewReadability = buildViewReadability(input, profiles);
  const minimumReadableFrontLeafFraction = viewReadability.length > 0
    ? Math.min(...viewReadability.map((view) => view.readableFrontLeafFraction))
    : 0;
  const viewReadabilityAccepted = viewReadability.every((view) => view.accepted);

  /*
   * Помилка НАЗИВАЄ умову, яка впала, а не сам факт падіння.
   *
   * Тут сходяться сім різних інваріантів, і повідомлення «preservation or
   * multi-view acceptance contract failed» однакове для всіх сімох. Коли
   * контракт упав на одинадцяти роках із сорока в однієї пари, з нього не
   * можна було дізнатись навіть того, геометрія це чи листя, — довелось
   * дописувати діагностику, щоб просто прочитати причину. Друге таке
   * розслідування вже не знадобиться.
   */
  const broken = [
    ['stableLeafOrder', stableLeafOrderPreserved],
    ['instanceCount', instanceCountPreserved],
    ['crownCellProvenance', crownCellProvenancePreserved],
    ['emptyOuterSectors', preservedEmptySectorIndices],
    ['verticalBands', preservedVerticalBands],
    ['silhouetteErrorNotIncreased', silhouetteErrorNotIncreased],
    ['viewReadability', viewReadabilityAccepted],
  ].filter(([, ok]) => !ok).map(([name]) => name);

  if (broken.length > 0) {
    throw new Error(
      `Tree Crown Silhouette preservation or multi-view acceptance contract failed: ${broken.join(', ')}`
      + ` (найгірша частка читаного листя ${minimumReadableFrontLeafFraction.toFixed(3)}`
      + ` за порогу ${input.config.minimumReadableLeafFraction};`
      + ` листя попереду в найгіршому напрямку: ${
        viewReadability.filter((view) => !view.accepted)
          .map((view) => `${view.frontLeafCount}/${view.readableFrontLeafCount}`).join(' ')
      })`,
    );
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
      adjustedMiddleLeafCount,
      frontClosureLeafCount,
      frontClosureInwardLeafCount,
      untouchedInnerLeafCount,
      untouchedMiddleLeafCount,
      occupiedOuterSectorIndices,
      emptyOuterSectorIndices,
      occupiedOuterSectorCount: occupiedOuterSectorIndices.length,
      emptyOuterSectorCount: emptyOuterSectorIndices.length,
      maximumRadialOffset: round6(maximumRadialOffset),
      maximumRadialOffsetRatio: round6(maximumRadialOffsetRatio),
      maximumFrontClosureInwardOffsetRatio: round6(maximumFrontClosureInwardOffsetRatio),
      maximumScaleDelta: round6(maximumScaleDelta),
      averageEnvelopeErrorBefore: round6(averageEnvelopeErrorBefore),
      averageEnvelopeErrorAfter: round6(averageEnvelopeErrorAfter),
      viewReadability,
      minimumReadableFrontLeafFraction: round6(minimumReadableFrontLeafFraction),
      viewReadabilityAccepted: true,
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