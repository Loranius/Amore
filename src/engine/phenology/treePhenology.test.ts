import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_PHENOLOGY_CONFIG } from './config';
import { buildTreePhenology } from './treePhenology';

describe('Tree Phenology', () => {
  it('publishes one deterministic seasonal profile per accepted leaf', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(second.phenology).toEqual(first.phenology);
    expect(first.phenology.profiles).toHaveLength(first.leaves.instances.length);
    expect(first.phenology.diagnostics.instanceCountPreserved).toBe(true);
    expect(first.phenology.diagnostics.stableLeafOrderPreserved).toBe(true);
    expect(first.phenology.diagnostics.accentLeafCount).toBeGreaterThan(0);
    expect(first.phenology.diagnostics.uniqueCombinedTintCount).toBeLessThanOrEqual(
      first.phenology.diagnostics.combinedTintBudget,
    );
    expect(first.phenology.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.phenology.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('derives stable phases from the accepted asOf date', () => {
    const build = buildTreeLabPreview('low');
    const phases = [
      ['2026-04-15T00:00:00.000Z', 'spring'],
      ['2026-07-15T00:00:00.000Z', 'summer'],
      ['2026-10-15T00:00:00.000Z', 'autumn'],
      ['2026-01-15T00:00:00.000Z', 'winter'],
    ] as const;

    for (const [asOf, expected] of phases) {
      const state = buildTreePhenology({
        species: build.species,
        leaves: build.leaves,
        canopyLight: build.canopyLight,
        materials: build.materials,
        asOf,
        config: DEFAULT_TREE_PHENOLOGY_CONFIG,
      });
      expect(state.phase).toBe(expected);
      expect(state.profiles).toHaveLength(build.leaves.instances.length);
    }
  });

  it('preserves accepted leaf identity and order across LODs', () => {
    const low = buildTreeLabPreview('low').phenology.profiles.map((profile) => profile.leafInstanceId);
    const medium = buildTreeLabPreview('medium').phenology.profiles.map((profile) => profile.leafInstanceId);
    const high = buildTreeLabPreview('high').phenology.profiles.map((profile) => profile.leafInstanceId);

    expect(medium.slice(0, low.length)).toEqual(low);
    expect(high.slice(0, medium.length)).toEqual(medium);
  });
});
