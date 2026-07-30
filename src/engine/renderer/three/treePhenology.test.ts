import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';

describe('Three Tree Phenology adapter', () => {
  it('uses the existing leaf InstancedMesh and writes final seasonal colors', () => {
    const build = buildTreeLabPreview('medium');
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const mesh = createThreeTreeLeafInstancedMesh(
      build.leaves,
      material,
      build.canopyDepth,
      build.canopyLight,
      build.phenology,
    );

    expect(mesh.count).toBe(build.leaves.instances.length);
    expect(mesh.instanceColor?.count).toBe(build.leaves.instances.length);
    expect(mesh.userData['treeLeafGeometry']).toMatchObject({
      estimatedDrawCalls: 1,
      phenologyApplied: true,
    });
    expect(mesh.userData['treePhenology']).toMatchObject({
      id: 'tree:phenology:seasonal-accent',
      phase: build.phenology.phase,
      profiles: build.leaves.instances.length,
      additionalDrawCalls: 0,
      additionalMaterials: 0,
    });

    mesh.geometry.dispose();
    material.dispose();
  });
});
