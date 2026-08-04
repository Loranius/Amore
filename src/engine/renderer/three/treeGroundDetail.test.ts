import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeGroundDetailInstancedMesh } from './treeGroundDetail';

function dispose(mesh: ReturnType<typeof createThreeTreeGroundDetailInstancedMesh>) {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    for (const material of mesh.material) material.dispose();
  } else {
    mesh.material.dispose();
  }
}

describe('Three Tree Ground Detail adapter', () => {
  it('creates one colored InstancedMesh for all three detail kinds', () => {
    const state = buildTreeLabPreview('medium').groundDetails;
    const mesh = createThreeTreeGroundDetailInstancedMesh(state);

    // 72 -> 24 with tree-ground-detail v1.1.0: the litter budget was thinned
    // because an even scatter of seventy-two chips read as sprinkles. The
    // adapter's own invariant — one InstancedMesh, one colour per instance —
    // is what this test is for, and it is unchanged.
    expect(mesh.count).toBe(24);
    expect(mesh.instanceColor?.count).toBe(24);
    expect(mesh.geometry.getAttribute('position').count).toBe(state.template.vertexCount);
    expect(mesh.geometry.getIndex()?.count).toBe(state.template.indices.length);
    expect(mesh.userData['treeGroundDetail']).toMatchObject({
      id: 'tree:ground-detail:field',
      templateId: 'tree:ground-detail:shared-chip',
      materialId: 'tree:ground-detail:material',
      instances: 24,
      stones: 8,
      fallenLeaves: 8,
      moss: 8,
      estimatedDrawCalls: 1,
      anchoredToTerrain: true,
    });
    expect(Array.isArray(mesh.material)).toBe(false);
    expect(mesh.frustumCulled).toBe(false);

    dispose(mesh);
  });
});
