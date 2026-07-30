import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';

function dispose(mesh: THREE.InstancedMesh, material: THREE.Material): void {
  mesh.geometry.dispose();
  material.dispose();
}

describe('Three Tree Canopy Light adapter', () => {
  it('applies combined depth and light tint in the existing leaf InstancedMesh', () => {
    const build = buildTreeLabPreview('medium');
    const depthMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const lightMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const depthOnly = createThreeTreeLeafInstancedMesh(
      build.leaves,
      depthMaterials.foliage,
      build.canopyDepth,
    );
    const lit = createThreeTreeLeafInstancedMesh(
      build.leaves,
      lightMaterials.foliage,
      build.canopyDepth,
      build.canopyLight,
    );

    expect(lit.count).toBe(build.leaves.instances.length);
    expect(lit.instanceColor?.count).toBe(build.leaves.instances.length);
    expect(lit.userData['treeCanopyLight']).toMatchObject({
      id: 'tree:canopy-light:response',
      profileId: 'tree:canopy-light:instance-profile',
      tintAttributeId: 'tree:canopy-light:instance-tint',
      profiles: build.leaves.instances.length,
      additionalDrawCalls: 0,
      additionalMaterials: 0,
    });
    expect(lit.userData['treeLeafGeometry']).toMatchObject({
      canopyDepthApplied: true,
      canopyLightApplied: true,
      estimatedDrawCalls: 1,
    });

    const depthMatrix = new THREE.Matrix4();
    const lightMatrix = new THREE.Matrix4();
    depthOnly.getMatrixAt(0, depthMatrix);
    lit.getMatrixAt(0, lightMatrix);
    expect(lightMatrix.elements).toEqual(depthMatrix.elements);

    const depthColor = new THREE.Color();
    const lightColor = new THREE.Color();
    depthOnly.getColorAt(0, depthColor);
    lit.getColorAt(0, lightColor);
    const expected = build.canopyLight.profiles[0]?.combinedTintMultiplier;
    expect(expected).toBeDefined();
    expect(lightColor.r).toBeCloseTo(expected?.r ?? 0, 5);
    expect(lightColor.g).toBeCloseTo(expected?.g ?? 0, 5);
    expect(lightColor.b).toBeCloseTo(expected?.b ?? 0, 5);
    expect([lightColor.r, lightColor.g, lightColor.b]).not.toEqual([
      depthColor.r,
      depthColor.g,
      depthColor.b,
    ]);

    dispose(depthOnly, depthMaterials.foliage);
    depthMaterials.bark.dispose();
    dispose(lit, lightMaterials.foliage);
    lightMaterials.bark.dispose();
  });

  it('rejects Canopy Light from another depth state', () => {
    const medium = buildTreeLabPreview('medium');
    const low = buildTreeLabPreview('low');
    const materials = createThreeTreeMaterialPair(medium.materials, medium.barkSurface);

    expect(() => createThreeTreeLeafInstancedMesh(
      medium.leaves,
      materials.foliage,
      medium.canopyDepth,
      low.canopyLight,
    )).toThrow(/another leaf state|another Canopy Depth state/);

    materials.bark.dispose();
    materials.foliage.dispose();
  });
});
