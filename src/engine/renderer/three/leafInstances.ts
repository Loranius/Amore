import * as THREE from 'three';
import type {
  TreeLeafGeometryState,
  TreeLeafInstance,
} from '../../leafGeometry';

function vector(value: TreeLeafInstance['position']): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function matrixForInstance(instance: TreeLeafInstance): THREE.Matrix4 {
  const yAxis = vector(instance.direction).normalize();
  const sourceNormal = vector(instance.normal);
  const projectedNormal = sourceNormal.sub(
    yAxis.clone().multiplyScalar(sourceNormal.dot(yAxis)),
  );
  if (projectedNormal.lengthSq() <= 1e-10) {
    projectedNormal.copy(Math.abs(yAxis.y) < 0.92
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0));
    projectedNormal.sub(yAxis.clone().multiplyScalar(projectedNormal.dot(yAxis)));
  }
  const zAxis = projectedNormal.normalize();
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  zAxis.crossVectors(xAxis, yAxis).normalize();

  const cosine = Math.cos(instance.rollRad);
  const sine = Math.sin(instance.rollRad);
  const rolledX = xAxis.clone().multiplyScalar(cosine).addScaledVector(zAxis, sine);
  const rolledZ = zAxis.clone().multiplyScalar(cosine).addScaledVector(xAxis, -sine);
  const basis = new THREE.Matrix4().makeBasis(rolledX, yAxis, rolledZ);
  const size = new THREE.Matrix4().makeScale(instance.width, instance.length, instance.width);
  const matrix = new THREE.Matrix4().multiplyMatrices(basis, size);
  matrix.setPosition(vector(instance.position));
  return matrix;
}

export function createThreeTreeLeafCardGeometry(
  state: TreeLeafGeometryState,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(state.template.positions, 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(state.template.uvs, 2),
  );
  geometry.setIndex(state.template.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData['treeLeafGeometry'] = {
    lod: state.lod,
    sharedVertices: state.template.vertexCount,
    sharedTriangles: state.template.triangleCount,
  };
  return geometry;
}

/** Creates one InstancedMesh and therefore one leaf draw call. */
export function createThreeTreeLeafInstancedMesh(
  state: TreeLeafGeometryState,
  material: THREE.Material,
): THREE.InstancedMesh {
  const geometry = createThreeTreeLeafCardGeometry(state);
  const mesh = new THREE.InstancedMesh(geometry, material, state.instances.length);
  mesh.name = 'TreeLeafInstances';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  for (const instance of state.instances) {
    mesh.setMatrixAt(instance.sequence, matrixForInstance(instance));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData['treeLeafGeometry'] = {
    lod: state.lod,
    instances: state.instances.length,
    renderedTriangles: state.diagnostics.renderedTriangleCount,
    estimatedDrawCalls: state.diagnostics.estimatedDrawCalls,
  };
  return mesh;
}
