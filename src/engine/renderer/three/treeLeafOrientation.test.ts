import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';

function dispose(mesh: THREE.InstancedMesh, material: THREE.Material): void {
  mesh.geometry.dispose();
  material.dispose();
}

describe('Three Tree Leaf Orientation adapter', () => {
  it('changes only accepted instance matrices inside the existing leaf draw call', () => {
    const build = buildTreeLabPreview('medium');
    const plainMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const orientedMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const plain = createThreeTreeLeafInstancedMesh(
      build.leaves,
      plainMaterials.foliage,
      build.canopyDepth,
      build.canopyLight,
      build.phenology,
    );
    const oriented = createThreeTreeLeafInstancedMesh(
      build.leaves,
      orientedMaterials.foliage,
      build.canopyDepth,
      build.canopyLight,
      build.phenology,
      build.leafOrientation,
    );

    expect(oriented.count).toBe(build.leaves.instances.length);
    expect(oriented.userData['treeLeafGeometry']).toMatchObject({
      estimatedDrawCalls: 1,
      leafOrientationApplied: true,
    });
    expect(oriented.userData['treeLeafOrientation']).toMatchObject({
      id: 'tree:leaf-orientation:micro-variation',
      profileId: 'tree:leaf-orientation:instance-profile',
      profiles: build.leaves.instances.length,
      additionalDrawCalls: 0,
      additionalMaterials: 0,
    });

    const variedIndex = build.leafOrientation.profiles.findIndex(
      (profile) => profile.totalRotationRad > 1e-9,
    );
    expect(variedIndex).toBeGreaterThanOrEqual(0);
    const plainMatrix = new THREE.Matrix4();
    const orientedMatrix = new THREE.Matrix4();
    plain.getMatrixAt(variedIndex, plainMatrix);
    oriented.getMatrixAt(variedIndex, orientedMatrix);
    expect(orientedMatrix.elements).not.toEqual(plainMatrix.elements);

    const plainColor = new THREE.Color();
    const orientedColor = new THREE.Color();
    plain.getColorAt(variedIndex, plainColor);
    oriented.getColorAt(variedIndex, orientedColor);
    expect(orientedColor.r).toBeCloseTo(plainColor.r, 6);
    expect(orientedColor.g).toBeCloseTo(plainColor.g, 6);
    expect(orientedColor.b).toBeCloseTo(plainColor.b, 6);

    dispose(plain, plainMaterials.foliage);
    plainMaterials.bark.dispose();
    dispose(oriented, orientedMaterials.foliage);
    orientedMaterials.bark.dispose();
  });
});
