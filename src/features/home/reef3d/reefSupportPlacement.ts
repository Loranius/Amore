import * as THREE from 'three';
import type { ReefSurfaceSlotCandidate } from './reefSurfaceSlots';
import { assessReefCoralSupportHit } from './reefCoralSurfaceRules';

const DOWN = new THREE.Vector3(0, -1, 0);
const ORIGIN = new THREE.Vector3();
const WORLD_NORMAL = new THREE.Vector3();
const RAYCASTER = new THREE.Raycaster();
const RAYCAST_HITS: THREE.Intersection[] = [];
const SLOT_WORLD_POINT = new THREE.Vector3();
const CORAL_ARCH_CLEARANCE_OFFSETS = [
  [0, 0],
  [0.16, 0],
  [-0.16, 0],
  [0, 0.16],
  [0, -0.16],
  [0.2, 0.2],
  [-0.2, 0.2],
  [0.2, -0.2],
  [-0.2, -0.2],
  [0.3, 0],
  [-0.3, 0],
  [0, 0.3],
  [0, -0.3],
] as const;

interface SerializedReefSupportSlot {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  availableFromEpoch?: number;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSerializedSupportSlot(value: unknown): value is SerializedReefSupportSlot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SerializedReefSupportSlot>;
  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && Boolean(candidate.position)
    && finite(candidate.position?.x)
    && finite(candidate.position?.y)
    && finite(candidate.position?.z)
    && finite(candidate.radius)
    && candidate.radius > 0
    && (candidate.availableFromEpoch === undefined || finite(candidate.availableFromEpoch));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function hasIgnoredSupportAncestor(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.reefIgnoreSupport === true || current.visible === false) return true;
    current = current.parent;
  }
  return false;
}

export function collectReefSupportMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  const root = scene.getObjectByName('reef-hero-support');
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (hasIgnoredSupportAncestor(object) || object.geometry.userData.reefIgnoreSupport === true) return;

    let insideHeroRoot = false;
    if (root) {
      let parent: THREE.Object3D | null = object;
      while (parent) {
        if (parent === root) {
          insideHeroRoot = true;
          break;
        }
        parent = parent.parent;
      }
    }

    const explicitSupport = object.userData.reefSupportSurface === true
      || object.geometry.userData.reefSupportSurface === true;
    if (insideHeroRoot || explicitSupport) meshes.push(object);
  });

  return meshes;
}

function isReefArchSupport(mesh: THREE.Mesh): boolean {
  return mesh.geometry.userData.reefSupportSurfaceKind === 'arch'
    || mesh.userData.reefSupportSurfaceKind === 'arch'
    || typeof mesh.geometry.userData.reefSourceArchId === 'string';
}

export function collectReefTerrainSupportMeshes(
  supportMeshes: readonly THREE.Mesh[],
): THREE.Mesh[] {
  return supportMeshes.filter((mesh) => !isReefArchSupport(mesh));
}

export function collectReefArchSupportMeshes(
  supportMeshes: readonly THREE.Mesh[],
): THREE.Mesh[] {
  return supportMeshes.filter(isReefArchSupport);
}

export function collectReefSupportSlotCandidates(
  supportMeshes: readonly THREE.Mesh[],
): ReefSurfaceSlotCandidate[] {
  const candidates: ReefSurfaceSlotCandidate[] = [];

  for (const mesh of supportMeshes) {
    const serialized = mesh.userData.reefCoralAttachmentSlots
      ?? mesh.geometry.userData.reefCoralAttachmentSlots;
    if (!Array.isArray(serialized)) continue;
    mesh.updateWorldMatrix(true, false);

    for (const value of serialized) {
      if (!isSerializedSupportSlot(value)) continue;
      SLOT_WORLD_POINT.set(value.position.x, value.position.y, value.position.z);
      mesh.localToWorld(SLOT_WORLD_POINT);
      candidates.push({
        id: value.id,
        x: round6(SLOT_WORLD_POINT.x),
        z: round6(SLOT_WORLD_POINT.z),
        position: {
          x: round6(SLOT_WORLD_POINT.x),
          y: round6(SLOT_WORLD_POINT.y),
          z: round6(SLOT_WORLD_POINT.z),
        },
        maxFootprintRadius: round6(value.radius * 0.72),
        ...(value.availableFromEpoch === undefined
          ? {}
          : { availableFromEpoch: value.availableFromEpoch }),
      });
    }
  }

  return candidates.sort((left, right) => left.id.localeCompare(right.id));
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
  RAYCAST_HITS.length = 0;
  RAYCASTER.intersectObjects(supportMeshes as THREE.Mesh[], false, RAYCAST_HITS);

  for (const hit of RAYCAST_HITS) {
    if (!hit.face) continue;
    WORLD_NORMAL.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (WORLD_NORMAL.y >= minNormalY) return hit;
  }

  return null;
}

export function raycastReefCoralTerrainSupport(
  terrainMeshes: readonly THREE.Mesh[],
  archMeshes: readonly THREE.Mesh[],
  x: number,
  z: number,
  minNormalY = 0.74,
): THREE.Intersection | null {
  const terrainHit = raycastReefSupport(terrainMeshes, x, z, minNormalY);
  if (!terrainHit || !assessReefCoralSupportHit(terrainHit).allowed) return null;
  if (archMeshes.length === 0) return terrainHit;

  for (const [offsetX, offsetZ] of CORAL_ARCH_CLEARANCE_OFFSETS) {
    const blocker = raycastReefSupport(archMeshes, x + offsetX, z + offsetZ, -1);
    if (blocker && blocker.point.y > terrainHit.point.y + 0.015) return null;
  }

  return terrainHit;
}
