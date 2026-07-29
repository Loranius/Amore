import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { sampleTreeLifeFrame } from '../../treeLife';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';
import {
  applyThreeTreeLifeFrame,
  createThreeTreeLifeBinding,
} from './treeLife';

function expectMatrixClose(actual: THREE.Matrix4, expected: THREE.Matrix4) {
  actual.elements.forEach((value, index) => {
    expect(value).toBeCloseTo(expected.elements[index] ?? 0, 5);
  });
}

describe('Three Tree Life adapter', () => {
  it('updates renderer transforms without allocating draw calls', () => {
    const build = buildTreeLabPreview('medium');
    const materials = createThreeTreeMaterialPair(build.materials);
    const leaves = createThreeTreeLeafInstancedMesh(build.leaves, materials.foliage);
    const root = new THREE.Group();
    root.add(leaves);
    const binding = createThreeTreeLifeBinding(root, leaves);
    const base = new THREE.Matrix4();
    const moved = new THREE.Matrix4();
    leaves.getMatrixAt(0, base);

    applyThreeTreeLifeFrame(
      binding,
      sampleTreeLifeFrame({ life: build.life, elapsedSeconds: 7.25 }),
    );
    leaves.getMatrixAt(0, moved);

    expect(binding.root.userData['treeLife']).toMatchObject({
      leafInstances: build.leaves.instances.length,
      additionalDrawCalls: 0,
    });
    expect(
      Math.abs(root.rotation.x) + Math.abs(root.rotation.y) + Math.abs(root.rotation.z),
    ).toBeGreaterThan(0);
    expect(moved.elements).not.toEqual(base.elements);

    applyThreeTreeLifeFrame(
      binding,
      sampleTreeLifeFrame({
        life: build.life,
        elapsedSeconds: 7.25,
        reducedMotion: true,
      }),
    );
    leaves.getMatrixAt(0, moved);

    expect(root.rotation.x).toBe(0);
    expect(root.rotation.y).toBe(0);
    expect(root.rotation.z).toBe(0);
    expectMatrixClose(moved, base);

    leaves.geometry.dispose();
    materials.bark.dispose();
    materials.foliage.dispose();
  });
});
