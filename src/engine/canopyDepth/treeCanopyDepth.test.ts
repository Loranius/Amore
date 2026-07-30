import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_CANOPY_DEPTH_CONFIG } from './config';
import { buildTreeCanopyDepth } from './treeCanopyDepth';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    canopy: buildTreeCanopyDepth({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: build.materials,
      config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
    }),
  };
}

describe('Tree Canopy Depth', () => {
  it('publishes deterministic depth profiles for every accepted leaf', () => {
    const first = rebuild().canopy;
    const second = rebuild().canopy;

    expect(second).toEqual(first);
    expect(first.descriptor).toEqual({
      id: 'tree:canopy-depth:volume',
      profileId: 'tree:canopy-depth:instance-profile',
      tintAttributeId: 'tree:canopy-depth:instance-tint',
      sourceGeometryId: 'tree:leaf:instances',
      materialRole: 'foliage',
    });
    expect(first.profiles).toHaveLength(first.diagnostics.sourceLeafCount);
    expect(first.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.diagnostics.stableLeafOrderPreserved).toBe(true);
    expect(first.signature.length).toBeGreaterThan(0);
  });

  it('creates inner, middle and outer crown layers without filling empty cells', () => {
    const { build, canopy } = rebuild();

    expect(canopy.diagnostics.innerLeafCount).toBeGreaterThan(0);
    expect(canopy.diagnostics.middleLeafCount).toBeGreaterThan(0);
    expect(canopy.diagnostics.outerLeafCount).toBeGreaterThan(0);
    expect(
      canopy.diagnostics.innerLeafCount
        + canopy.diagnostics.middleLeafCount
        + canopy.diagnostics.outerLeafCount,
    ).toBe(build.leaves.instances.length);
    expect(canopy.diagnostics.preservedOccupiedCellIds).toBe(true);
    expect(canopy.diagnostics.filledPreviouslyEmptyCells).toBe(false);

    const sourceCells = new Set(build.foliage.clusters.map((cluster) => cluster.crownCellId));
    for (const profile of canopy.profiles) {
      expect(sourceCells.has(profile.crownCellId)).toBe(true);
      if (profile.layer === 'inner') {
        expect(profile.depth).toBeLessThanOrEqual(DEFAULT_TREE_CANOPY_DEPTH_CONFIG.innerDepthMaximum);
      } else if (profile.layer === 'outer') {
        expect(profile.depth).toBeGreaterThanOrEqual(DEFAULT_TREE_CANOPY_DEPTH_CONFIG.outerDepthMinimum);
      } else {
        expect(profile.depth).toBeGreaterThan(DEFAULT_TREE_CANOPY_DEPTH_CONFIG.innerDepthMaximum);
        expect(profile.depth).toBeLessThan(DEFAULT_TREE_CANOPY_DEPTH_CONFIG.outerDepthMinimum);
      }
    }
  });

  it('keeps offsets, scales and tints inside explicit mobile bounds', () => {
    const { build, canopy } = rebuild();
    const clusters = new Map(build.foliage.clusters.map((cluster) => [cluster.id, cluster] as const));

    for (const profile of canopy.profiles) {
      const cluster = clusters.get(profile.clusterId);
      expect(cluster).toBeDefined();
      const offset = Math.hypot(
        profile.positionOffset.x,
        profile.positionOffset.y,
        profile.positionOffset.z,
      );
      expect(offset).toBeLessThanOrEqual(
        (cluster?.radius ?? 0) * DEFAULT_TREE_CANOPY_DEPTH_CONFIG.maximumOffsetRatio + 1e-6,
      );
      expect(profile.scaleMultiplier).toBeGreaterThan(0);
      for (const channel of [
        profile.tintMultiplier.r,
        profile.tintMultiplier.g,
        profile.tintMultiplier.b,
      ]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
    expect(canopy.diagnostics.uniqueTintCount).toBeLessThanOrEqual(
      canopy.diagnostics.tintBudget,
    );
    expect(canopy.diagnostics.tintBudgetExceeded).toBe(false);
    expect(canopy.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(canopy.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(canopy.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);
  });

  it('preserves strict leaf ID prefixes across LODs', () => {
    const low = rebuild('low').canopy.profiles.map((profile) => profile.leafInstanceId);
    const medium = rebuild('medium').canopy.profiles.map((profile) => profile.leafInstanceId);
    const high = rebuild('high').canopy.profiles.map((profile) => profile.leafInstanceId);

    expect(medium.slice(0, low.length)).toEqual(low);
    expect(high.slice(0, medium.length)).toEqual(medium);
  });

  it('does not mutate composition, foliage, leaves or materials', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: build.materials,
    });

    buildTreeCanopyDepth({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: build.materials,
      config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
    });

    expect(JSON.stringify({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: build.materials,
    })).toBe(before);
  });

  it('rejects mismatched provenance and tint budgets', () => {
    const build = buildTreeLabPreview('medium');
    expect(() => buildTreeCanopyDepth({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: { ...build.materials, artifactSeed: build.materials.artifactSeed + 1 },
      config: DEFAULT_TREE_CANOPY_DEPTH_CONFIG,
    })).toThrow(/different artifacts/);

    expect(() => buildTreeCanopyDepth({
      composition: build.composition,
      foliage: build.foliage,
      leaves: build.leaves,
      materials: build.materials,
      config: { ...DEFAULT_TREE_CANOPY_DEPTH_CONFIG, maximumUniqueTints: 3 },
    })).toThrow(/tint budget exceeded/);
  });
});
