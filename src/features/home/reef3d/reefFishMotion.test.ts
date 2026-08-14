import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildReefFish, writeReefFishMatrices } from './reefFishMotion';

describe('module-driven reef fish motion', () => {
  it('creates one append-stable route per visible completed plan', () => {
    const before = buildReefFish(3, 26122022);
    const after = buildReefFish(4, 26122022);

    expect(before).toHaveLength(3);
    expect(after).toHaveLength(4);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('writes different matrices as time advances', () => {
    const fish = buildReefFish(2, 26122022);
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      fish.length,
    );
    const dummy = new THREE.Object3D();
    const atStart = new THREE.Matrix4();
    const later = new THREE.Matrix4();

    writeReefFishMatrices(mesh, dummy, fish, 0);
    mesh.getMatrixAt(0, atStart);
    writeReefFishMatrices(mesh, dummy, fish, 8);
    mesh.getMatrixAt(0, later);

    expect(later.elements).not.toEqual(atStart.elements);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
