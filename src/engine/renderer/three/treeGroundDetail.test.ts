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

    expect(mesh.count).toBe(72);
    expect(mesh.instanceColor?.count).toBe(72);
    expect(mesh.geometry.getAttribute('position').count).toBe(state.template.vertexCount);
    expect(mesh.geometry.getIndex()?.count).toBe(state.template.indices.length);
    expect(mesh.userData['treeGroundDetail']).toMatchObject({
      id: 'tree:ground-detail:field',
      templateId: 'tree:ground-detail:shared-chip',
      materialId: 'tree:ground-detail:material',
      instances: 72,
      stones: 24,
      fallenLeaves: 24,
      moss: 24,
      estimatedDrawCalls: 1,
      anchoredToTerrain: true,
    });
    expect(mesh.material).not.toBeInstanceOf(Array);
    expect(mesh.frustumCulled).toBe(false);

    dispose(mesh);
  });
});
