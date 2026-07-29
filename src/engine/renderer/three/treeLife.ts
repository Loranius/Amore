import * as THREE from 'three';
import type { TreeLifeFrame } from '../../treeLife';

interface TreeLeafBaseTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export interface ThreeTreeLifeBinding {
  root: THREE.Object3D;
  leafMesh: THREE.InstancedMesh;
  baseLeafTransforms: readonly TreeLeafBaseTransform[];
  scratch: {
    euler: THREE.Euler;
    deltaQuaternion: THREE.Quaternion;
    quaternion: THREE.Quaternion;
    matrix: THREE.Matrix4;
  };
}

/** Captures renderer-only base matrices once; accepted leaf geometry is untouched. */
export function createThreeTreeLifeBinding(
  root: THREE.Object3D,
  leafMesh: THREE.InstancedMesh,
): ThreeTreeLifeBinding {
  const matrix = new THREE.Matrix4();
  const baseLeafTransforms: TreeLeafBaseTransform[] = [];

  for (let index = 0; index < leafMesh.count; index += 1) {
    leafMesh.getMatrixAt(index, matrix);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    baseLeafTransforms.push({ position, quaternion, scale });
  }
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  root.userData['treeLife'] = {
    leafInstances: leafMesh.count,
    additionalDrawCalls: 0,
  };

  return {
    root,
    leafMesh,
    baseLeafTransforms,
    scratch: {
      euler: new THREE.Euler(0, 0, 0, 'XYZ'),
      deltaQuaternion: new THREE.Quaternion(),
      quaternion: new THREE.Quaternion(),
      matrix: new THREE.Matrix4(),
    },
  };
}

/** Applies one read-only sampled frame without changing topology or materials. */
export function applyThreeTreeLifeFrame(
  binding: ThreeTreeLifeBinding,
  frame: TreeLifeFrame,
): void {
  binding.root.rotation.set(
    frame.branchRotationX,
    frame.branchRotationY,
    frame.branchRotationZ,
  );

  for (const leaf of frame.leaves) {
    const base = binding.baseLeafTransforms[leaf.sequence];
    if (!base) continue;
    binding.scratch.euler.set(leaf.pitchRad, 0, leaf.rollRad, 'XYZ');
    binding.scratch.deltaQuaternion.setFromEuler(binding.scratch.euler);
    binding.scratch.quaternion
      .copy(base.quaternion)
      .multiply(binding.scratch.deltaQuaternion);
    binding.scratch.matrix.compose(
      base.position,
      binding.scratch.quaternion,
      base.scale,
    );
    binding.leafMesh.setMatrixAt(leaf.sequence, binding.scratch.matrix);
  }

  if (frame.leaves.length > 0) {
    binding.leafMesh.instanceMatrix.needsUpdate = true;
  }
}
