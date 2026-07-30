import * as THREE from 'three';
import type {
  TreeCanopyDepthProfile,
  TreeCanopyDepthState,
} from '../../canopyDepth';
import type { TreeCanopyLightState } from '../../canopyLight';
import type {
  TreeLeafGeometryState,
  TreeLeafInstance,
} from '../../leafGeometry';
import type { TreePhenologyState } from '../../phenology';

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

function validateCanopyDepth(leaves: TreeLeafGeometryState, canopy: TreeCanopyDepthState): void {
  if (canopy.artifactSeed !== leaves.artifactSeed
    || canopy.lod !== leaves.lod
    || canopy.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopy.sourceLeafGeometryRulesVersion !== leaves.rulesVersion) {
    throw new Error('Three Tree Leaf Geometry received Canopy Depth from another leaf state.');
  }
  if (canopy.profiles.length !== leaves.instances.length) {
    throw new Error('Three Tree Leaf Geometry Canopy Depth profile count does not match leaves.');
  }
}

function validateCanopyLight(
  leaves: TreeLeafGeometryState,
  canopy: TreeCanopyDepthState | undefined,
  light: TreeCanopyLightState,
): void {
  if (!canopy) throw new Error('Three Tree Leaf Geometry requires Canopy Depth before Canopy Light.');
  if (light.artifactSeed !== leaves.artifactSeed
    || light.lod !== leaves.lod
    || light.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || light.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || light.sourceCanopyDepthSignature !== canopy.signature
    || light.profiles.length !== leaves.instances.length) {
    throw new Error('Three Tree Leaf Geometry received incompatible Canopy Light.');
  }
}

function validatePhenology(
  leaves: TreeLeafGeometryState,
  light: TreeCanopyLightState | undefined,
  phenology: TreePhenologyState,
): void {
  if (!light) throw new Error('Three Tree Leaf Geometry requires Canopy Light before Phenology.');
  if (phenology.artifactSeed !== leaves.artifactSeed
    || phenology.lod !== leaves.lod
    || phenology.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || phenology.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || phenology.sourceCanopyLightSignature !== light.signature
    || phenology.profiles.length !== leaves.instances.length) {
    throw new Error('Three Tree Leaf Geometry received incompatible Phenology.');
  }
}

export function createThreeTreeLeafCardGeometry(state: TreeLeafGeometryState): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(state.template.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(state.template.uvs, 2));
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
  light?: TreeCanopyLightState,
  phenology?: TreePhenologyState,
): THREE.InstancedMesh {
  if (canopy) validateCanopyDepth(state, canopy);
  if (light) validateCanopyLight(state, canopy, light);
  if (phenology) validatePhenology(state, light, phenology);
  const geometry = createThreeTreeLeafCardGeometry(state);
  const mesh = new THREE.InstancedMesh(geometry, material, state.instances.length);
  mesh.name = 'TreeLeafInstances';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  for (const instance of state.instances) {
    const canopyProfile = canopy?.profiles[instance.sequence];
    const lightProfile = light?.profiles[instance.sequence];
    const phenologyProfile = phenology?.profiles[instance.sequence];
    mesh.setMatrixAt(instance.sequence, matrixForInstance(instance, canopyProfile));
    const tint = phenologyProfile?.combinedTintMultiplier
      ?? lightProfile?.combinedTintMultiplier
      ?? canopyProfile?.tintMultiplier;
    if (tint) mesh.setColorAt(instance.sequence, new THREE.Color(tint.r, tint.g, tint.b));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData['treeLeafGeometry'] = {
    lod: state.lod,
    instances: state.instances.length,
    renderedTriangles: state.diagnostics.renderedTriangleCount,
    estimatedDrawCalls: state.diagnostics.estimatedDrawCalls,
    canopyDepthApplied: canopy !== undefined,
    canopyLightApplied: light !== undefined,
    phenologyApplied: phenology !== undefined,
  };
  if (phenology) {
    mesh.userData['treePhenology'] = {
      version: phenology.treePhenologyVersion,
      rulesVersion: phenology.rulesVersion,
      id: phenology.descriptor.id,
      phase: phenology.phase,
      signature: phenology.signature,
      profiles: phenology.profiles.length,
      accents: phenology.diagnostics.accentLeafCount,
      additionalDrawCalls: phenology.diagnostics.estimatedAdditionalDrawCalls,
      additionalMaterials: phenology.diagnostics.estimatedAdditionalMaterials,
    };
  }
  return mesh;
}
