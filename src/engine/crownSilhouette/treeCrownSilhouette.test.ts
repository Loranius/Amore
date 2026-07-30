import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG } from './config';
import { buildTreeCrownSilhouette } from './treeCrownSilhouette';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    silhouette: buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    }),
  };
}

describe('Tree Crown Silhouette', () => {
  it('publishes deterministic bounded front closure for the accepted crown', () => {
    const first = rebuild().silhouette;
    const second = rebuild().silhouette;

    expect(second).toEqual(first);
    expect(first.profiles).toHaveLength(first.diagnostics.sourceLeafCount);
    expect(first.diagnostics.adjustedOuterLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.adjustedMiddleLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.frontClosureLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.frontClosureInwardLeafCount).toBeGreaterThan(0);
    expect(first.diagnostics.adjustedLeafCount).toBe(
      first.diagnostics.adjustedOuterLeafCount + first.diagnostics.adjustedMiddleLeafCount,
    );
    expect(first.diagnostics.stableLeafOrderPreserved).toBe(true);
    expect(first.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.diagnostics.crownCellProvenancePreserved).toBe(true);
    expect(first.diagnostics.preservedEmptySectorIndices).toBe(true);
    expect(first.diagnostics.filledPreviouslyEmptySectors).toBe(false);
    expect(first.diagnostics.preservedVerticalBands).toBe(true);
    expect(first.diagnostics.silhouetteErrorNotIncreased).toBe(true);
    expect(first.diagnostics.negativeSpaceAccepted).toBe(true);
    expect(first.diagnostics.averageEnvelopeErrorAfter).toBeLessThanOrEqual(
      first.diagnostics.averageEnvelopeErrorBefore + 1e-6,
    );
    expect(first.diagnostics.maximumRadialOffsetRatio).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumRadialOffsetRatio + 1e-6,
    );
    expect(first.diagnostics.maximumFrontClosureInwardOffsetRatio).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.frontClosureMaximumInwardOffsetRatio + 1e-6,
    );
    expect(first.diagnostics.maximumScaleDelta).toBeLessThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumScaleDelta + 1e-6,
    );
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);

    const inwardProfiles = first.profiles.filter(
      (profile) => profile.frontClosureInwardOffsetRatio < 0,
    );
    expect(inwardProfiles.length).toBe(first.diagnostics.frontClosureInwardLeafCount);

    for (const profile of first.profiles) {
      expect(profile.sourceSectorIndex).toBe(profile.renderSectorIndex);
      expect(Math.abs(profile.scaleMultiplier - 1)).toBeLessThanOrEqual(
        DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumScaleDelta + 1e-6,
      );
      if (profile.layer === 'outer') {
        expect(profile.envelopeErrorAfter).toBeLessThanOrEqual(profile.envelopeErrorBefore + 1e-6);
        expect(Math.abs(profile.radialOffsetRatio)).toBeLessThanOrEqual(
          DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.maximumRadialOffsetRatio + 1e-6,
        );
      }
      if (profile.frontClosureSelected) {
        expect(profile.layer).toBe('middle');
        expect(profile.frontClosureInwardOffsetRatio).toBeLessThanOrEqual(0);
        expect(Math.abs(profile.frontClosureInwardOffsetRatio)).toBeLessThanOrEqual(
          DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.frontClosureMaximumInwardOffsetRatio + 1e-6,
        );
      }
      if (profile.layer === 'inner') {
        expect(profile.adjusted).toBe(false);
        expect(profile.scaleMultiplier).toBe(1);
        expect(profile.renderPosition).toEqual(profile.sourcePosition);
        expect(profile.frontClosureSelected).toBe(false);
        expect(profile.frontClosureInwardOffsetRatio).toBe(0);
        expect(profile.frontClosureScaleDelta).toBe(0);
      }
    }
  });

  it('accepts crown readability from eight canonical viewing directions', () => {
    const { silhouette } = rebuild();

    expect(silhouette.diagnostics.viewReadability).toHaveLength(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.viewDirectionCount,
    );
    expect(silhouette.diagnostics.viewReadabilityAccepted).toBe(true);
    expect(silhouette.diagnostics.minimumReadableFrontLeafFraction).toBeGreaterThanOrEqual(
      DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.minimumReadableLeafFraction,
    );

    for (const view of silhouette.diagnostics.viewReadability) {
      expect(view.frontLeafCount).toBeGreaterThan(0);
      expect(view.readableFrontLeafCount).toBeGreaterThan(0);
      expect(view.readableFrontLeafFraction).toBeGreaterThanOrEqual(
        DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG.minimumReadableLeafFraction,
      );
      expect(view.accepted).toBe(true);
      expect(Math.hypot(view.direction.x, view.direction.y, view.direction.z)).toBeCloseTo(1, 5);
    }
  });

  it('keeps accepted leaf transforms stable across LODs', () => {
    const low = rebuild('low').silhouette.profiles;
    const medium = rebuild('medium').silhouette.profiles;
    const high = rebuild('high').silhouette.profiles;
    const mediumByLeafId = new Map(medium.map((profile) => [profile.leafInstanceId, profile] as const));
    const highByLeafId = new Map(high.map((profile) => [profile.leafInstanceId, profile] as const));

    for (const profile of low) {
      expect(mediumByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        crownCellId: profile.crownCellId,
        renderPosition: profile.renderPosition,
        radialOffsetRatio: profile.radialOffsetRatio,
        frontClosureSelected: profile.frontClosureSelected,
        frontClosureInwardOffsetRatio: profile.frontClosureInwardOffsetRatio,
        frontClosureScaleDelta: profile.frontClosureScaleDelta,
        scaleMultiplier: profile.scaleMultiplier,
      });
      expect(highByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        crownCellId: profile.crownCellId,
        renderPosition: profile.renderPosition,
        radialOffsetRatio: profile.radialOffsetRatio,
        frontClosureSelected: profile.frontClosureSelected,
        frontClosureInwardOffsetRatio: profile.frontClosureInwardOffsetRatio,
        frontClosureScaleDelta: profile.frontClosureScaleDelta,
        scaleMultiplier: profile.scaleMultiplier,
      });
    }
  });

  it('preserves upstream state and rejects incompatible provenance', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
    });

    buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    });

    expect(JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: build.leafOrientation,
    })).toBe(before);

    expect(() => buildTreeCrownSilhouette({
      composition: build.composition,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      leafOrientation: {
        ...build.leafOrientation,
        artifactSeed: build.leafOrientation.artifactSeed + 1,
      },
      config: DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG,
    })).toThrow(/different artifacts/);
  });
});