import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeTreeMaterialPair } from './treeMaterials';

describe('Three.js Tree Material adapter', () => {
  it('creates one bark and one foliage material from the published bindings', () => {
    const state = buildTreeLabPreview('medium').materials;
    const pair = createThreeTreeMaterialPair(state);

    expect(pair.bark).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(pair.foliage).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(pair.bark.userData['treeMaterialRole']).toBe('bark');
    expect(pair.foliage.userData['treeMaterialRole']).toBe('foliage');
    expect(pair.bark.side).toBe(THREE.FrontSide);
    expect(pair.foliage.side).toBe(THREE.DoubleSide);
    expect(pair.bark.transparent).toBe(false);
    expect(pair.foliage.transparent).toBe(false);
    expect(pair.bark.vertexColors).toBe(true);
    expect(pair.foliage.vertexColors).toBe(false);
    expect(pair.bark.userData['treeVertexTintEnabled']).toBe(true);
    expect(pair.foliage.userData['treeVertexTintEnabled']).toBe(false);
    expect(pair.bark.userData['treeMaterialColorSpace']).toBe('tree-linear-srgb-v1');
    expect(pair.foliage.userData['treeMaterialColorSpace']).toBe('tree-linear-srgb-v1');

    const expectedBark = new THREE.Color()
      .setRGB(state.palette.bark.r, state.palette.bark.g, state.palette.bark.b)
      .convertSRGBToLinear();
    expect(pair.bark.color.r).toBeCloseTo(expectedBark.r, 7);
    expect(pair.bark.color.g).toBeCloseTo(expectedBark.g, 7);
    expect(pair.bark.color.b).toBeCloseTo(expectedBark.b, 7);
    expect(pair.bark.color.r).toBeLessThan(state.palette.bark.r);
    expect(pair.foliage.color.g).toBeLessThan(state.palette.foliage.g);

    pair.bark.dispose();
    pair.foliage.dispose();
  });
});
