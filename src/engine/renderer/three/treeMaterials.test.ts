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

    pair.bark.dispose();
    pair.foliage.dispose();
  });
});
