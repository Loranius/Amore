import * as THREE from 'three';
import type { OrganicSweepMesh } from '../../labs/organic';

/** Thin Three.js adapter. Organic growth and meshing stay renderer-independent. */
export function createThreeOrganicSweepGeometry(mesh: OrganicSweepMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
  geometry.setIndex(mesh.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData['treeLab'] = {
    lod: mesh.lod,
    rulesVersion: mesh.sourceRulesVersion,
    branches: mesh.diagnostics.branchCount,
    junctions: mesh.diagnostics.junctionCount,
    vertices: mesh.diagnostics.vertexCount,
    triangles: mesh.diagnostics.triangleCount,
  };
  return geometry;
}
