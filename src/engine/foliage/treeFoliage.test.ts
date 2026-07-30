import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREE_COMPOSITION_CONFIG,
  buildTreeComposition,
} from '../composition';
import { buildOrganicCurveFrames } from '../labs/organic';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_FOLIAGE_CONFIG } from './config';
import { buildTreeFoliage } from './treeFoliage';

describe('Tree Foliage', () => {
  it('is deterministic and stays inside the mobile canopy budget', () => {
    const first = buildTreeLabPreview('medium').foliage;
    const second = buildTreeLabPreview('medium').foliage;

    expect(second).toEqual(first);
    expect(first.clusters.length).toBeGreaterThan(0);
    expect(first.clusters.length).toBeLessThanOrEqual(DEFAULT_TREE_FOLIAGE_CONFIG.maxClusters);
    expect(first.diagnostics.totalLeafCount).toBeLessThanOrEqual(
      DEFAULT_TREE_FOLIAGE_CONFIG.maxLeaves,
    );
    expect(first.diagnostics.emittedClusterCount).toBe(first.clusters.length);
    expect(first.diagnostics.occupiedCellIds).toEqual(
      [...first.diagnostics.occupiedCellIds].sort(),
    );
  });

  it('emits normalized local cluster data outside the branch surface', () => {
    const build = buildTreeLabPreview('medium');

    for (const cluster of build.foliage.clusters) {
      expect(cluster.role).not.toBe('trunk');
      expect(cluster.generation).toBeGreaterThanOrEqual(1);
      expect(cluster.radius).toBeGreaterThanOrEqual(DEFAULT_TREE_FOLIAGE_CONFIG.minClusterRadius);
      expect(cluster.radius).toBeLessThanOrEqual(DEFAULT_TREE_FOLIAGE_CONFIG.maxClusterRadius);
      expect(cluster.density).toBeGreaterThanOrEqual(0);
      expect(cluster.density).toBeLessThanOrEqual(1);
      expect(cluster.leafCount).toBeGreaterThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.minLeavesPerCluster,
      );
      expect(cluster.leafCount).toBeLessThanOrEqual(
        DEFAULT_TREE_FOLIAGE_CONFIG.maxLeavesPerCluster,
      );
      expect(Math.hypot(cluster.direction.x, cluster.direction.y, cluster.direction.z)).toBeCloseTo(1, 5);
      expect(Math.hypot(cluster.normal.x, cluster.normal.y, cluster.normal.z)).toBeCloseTo(1, 5);
    }
  });

  it('fills interior branch spans instead of publishing only terminal-tip foliage', () => {
    const build = buildTreeLabPreview('medium');
    const samplesById = new Map(
      build.frames.curves.flatMap((curve) => (
        curve.samples.map((sample) => [sample.id, sample] as const)
      )),
    );
    const normalizedDistances = build.foliage.clusters
      .map((cluster) => samplesById.get(cluster.sourceSampleId)?.normalizedDistance)
      .filter((value): value is number => value !== undefined);
    const interiorClusters = normalizedDistances.filter((distance) => distance < 0.58);

    expect(normalizedDistances).toHaveLength(build.foliage.clusters.length);
    expect(Math.min(...normalizedDistances)).toBeLessThan(0.5);
    expect(interiorClusters.length).toBeGreaterThanOrEqual(
      Math.ceil(build.foliage.clusters.length * 0.2),
    );
    expect(build.foliage.diagnostics.occupiedCellIds.length).toBeGreaterThanOrEqual(4);
    expect(build.leaves.diagnostics.clusterIdsWithoutInstances).toEqual([]);
    expect(build.leaves.instances.length).toBeGreaterThanOrEqual(
      Math.floor(build.foliage.diagnostics.totalLeafCount * 0.68),
    );
  });

  it('does not mutate species, frames or composition', () => {
    const build = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(build.species);
    const framesBefore = JSON.stringify(build.frames);
    const compositionBefore = JSON.stringify(build.composition);

    buildTreeFoliage({
      species: build.species,
      frames: build.frames,
      composition: build.composition,
      config: DEFAULT_TREE_FOLIAGE_CONFIG,
    });

    expect(JSON.stringify(build.species)).toBe(speciesBefore);
    expect(JSON.stringify(build.frames)).toBe(framesBefore);
    expect(JSON.stringify(build.composition)).toBe(compositionBefore);
  });

  it('keeps earlier cluster identities and placement stable without later branches', () => {
    const full = buildTreeLabPreview('medium');
    const prefixCurves = full.frames.curves.slice(0, Math.min(8, full.frames.curves.length));
    const retainedBranchIds = new Set(prefixCurves.map((curve) => curve.branchId));
    retainedBranchIds.add('organic:trunk');
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
    const partialFoliage = buildTreeFoliage({
      species: full.species,
      frames: partialFrames,
      composition: partialComposition,
      config: DEFAULT_TREE_FOLIAGE_CONFIG,
    });
    const fullById = new Map(
      full.foliage.clusters.map((cluster) => [cluster.id, cluster] as const),
    );

    for (const cluster of partialFoliage.clusters) {
      expect(fullById.get(cluster.id)).toEqual(cluster);
    }
  });

  it('truncates only later candidates when budgets are constrained', () => {
    const build = buildTreeLabPreview('medium');
    const constrained = buildTreeFoliage({
      species: build.species,
      frames: build.frames,
      composition: build.composition,
      config: {
        ...DEFAULT_TREE_FOLIAGE_CONFIG,
        maxClusters: 4,
        maxLeaves: 60,
      },
    });

    expect(constrained.clusters.length).toBeLessThanOrEqual(4);
    expect(constrained.diagnostics.totalLeafCount).toBeLessThanOrEqual(60);
    expect(constrained.diagnostics.truncatedClusterIds.length).toBeGreaterThan(0);
    for (const cluster of constrained.clusters) {
      const source = build.foliage.clusters.find((candidate) => candidate.id === cluster.id);
      expect(source).toBeDefined();
      const { sequence: _constrainedSequence, ...stableCluster } = cluster;
      const { sequence: _sourceSequence, ...stableSource } = source!;
      expect(stableCluster).toEqual(stableSource);
    }
  });
});
