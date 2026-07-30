import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_LEAF_ORIENTATION_CONFIG } from './config';
import { buildTreeLeafOrientation } from './treeLeafOrientation';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    orientation: buildTreeLeafOrientation({
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      config: DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
    }),
  };
}

describe('Tree Leaf Orientation', () => {
  it('publishes one deterministic bounded profile per accepted leaf', () => {
    const first = rebuild().orientation;
    const second = rebuild().orientation;

    expect(second).toEqual(first);
    expect(first.profiles).toHaveLength(first.diagnostics.sourceLeafCount);
    expect(first.diagnostics.nonZeroProfileCount).toBeGreaterThan(0);
    expect(first.diagnostics.stableLeafOrderPreserved).toBe(true);
    expect(first.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);

    for (const profile of first.profiles) {
      const bounds = DEFAULT_TREE_LEAF_ORIENTATION_CONFIG.orientationByLayer[profile.layer];
      expect(Math.abs(profile.tiltRad)).toBeLessThanOrEqual(bounds.maximumTiltRad + 1e-6);
      expect(Math.abs(profile.fanRad)).toBeLessThanOrEqual(bounds.maximumFanRad + 1e-6);
      expect(Math.abs(profile.twistRad)).toBeLessThanOrEqual(bounds.maximumTwistRad + 1e-6);
      expect(Math.hypot(
        profile.presentationNormal.x,
        profile.presentationNormal.y,
        profile.presentationNormal.z,
      )).toBeCloseTo(1, 5);
    }
  });

  it('improves stable front readability without changing the accepted leaf set', () => {
    const { orientation } = rebuild();
    const adjusted = orientation.profiles.filter((profile) => profile.frontFacingAdjusted);
    const candidates = orientation.profiles.filter((profile) => (
      profile.renderFacingDot !== profile.sourceFacingDot || profile.frontFacingAdjusted
    ));

    expect(orientation.diagnostics.frontFacingCandidateCount).toBeGreaterThan(0);
    expect(orientation.diagnostics.frontFacingAdjustedLeafCount).toBeGreaterThan(0);
    expect(orientation.diagnostics.frontFacingNotReduced).toBe(true);
    expect(orientation.diagnostics.averageRenderFacingDot).toBeGreaterThanOrEqual(
      orientation.diagnostics.averageSourceFacingDot,
    );
    expect(orientation.diagnostics.minimumRenderFacingDot).toBeGreaterThanOrEqual(0);
    expect(adjusted.length).toBe(orientation.diagnostics.frontFacingAdjustedLeafCount);
    expect(candidates.length).toBeGreaterThan(0);
    expect(adjusted.every((profile) => profile.renderFacingDot > profile.sourceFacingDot)).toBe(true);
  });

  it('keeps accepted leaf identity and orientation values stable across LODs', () => {
    const low = rebuild('low').orientation.profiles;
    const medium = rebuild('medium').orientation.profiles;
    const high = rebuild('high').orientation.profiles;
    const mediumByLeafId = new Map(medium.map((profile) => [profile.leafInstanceId, profile] as const));
    const highByLeafId = new Map(high.map((profile) => [profile.leafInstanceId, profile] as const));

    for (const profile of low) {
      expect(mediumByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        presentationNormal: profile.presentationNormal,
        sourceFacingDot: profile.sourceFacingDot,
        renderFacingDot: profile.renderFacingDot,
        frontFacingAdjusted: profile.frontFacingAdjusted,
        tiltRad: profile.tiltRad,
        fanRad: profile.fanRad,
        twistRad: profile.twistRad,
      });
      expect(highByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
        presentationNormal: profile.presentationNormal,
        sourceFacingDot: profile.sourceFacingDot,
        renderFacingDot: profile.renderFacingDot,
        frontFacingAdjusted: profile.frontFacingAdjusted,
        tiltRad: profile.tiltRad,
        fanRad: profile.fanRad,
        twistRad: profile.twistRad,
      });
    }
  });

  it('preserves upstream state and rejects incompatible provenance', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
    });

    buildTreeLeafOrientation({
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
      config: DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
    });

    expect(JSON.stringify({
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: build.canopyLight,
      phenology: build.phenology,
    })).toBe(before);

    expect(() => buildTreeLeafOrientation({
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      canopyLight: { ...build.canopyLight, artifactSeed: build.canopyLight.artifactSeed + 1 },
      phenology: build.phenology,
      config: DEFAULT_TREE_LEAF_ORIENTATION_CONFIG,
    })).toThrow(/different artifacts/);
  });
});