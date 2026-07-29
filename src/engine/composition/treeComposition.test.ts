import { describe, expect, it } from 'vitest';
import { buildOrganicCurveFrames } from '../labs/organic';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_COMPOSITION_CONFIG } from './config';
import { buildTreeComposition } from './treeComposition';

const SCORE_KEYS = [
  'hierarchy',
  'flow',
  'silhouette',
  'crownDensity',
  'balance',
  'rhythm',
  'negativeSpace',
  'junctionRealism',
  'total',
] as const;

describe('Tree Composition', () => {
  it('is deterministic and keeps every score normalized', () => {
    const first = buildTreeLabPreview('medium').composition;
    const second = buildTreeLabPreview('medium').composition;

    expect(second).toEqual(first);
    expect(['columnar', 'oval', 'umbrella', 'windswept']).toContain(first.silhouette);
    for (const key of SCORE_KEYS) {
      expect(first.score[key]).toBeGreaterThanOrEqual(0);
      expect(first.score[key]).toBeLessThanOrEqual(1);
    }
  });

  it('describes every curve and preserves the configured occupancy grid', () => {
    const build = buildTreeLabPreview('medium');
    const composition = build.composition;
    const trunk = composition.branches.find((branch) => branch.role === 'trunk');
    const cellCount = DEFAULT_TREE_COMPOSITION_CONFIG.azimuthSectorCount
      * DEFAULT_TREE_COMPOSITION_CONFIG.verticalLayerCount;

    expect(composition.branches).toHaveLength(build.frames.curves.length);
    expect(trunk?.branchId).toBe('organic:trunk');
    expect(trunk?.parentBranchId).toBeNull();
    expect(composition.diagnostics.missingCurveBranchIds).toEqual([]);
    expect(composition.diagnostics.orphanCurveBranchIds).toEqual([]);
    expect(
      composition.diagnostics.occupiedCellCount + composition.diagnostics.emptyCellCount,
    ).toBe(cellCount);
    expect(composition.bounds.radius).toBeGreaterThan(0);
    expect(composition.bounds.height).toBeGreaterThan(0);
  });

  it('does not mutate the source species, skeleton or curve frames', () => {
    const build = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(build.species);
    const skeletonBefore = JSON.stringify(build.skeleton);
    const framesBefore = JSON.stringify(build.frames);

    buildTreeComposition({
      species: build.species,
      skeleton: build.skeleton,
      frames: build.frames,
      config: DEFAULT_TREE_COMPOSITION_CONFIG,
    });

    expect(JSON.stringify(build.species)).toBe(speciesBefore);
    expect(JSON.stringify(build.skeleton)).toBe(skeletonBefore);
    expect(JSON.stringify(build.frames)).toBe(framesBefore);
  });

  it('keeps retained branch descriptors stable when later branches are removed', () => {
    const full = buildTreeLabPreview('medium');
    const retainedBranchIds = new Set([
      'organic:trunk',
      ...full.frames.curves
        .filter((curve) => curve.generation === 1)
        .slice(0, 5)
        .map((curve) => curve.branchId),
    ]);
    const partialNodes = full.skeleton.nodes.filter(
      (node) => retainedBranchIds.has(node.branchId),
    );
    const partialSkeleton = {
      ...full.skeleton,
      nodes: partialNodes,
      diagnostics: {
        ...full.skeleton.diagnostics,
        maxGeneration: Math.max(0, ...partialNodes.map((node) => node.generation)),
      },
    };
    const partialFrames = buildOrganicCurveFrames(partialSkeleton);
    const partialComposition = buildTreeComposition({
      species: full.species,
      skeleton: partialSkeleton,
      frames: partialFrames,
      config: DEFAULT_TREE_COMPOSITION_CONFIG,
    });
    const fullByBranchId = new Map(
      full.composition.branches.map((branch) => [branch.branchId, branch] as const),
    );

    for (const branch of partialComposition.branches) {
      expect(fullByBranchId.get(branch.branchId)).toEqual(branch);
    }
  });
});
