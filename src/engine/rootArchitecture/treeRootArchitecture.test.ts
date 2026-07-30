import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG } from './config';
import { buildTreeRootArchitecture } from './treeRootArchitecture';

function buildAtAge(ageDays: number) {
  const preview = buildTreeLabPreview('medium');
  return buildTreeRootArchitecture({
    species: {
      ...preview.species,
      state: { ...preview.species.state, ageDays },
    },
    composition: preview.composition,
    frames: preview.frames,
    config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
  });
}

describe('Tree Root Architecture Lab', () => {
  it('is deterministic and stays inside the dedicated mobile budget', () => {
    const first = buildTreeLabPreview('medium').roots;
    const second = buildTreeLabPreview('medium').roots;

    expect(second).toEqual(first);
    expect(first.diagnostics.emittedRootCount).toBe(first.roots.length);
    expect(first.diagnostics.emittedRootCount).toBeLessThanOrEqual(
      DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG.maximumRoots,
    );
    expect(first.diagnostics.sampleCount).toBeLessThanOrEqual(
      DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG.maximumSamples,
    );
    expect(first.frames.diagnostics.branchCount).toBe(first.roots.length);
    expect(first.frames.diagnostics.junctionCount).toBe(0);
  });

  it('publishes stable surface and near-surface descriptors', () => {
    const state = buildAtAge(5_000);

    expect(state.roots.length).toBeGreaterThan(0);
    expect(state.roots.map((root) => root.id)).toEqual(
      state.roots.map((_root, index) => `tree:root:${index}`),
    );
    expect(state.roots.every((root) => root.sampleIds.length === 7)).toBe(true);
    expect(state.roots.every((root) => root.length > 0)).toBe(true);
    expect(state.roots.every((root) => root.maximumDepth > 0)).toBe(true);
    expect(state.diagnostics.surfaceRootCount + state.diagnostics.nearSurfaceRootCount)
      .toBe(state.roots.length);
  });

  it('exposes only a longer stable prefix as the tree ages', () => {
    const young = buildAtAge(0);
    const old = buildAtAge(50_000);

    expect(old.roots.length).toBeGreaterThanOrEqual(young.roots.length);
    expect(old.roots.slice(0, young.roots.length)).toEqual(young.roots);
    expect(old.frames.curves.slice(0, young.frames.curves.length)).toEqual(young.frames.curves);
  });

  it('does not mutate accepted upstream state', () => {
    const preview = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(preview.species);
    const compositionBefore = JSON.stringify(preview.composition);
    const framesBefore = JSON.stringify(preview.frames);

    buildTreeRootArchitecture({
      species: preview.species,
      composition: preview.composition,
      frames: preview.frames,
      config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
    });

    expect(JSON.stringify(preview.species)).toBe(speciesBefore);
    expect(JSON.stringify(preview.composition)).toBe(compositionBefore);
    expect(JSON.stringify(preview.frames)).toBe(framesBefore);
  });
});
