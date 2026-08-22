import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_LEAF_GEOMETRY_CONFIG } from './config';
import { buildTreeLeafGeometry } from './treeLeafGeometry';

function withoutBuildTime<T extends { buildMs: number }>(value: T): Omit<T, 'buildMs'> {
  const { buildMs: _buildMs, ...stable } = value;
  return stable;
}

describe('Tree Leaf Geometry', () => {
  it('is deterministic and stays inside the published instance budget', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(withoutBuildTime(second).leaves).toEqual(withoutBuildTime(first).leaves);
    expect(first.leaves.instances.length).toBeGreaterThan(0);
    expect(first.leaves.instances.length).toBeLessThanOrEqual(
      DEFAULT_TREE_LEAF_GEOMETRY_CONFIG.maxInstancesByLod.medium,
    );
    expect(first.leaves.diagnostics.renderedInstanceCount).toBe(first.leaves.instances.length);
    expect(first.leaves.diagnostics.renderedTriangleCount).toBe(
      first.leaves.template.triangleCount * first.leaves.instances.length,
    );
    expect(first.leaves.diagnostics.estimatedDrawCalls).toBe(1);
  });

  it('uses one valid shared card topology per LOD', () => {
    const low = buildTreeLabPreview('low').leaves;
    const medium = buildTreeLabPreview('medium').leaves;
    const high = buildTreeLabPreview('high').leaves;

    expect(low.template.vertexCount).toBeLessThan(medium.template.vertexCount);
    expect(medium.template.vertexCount).toBeLessThan(high.template.vertexCount);
    expect(low.template.triangleCount).toBeLessThan(medium.template.triangleCount);
    expect(medium.template.triangleCount).toBeLessThan(high.template.triangleCount);

    for (const state of [low, medium, high]) {
      expect(state.template.positions.length).toBe(state.template.vertexCount * 3);
      expect(state.template.uvs.length).toBe(state.template.vertexCount * 2);
      expect(state.template.indices.length).toBe(state.template.triangleCount * 3);
      expect(Math.max(...state.template.indices)).toBeLessThan(state.template.vertexCount);
    }
  });

  it('gives medium and high leaves an asymmetric curled blade without extra draw calls', () => {
    for (const state of [
      buildTreeLabPreview('medium').leaves,
      buildTreeLabPreview('high').leaves,
    ]) {
      const rowCount = state.template.vertexCount / 2;
      const rows = Array.from({ length: rowCount }, (_value, row) => {
        const left = row * 6;
        const right = left + 3;
        return {
          centerX: ((state.template.positions[left] ?? 0)
            + (state.template.positions[right] ?? 0)) / 2,
          edgeDepthDelta: Math.abs(
            (state.template.positions[left + 2] ?? 0)
              - (state.template.positions[right + 2] ?? 0),
          ),
        };
      });

      expect(rows.some((row) => Math.abs(row.centerX) > 0.001)).toBe(true);
      expect(rows.some((row) => row.edgeDepthDelta > 0.001)).toBe(true);
      expect(state.diagnostics.estimatedDrawCalls).toBe(1);
    }
  });

  it('keeps lower LOD leaf identities and transforms stable in higher LODs', () => {
    const low = buildTreeLabPreview('low').leaves;
    const medium = buildTreeLabPreview('medium').leaves;
    const high = buildTreeLabPreview('high').leaves;
    const mediumById = new Map(medium.instances.map((instance) => [instance.id, instance] as const));
    const highById = new Map(high.instances.map((instance) => [instance.id, instance] as const));

    expect(low.instances.length).toBeLessThanOrEqual(medium.instances.length);
    expect(medium.instances.length).toBeLessThanOrEqual(high.instances.length);
    for (const instance of low.instances) {
      expect(mediumById.get(instance.id)).toEqual({
        ...instance,
        sequence: mediumById.get(instance.id)?.sequence,
      });
      expect(highById.get(instance.id)).toEqual({
        ...instance,
        sequence: highById.get(instance.id)?.sequence,
      });
    }
  });

  it('does not mutate the accepted foliage state', () => {
    const build = buildTreeLabPreview('medium');
    const before = JSON.stringify(build.foliage);

    buildTreeLeafGeometry({
      foliage: build.foliage,
      lod: 'medium',
      config: DEFAULT_TREE_LEAF_GEOMETRY_CONFIG,
    });

    expect(JSON.stringify(build.foliage)).toBe(before);
  });

  it('truncates only later leaf candidates when the instance budget is constrained', () => {
    const build = buildTreeLabPreview('medium');
    const constrained = buildTreeLeafGeometry({
      foliage: build.foliage,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_LEAF_GEOMETRY_CONFIG,
        maxInstancesByLod: {
          ...DEFAULT_TREE_LEAF_GEOMETRY_CONFIG.maxInstancesByLod,
          medium: 12,
        },
      },
    });
    const fullById = new Map(build.leaves.instances.map((instance) => [instance.id, instance] as const));

    expect(constrained.instances).toHaveLength(12);
    expect(constrained.diagnostics.instanceBudgetReached).toBe(true);
    expect(constrained.diagnostics.truncatedInstanceIds.length).toBeGreaterThan(0);
    for (const instance of constrained.instances) {
      expect(fullById.get(instance.id)).toEqual(instance);
    }
  });
});
