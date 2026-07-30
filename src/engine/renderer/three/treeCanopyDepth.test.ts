import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';

function dispose(mesh: THREE.InstancedMesh, material: THREE.Material): void {
  mesh.geometry.dispose();
  material.dispose();
}

describe('Three Tree Canopy Depth adapter', () => {
  it('applies depth transforms and instance colors without another mesh', () => {
    const build = buildTreeLabPreview('medium');
    const plainMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const canopyMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const plain = createThreeTreeLeafInstancedMesh(build.leaves, plainMaterials.foliage);
    const canopy = createThreeTreeLeafInstancedMesh(
      build.leaves,
      canopyMaterials.foliage,
      build.canopyDepth,
    );

    expect(canopy.count).toBe(build.leaves.instances.length);
    expect(canopy.instanceColor?.count).toBe(build.leaves.instances.length);
    expect(canopy.userData['treeCanopyDepth']).toMatchObject({
      id: 'tree:canopy-depth:volume',
      profileId: 'tree:canopy-depth:instance-profile',
      tintAttributeId: 'tree:canopy-depth:instance-tint',
      profiles: build.leaves.instances.length,
      additionalDrawCalls: 0,
      additionalMaterials: 0,
    });
    expect(canopy.userData['treeLeafGeometry']).toMatchObject({
      canopyDepthApplied: true,
      estimatedDrawCalls: 1,
    });

    const plainMatrix = new THREE.Matrix4();
    const canopyMatrix = new THREE.Matrix4();
    plain.getMatrixAt(0, plainMatrix);
    canopy.getMatrixAt(0, canopyMatrix);
    expect(canopyMatrix.elements).not.toEqual(plainMatrix.elements);

    const color = new THREE.Color();
    canopy.getColorAt(0, color);
    const firstTint = build.canopyDepth.profiles[0]?.tintMultiplier;
    expect(firstTint).toBeDefined();
    expect(color.r).toBeCloseTo(firstTint?.r ?? 0, 5);
    expect(color.g).toBeCloseTo(firstTint?.g ?? 0, 5);
    expect(color.b).toBeCloseTo(firstTint?.b ?? 0, 5);

    dispose(plain, plainMaterials.foliage);
    plainMaterials.bark.dispose();
    dispose(canopy, canopyMaterials.foliage);
    canopyMaterials.bark.dispose();
  });

  it('rejects profiles from another leaf state', () => {
    const medium = buildTreeLabPreview('medium');
    const low = buildTreeLabPreview('low');
    const materials = createThreeTreeMaterialPair(medium.materials, medium.barkSurface);

    expect(() => createThreeTreeLeafInstancedMesh(
      medium.leaves,
      materials.foliage,
      low.canopyDepth,
    )).toThrow(/another leaf state/);

    materials.bark.dispose();
    materials.foliage.dispose();
  });
});
