import * as THREE from 'three';
import type {
  TreeCanopyDepthProfile,
  TreeCanopyDepthState,
} from '../../canopyDepth';
import type {
  TreeLeafGeometryState,
  TreeLeafInstance,
} from '../../leafGeometry';

function vector(value: TreeLeafInstance['position']): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function matrixForInstance(
  instance: TreeLeafInstance,
  canopyProfile?: TreeCanopyDepthProfile,
): THREE.Matrix4 {
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
  const scaleMultiplier = canopyProfile?.scaleMultiplier ?? 1;
  const size = new THREE.Matrix4().makeScale(
    instance.width * scaleMultiplier,
    instance.length * scaleMultiplier,
    instance.width * scaleMultiplier,
  );
  const matrix = new THREE.Matrix4().multiplyMatrices(basis, size);
  matrix.setPosition(vector(canopyProfile?.renderPosition ?? instance.position));
  return matrix;
}

function validateCanopyDepth(
  leaves: TreeLeafGeometryState,
  canopy: TreeCanopyDepthState,
): void {
  if (canopy.artifactSeed !== leaves.artifactSeed
    || canopy.lod !== leaves.lod
    || canopy.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopy.sourceLeafGeometryRulesVersion !== leaves.rulesVersion) {
    throw new Error('Three Tree Leaf Geometry received Canopy Depth from another leaf state.');
  }
  if (canopy.profiles.length !== leaves.instances.length) {
    throw new Error('Three Tree Leaf Geometry Canopy Depth profile count does not match leaves.');
  }
  for (let index = 0; index < leaves.instances.length; index += 1) {
    const leaf = leaves.instances[index];
    const profile = canopy.profiles[index];
    if (!leaf || !profile || profile.sequence !== index || profile.leafInstanceId !== leaf.id) {
      throw new Error('Three Tree Leaf Geometry Canopy Depth order does not match leaves.');
    }
  }
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
  canopy?: TreeCanopyDepthState,
): THREE.InstancedMesh {
  if (canopy) validateCanopyDepth(state, canopy);
  const geometry = createThreeTreeLeafCardGeometry(state);
  const mesh = new THREE.InstancedMesh(geometry, material, state.instances.length);
  mesh.name = 'TreeLeafInstances';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  for (const instance of state.instances) {
    const profile = canopy?.profiles[instance.sequence];
    mesh.setMatrixAt(instance.sequence, matrixForInstance(instance, profile));
    if (profile) {
      mesh.setColorAt(
        instance.sequence,
        new THREE.Color(
          profile.tintMultiplier.r,
          profile.tintMultiplier.g,
          profile.tintMultiplier.b,
        ),
      );
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData['treeLeafGeometry'] = {
    lod: state.lod,
    instances: state.instances.length,
    renderedTriangles: state.diagnostics.renderedTriangleCount,
    estimatedDrawCalls: state.diagnostics.estimatedDrawCalls,
    canopyDepthApplied: canopy !== undefined,
  };
  if (canopy) {
    mesh.userData['treeCanopyDepth'] = {
      version: canopy.treeCanopyDepthVersion,
      rulesVersion: canopy.rulesVersion,
      id: canopy.descriptor.id,
      profileId: canopy.descriptor.profileId,
      tintAttributeId: canopy.descriptor.tintAttributeId,
      signature: canopy.signature,
      profiles: canopy.profiles.length,
      inner: canopy.diagnostics.innerLeafCount,
      middle: canopy.diagnostics.middleLeafCount,
      outer: canopy.diagnostics.outerLeafCount,
      uniqueTints: canopy.diagnostics.uniqueTintCount,
      additionalDrawCalls: canopy.diagnostics.estimatedAdditionalDrawCalls,
      additionalMaterials: canopy.diagnostics.estimatedAdditionalMaterials,
    };
  }
  return mesh;
}
