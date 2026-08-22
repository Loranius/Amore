import * as THREE from 'three';
import type { TreeBarkSurfaceState } from '../../barkSurface';
import type { OrganicSweepMesh } from '../../labs/organic';

function applyBranchBarkSurface(
  geometry: THREE.BufferGeometry,
  mesh: OrganicSweepMesh,
  bark: TreeBarkSurfaceState,
): void {
  if (bark.lod !== mesh.lod
    || bark.sourceSweepMeshVersion !== mesh.organicSweepMeshVersion
    || bark.sourceSweepRulesVersion !== mesh.sourceRulesVersion) {
    throw new Error('Three Organic Sweep received Bark Surface from another branch mesh.');
  }
  if (bark.branchVertexColors.length !== mesh.diagnostics.vertexCount * 3
    || bark.branchRoughnessCharacters.length !== mesh.diagnostics.vertexCount) {
    throw new Error('Three Organic Sweep Bark Surface attributes do not match branch geometry.');
  }
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(bark.branchVertexColors, 3),
  );
  geometry.setAttribute(
    'barkCharacter',
    new THREE.Float32BufferAttribute(bark.branchRoughnessCharacters, 1),
  );
  geometry.setAttribute(
    'barkMask',
    new THREE.Float32BufferAttribute(
      new Float32Array(mesh.diagnostics.vertexCount).fill(1),
      1,
    ),
  );
  geometry.userData['treeBarkSurface'] = {
    version: bark.treeBarkSurfaceVersion,
    rulesVersion: bark.rulesVersion,
    id: bark.descriptor.id,
    tintAttributeId: bark.descriptor.tintAttributeId,
    roughnessAttributeId: bark.descriptor.roughnessAttributeId,
    signature: bark.signature,
    uniqueTints: bark.diagnostics.uniqueTintCount,
    minimumRoughnessCharacter: bark.diagnostics.minimumRoughnessCharacter,
    maximumRoughnessCharacter: bark.diagnostics.maximumRoughnessCharacter,
    barkMaskAttributeId: 'tree:bark:surface-mask',
    maskedBarkVertices: mesh.diagnostics.vertexCount,
  };
}

/** Thin Three.js adapter. Organic growth and meshing stay renderer-independent. */
export function createThreeOrganicSweepGeometry(
  mesh: OrganicSweepMesh,
  bark?: TreeBarkSurfaceState,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
  geometry.setIndex(mesh.indices);
  if (bark) applyBranchBarkSurface(geometry, mesh, bark);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData['treeLab'] = {
    lod: mesh.lod,
    rulesVersion: mesh.sourceRulesVersion,
    branches: mesh.diagnostics.branchCount,
    junctions: mesh.diagnostics.junctionCount,
    vertices: mesh.diagnostics.vertexCount,
    triangles: mesh.diagnostics.triangleCount,
    barkSurfaceApplied: bark !== undefined,
  };
  return geometry;
}
