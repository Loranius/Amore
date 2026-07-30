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
    }
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
        tiltRad: profile.tiltRad,
        fanRad: profile.fanRad,
        twistRad: profile.twistRad,
      });
      expect(highByLeafId.get(profile.leafInstanceId)).toMatchObject({
        leafInstanceId: profile.leafInstanceId,
        layer: profile.layer,
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
