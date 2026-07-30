import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_ROOT_GEOMETRY_CONFIG } from './config';
import { buildTreeRootGeometry } from './treeRootGeometry';

function build(lod: 'high' | 'medium' | 'low') {
  const preview = buildTreeLabPreview('medium');
  return buildTreeRootGeometry({
    roots: preview.roots,
    lod,
    config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  });
}

describe('Tree Root Geometry Integration Lab', () => {
  it('is deterministic, provenance-safe and inside the dedicated mobile budget', () => {
    const first = build('medium');
    const second = build('medium');

    expect(second).toEqual(first);
    expect(first.mesh.branches.map((branch) => branch.branchId)).toEqual(
      buildTreeLabPreview('medium').roots.roots.map((root) => root.id),
    );
    expect(first.diagnostics.renderedRootCount).toBe(first.diagnostics.sourceRootCount);
    expect(first.diagnostics.vertexBudgetExceeded).toBe(false);
    expect(first.diagnostics.triangleBudgetExceeded).toBe(false);
    expect(first.diagnostics.missingRootMeshIds).toEqual([]);
    expect(first.diagnostics.unexpectedMeshBranchIds).toEqual([]);
    expect(first.diagnostics.estimatedDrawCalls).toBe(first.diagnostics.renderedRootCount > 0 ? 1 : 0);
    expect(first.diagnostics.anchoredToGround).toBe(true);
  });

  it('keeps logical roots stable while geometry complexity decreases by LOD', () => {
    const high = build('high');
    const medium = build('medium');
    const low = build('low');

    expect(high.mesh.branches.map((branch) => branch.branchId)).toEqual(
      medium.mesh.branches.map((branch) => branch.branchId),
    );
    expect(medium.mesh.branches.map((branch) => branch.branchId)).toEqual(
      low.mesh.branches.map((branch) => branch.branchId),
    );
    expect(high.diagnostics.vertexCount).toBeGreaterThanOrEqual(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThanOrEqual(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThanOrEqual(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThanOrEqual(low.diagnostics.triangleCount);
  });

  it('does not mutate accepted root architecture', () => {
    const preview = buildTreeLabPreview('medium');
    const before = JSON.stringify(preview.roots);

    buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
    });

    expect(JSON.stringify(preview.roots)).toBe(before);
  });

  it('rejects publication when a configured mesh budget is exceeded', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
        maximumVerticesByLod: {
          ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.maximumVerticesByLod,
          medium: 0,
        },
      },
    })).toThrow(/exceeded the medium mobile mesh budget/);
  });
});
