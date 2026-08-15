import * as THREE from 'three';
import type { ReefSurfaceSlotCandidate } from './reefSurfaceSlots';
import { assessReefCoralSupportHit } from './reefCoralSurfaceRules';

const DOWN = new THREE.Vector3(0, -1, 0);
const ORIGIN = new THREE.Vector3();
const WORLD_NORMAL = new THREE.Vector3();
const RAYCASTER = new THREE.Raycaster();
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

/**
 * Collects the normal generated habitat plus explicitly authored replacement
 * support surfaces. The submarine volcano lives beside the legacy production
 * root during the renderer migration, so it opts in with reefSupportSurface.
 * Hidden/replaced legacy geology is excluded to prevent floating corals.
 */
export function collectReefSupportMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  const root = scene.getObjectByName('reef-hero-support');
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (hasIgnoredSupportAncestor(object)) return;
    if (object.geometry.userData.reefIgnoreSupport === true) return;

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

/**
 * Generic colony anchors belong on terrain. Arch bodies are intentionally
 * excluded because a downward ray can otherwise accept a sloping arch facet
 * and make a vertical coral intersect the limestone.
 */
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

/** Collects authored horizontal shelves so the allocator does not have to hit them by chance. */
export function collectReefSupportSlotCandidates(
  supportMeshes: readonly THREE.Mesh[],
): ReefSurfaceSlotCandidate[] {
  const candidates: ReefSurfaceSlotCandidate[] = [];

  for (const mesh of supportMeshes) {
    const serialized = mesh.geometry.userData.reefCoralAttachmentSlots;
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

/**
 * Finds a near-horizontal terrain anchor only when a broad clearance column
 * around the coral is free of limestone. Sampling both cardinal and diagonal
 * offsets rejects roots that would technically sit on terrain while the coral
 * body still grows through an adjacent arch edge.
 *
 * Ecological surface rules are applied before the clearance test. In
 * particular, the upper quarter and crater of the submarine volcano are a
 * permanent no-grow zone, so slot allocation will choose another habitat
 * instead of planting coral on the active summit.
 */
export function raycastReefCoralTerrainSupport(
  terrainMeshes: readonly THREE.Mesh[],
  archMeshes: readonly THREE.Mesh[],
  x: number,
  z: number,
  minNormalY = 0.74,
): THREE.Intersection | null {
  const terrainHit = raycastReefSupport(terrainMeshes, x, z, minNormalY);
  if (!terrainHit) return null;
  if (!assessReefCoralSupportHit(terrainHit).allowed) return null;

  for (const [offsetX, offsetZ] of CORAL_ARCH_CLEARANCE_OFFSETS) {
    const blocker = raycastReefSupport(archMeshes, x + offsetX, z + offsetZ, -1);
    if (blocker && blocker.point.y > terrainHit.point.y + 0.015) return null;
  }

  return terrainHit;
}
