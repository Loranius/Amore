import * as THREE from 'three';
import type { TreeGroundDetailInstance, TreeGroundDetailState } from '../../groundDetail';

function vector(value: TreeGroundDetailInstance['position']): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function matrixForInstance(instance: TreeGroundDetailInstance): THREE.Matrix4 {
  const up = new THREE.Vector3(0, 1, 0);
  const normal = vector(instance.normal).normalize();
  const align = new THREE.Quaternion().setFromUnitVectors(up, normal);
  const yaw = new THREE.Quaternion().setFromAxisAngle(up, instance.yawRad);
  const rotation = new THREE.Quaternion().multiplyQuaternions(align, yaw);
  return new THREE.Matrix4().compose(
    vector(instance.position),
    rotation,
    vector(instance.scale),
  );
}

export function createThreeTreeGroundDetailGeometry(
  state: TreeGroundDetailState,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(state.template.positions, 3),
  );
  geometry.setIndex(state.template.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData['treeGroundDetailTemplate'] = {
    id: state.template.id,
    vertices: state.template.vertexCount,
    triangles: state.template.triangleCount,
  };
  return geometry;
}

export function createThreeTreeGroundDetailMaterial(
  state: TreeGroundDetailState,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1, 1, 1),
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  material.name = state.descriptor.materialId;
  material.userData['treeGroundDetailMaterial'] = {
    id: state.descriptor.materialId,
    instanceColors: true,
    roughness: 0.96,
  };
  return material;
}

/** One shared geometry, one material and one InstancedMesh draw call. */
export function createThreeTreeGroundDetailInstancedMesh(
  state: TreeGroundDetailState,
): THREE.InstancedMesh {
  const geometry = createThreeTreeGroundDetailGeometry(state);
  const material = createThreeTreeGroundDetailMaterial(state);
  const mesh = new THREE.InstancedMesh(geometry, material, state.instances.length);
  mesh.name = 'TreeGroundDetailInstances';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  for (const instance of state.instances) {
    mesh.setMatrixAt(instance.sequence, matrixForInstance(instance));
    mesh.setColorAt(
      instance.sequence,
      new THREE.Color(instance.color.r, instance.color.g, instance.color.b),
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData['treeGroundDetail'] = {
    version: state.treeGroundDetailVersion,
    rulesVersion: state.rulesVersion,
    id: state.descriptor.id,
    templateId: state.descriptor.templateId,
    materialId: state.descriptor.materialId,
    instances: state.instances.length,
    stones: state.diagnostics.stoneCount,
    fallenLeaves: state.diagnostics.fallenLeafCount,
    moss: state.diagnostics.mossCount,
    renderedTriangles: state.diagnostics.renderedTriangleCount,
    estimatedDrawCalls: state.diagnostics.estimatedDrawCalls,
    anchoredToTerrain: state.diagnostics.anchoredToTerrain,
  };
  return mesh;
}
