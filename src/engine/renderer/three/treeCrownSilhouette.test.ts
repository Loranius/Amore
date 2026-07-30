import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';

function dispose(mesh: THREE.InstancedMesh, material: THREE.Material): void {
  mesh.geometry.dispose();
  material.dispose();
}

describe('Three Tree Crown Silhouette adapter', () => {
  it('polishes accepted matrices inside the existing leaf draw call without changing colors', () => {
    const build = buildTreeLabPreview('medium');
    const adjustedIndex = build.crownSilhouette.profiles.findIndex((profile) => profile.adjusted);
    expect(adjustedIndex).toBeGreaterThanOrEqual(0);

    const baseMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const polishedMaterials = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const base = createThreeTreeLeafInstancedMesh(
      build.leaves,
      baseMaterials.foliage,
      build.canopyDepth,
      build.canopyLight,
      build.phenology,
      build.leafOrientation,
    );
    const polished = createThreeTreeLeafInstancedMesh(
      build.leaves,
      polishedMaterials.foliage,
      build.canopyDepth,
      build.canopyLight,
      build.phenology,
      build.leafOrientation,
      build.crownSilhouette,
    );

    expect(polished.count).toBe(build.leaves.instances.length);
    expect(polished.userData['treeLeafGeometry']).toMatchObject({
      estimatedDrawCalls: 1,
      crownSilhouetteApplied: true,
    });
    expect(polished.userData['treeCrownSilhouette']).toMatchObject({
      id: 'tree:crown-silhouette:polish',
      profileId: 'tree:crown-silhouette:instance-profile',
      negativeSpaceId: 'tree:crown-silhouette:negative-space',
      profiles: build.leaves.instances.length,
      negativeSpaceAccepted: true,
      additionalDrawCalls: 0,
      additionalMaterials: 0,
    });

    const baseMatrix = new THREE.Matrix4();
    const polishedMatrix = new THREE.Matrix4();
    base.getMatrixAt(adjustedIndex, baseMatrix);
    polished.getMatrixAt(adjustedIndex, polishedMatrix);
    expect(polishedMatrix.elements).not.toEqual(baseMatrix.elements);

    const baseColor = new THREE.Color();
    const polishedColor = new THREE.Color();
    base.getColorAt(adjustedIndex, baseColor);
    polished.getColorAt(adjustedIndex, polishedColor);
    expect(polishedColor.r).toBeCloseTo(baseColor.r, 6);
    expect(polishedColor.g).toBeCloseTo(baseColor.g, 6);
    expect(polishedColor.b).toBeCloseTo(baseColor.b, 6);

    dispose(base, baseMaterials.foliage);
    baseMaterials.bark.dispose();
    dispose(polished, polishedMaterials.foliage);
    polishedMaterials.bark.dispose();
  });
});
