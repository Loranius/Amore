import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import {
  createThreeTreeLeafCardGeometry,
  createThreeTreeLeafInstancedMesh,
} from './leafInstances';

describe('Three.js tree leaf adapter', () => {
  it('creates the published indexed card geometry', () => {
    const state = buildTreeLabPreview('medium').leaves;
    const geometry = createThreeTreeLeafCardGeometry(state);

    expect(geometry.getAttribute('position').count).toBe(state.template.vertexCount);
    expect(geometry.getAttribute('normal').count).toBe(state.template.vertexCount);
    expect(geometry.getAttribute('uv').count).toBe(state.template.vertexCount);
    expect(geometry.getIndex()?.count).toBe(state.template.indices.length);
    expect(geometry.userData['treeLeafGeometry']).toMatchObject({
      lod: 'medium',
      sharedVertices: state.template.vertexCount,
      sharedTriangles: state.template.triangleCount,
    });

    geometry.dispose();
  });

  it('packs all leaf transforms into one InstancedMesh', () => {
    const state = buildTreeLabPreview('low').leaves;
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = createThreeTreeLeafInstancedMesh(state, material);
    const matrix = new THREE.Matrix4();

    expect(mesh.count).toBe(state.instances.length);
    expect(mesh.userData['treeLeafGeometry']).toMatchObject({
      lod: 'low',
      instances: state.instances.length,
      estimatedDrawCalls: 1,
    });
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
    }

    mesh.geometry.dispose();
    material.dispose();
  });
});
