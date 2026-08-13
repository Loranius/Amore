import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);
const ORIGIN = new THREE.Vector3();
const WORLD_NORMAL = new THREE.Vector3();
const RAYCASTER = new THREE.Raycaster();

export function collectReefSupportMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  const root = scene.getObjectByName('reef-hero-support');
  if (!root) return [];

  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

export function raycastReefSupport(
  supportMeshes: readonly THREE.Mesh[],
  x: number,
  z: number,
  minNormalY = 0.24,
): THREE.Intersection | null {
  if (supportMeshes.length === 0) return null;

  ORIGIN.set(x, 4.5, z);
  RAYCASTER.set(ORIGIN, DOWN);
  RAYCASTER.near = 0;
  RAYCASTER.far = 6.5;

  // Three.js types currently require a mutable Object3D array even though the
  // raycaster only reads it. Keep our public placement API readonly and bridge
  // the type boundary with a shallow copy at the raycast edge.
  const hits = RAYCASTER.intersectObjects(Array.from(supportMeshes), false);
  for (const hit of hits) {
    if (!hit.face) continue;
    WORLD_NORMAL.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (WORLD_NORMAL.y < minNormalY) continue;
    return hit;
  }

  return null;
}
