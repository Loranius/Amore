import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_CANOPY_LIGHT_CONFIG } from './config';
import { buildTreeCanopyLight } from './treeCanopyLight';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    light: buildTreeCanopyLight({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: build.materials,
      config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
    }),
  };
}

describe('Tree Canopy Light Response', () => {
  it('publishes deterministic light profiles for every accepted leaf', () => {
    const first = rebuild().light;
    const second = rebuild().light;

    expect(second).toEqual(first);
    expect(first.descriptor).toEqual({
      id: 'tree:canopy-light:response',
      profileId: 'tree:canopy-light:instance-profile',
      tintAttributeId: 'tree:canopy-light:instance-tint',
      sourceCanopyId: 'tree:canopy-depth:volume',
      materialRole: 'foliage',
    });
    expect(first.profiles).toHaveLength(first.diagnostics.sourceLeafCount);
    expect(first.diagnostics.canopyProfileOrderPreserved).toBe(true);
    expect(first.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.diagnostics.crownCellProvenancePreserved).toBe(true);
    expect(first.diagnostics.lightDirectionNormalized).toBe(true);
    expect(first.signature.length).toBeGreaterThan(0);
  });

  it('creates bounded shade, transition and sunlit exposure without changing leaf identities', () => {
    const { build, light } = rebuild();
    const populatedBands = [
      light.diagnostics.shadeLeafCount,
      light.diagnostics.transitionLeafCount,
      light.diagnostics.sunlitLeafCount,
    ].filter((count) => count > 0);

    expect(
      light.diagnostics.shadeLeafCount
        + light.diagnostics.transitionLeafCount
        + light.diagnostics.sunlitLeafCount,
    ).toBe(build.leaves.instances.length);
    expect(populatedBands.length).toBeGreaterThanOrEqual(2);
    expect(light.diagnostics.minimumExposure).toBeGreaterThanOrEqual(0);
    expect(light.diagnostics.maximumExposure).toBeLessThanOrEqual(1);
    expect(light.diagnostics.maximumExposure).toBeGreaterThan(
      light.diagnostics.minimumExposure,
    );

    for (let index = 0; index < light.profiles.length; index += 1) {
      const profile = light.profiles[index]!;
      const leaf = build.leaves.instances[index]!;
      const canopy = build.canopyDepth.profiles[index]!;
      expect(profile.leafInstanceId).toBe(leaf.id);
      expect(profile.sequence).toBe(index);
      expect(profile.canopyProfileId).toBe(canopy.id);
      expect(profile.crownCellId).toBe(canopy.crownCellId);
      expect(profile.exposure).toBeGreaterThanOrEqual(0);
      expect(profile.exposure).toBeLessThanOrEqual(1);
      if (profile.band === 'shade') {
        expect(profile.exposure).toBeLessThanOrEqual(
          DEFAULT_TREE_CANOPY_LIGHT_CONFIG.shadeMaximum,
        );
      } else if (profile.band === 'sunlit') {
        expect(profile.exposure).toBeGreaterThanOrEqual(
          DEFAULT_TREE_CANOPY_LIGHT_CONFIG.sunlitMinimum,
        );
      } else {
        expect(profile.exposure).toBeGreaterThan(
          DEFAULT_TREE_CANOPY_LIGHT_CONFIG.shadeMaximum,
        );
        expect(profile.exposure).toBeLessThan(
          DEFAULT_TREE_CANOPY_LIGHT_CONFIG.sunlitMinimum,
        );
      }
    }
  });

  it('keeps combined instance tints bounded and inside the published budget', () => {
    const { light } = rebuild();

    for (const profile of light.profiles) {
      for (const channel of [
        profile.lightTintMultiplier.r,
        profile.lightTintMultiplier.g,
        profile.lightTintMultiplier.b,
        profile.combinedTintMultiplier.r,
        profile.combinedTintMultiplier.g,
        profile.combinedTintMultiplier.b,
      ]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
    expect(light.diagnostics.uniqueCombinedTintCount).toBeGreaterThan(1);
    expect(light.diagnostics.uniqueCombinedTintCount).toBeLessThanOrEqual(
      light.diagnostics.combinedTintBudget,
    );
    expect(light.diagnostics.combinedTintBudgetExceeded).toBe(false);
    expect(light.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(light.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(light.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);
  });

  it('preserves accepted light-profile prefixes across LODs', () => {
    const low = rebuild('low').light.profiles.map((profile) => profile.leafInstanceId);
    const medium = rebuild('medium').light.profiles.map((profile) => profile.leafInstanceId);
    const high = rebuild('high').light.profiles.map((profile) => profile.leafInstanceId);

    expect(medium.slice(0, low.length)).toEqual(low);
    expect(high.slice(0, medium.length)).toEqual(medium);
  });

  it('does not mutate composition, leaves, Canopy Depth or materials', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: build.materials,
    });

    buildTreeCanopyLight({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: build.materials,
      config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
    });

    expect(JSON.stringify({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: build.materials,
    })).toBe(before);
  });

  it('rejects mismatched provenance and combined tint budgets', () => {
    const build = buildTreeLabPreview('medium');
    expect(() => buildTreeCanopyLight({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: { ...build.materials, artifactSeed: build.materials.artifactSeed + 1 },
      config: DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
    })).toThrow(/different artifacts/);

    expect(() => buildTreeCanopyLight({
      composition: build.composition,
      leaves: build.leaves,
      canopy: build.canopyDepth,
      materials: build.materials,
      config: {
        ...DEFAULT_TREE_CANOPY_LIGHT_CONFIG,
        maximumUniqueCombinedTints: 3,
      },
    })).toThrow(/combined tint budget exceeded/);
  });
});
