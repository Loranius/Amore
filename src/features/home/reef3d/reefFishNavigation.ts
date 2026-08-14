import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  createReefTerracedFoundationProfile,
  sampleReefTerracedFoundation,
} from './reefTerracedFoundation';
import { REEF_FISH_ROUTE_IDS } from './reefFishSchoolMotion';

type ReefFishRouteId = (typeof REEF_FISH_ROUTE_IDS)[number];

export interface ReefFishTunnelPassage {
  routeId: ReefFishRouteId;
  entry: THREE.Vector3;
  center: THREE.Vector3;
  exit: THREE.Vector3;
  phaseStart: number;
  phaseEnd: number;
}

export interface ReefFishObstacle {
  box: THREE.Box3;
  label: string;
}

const TUNNEL_ROUTES: readonly ReefFishRouteId[] = [
  'Clown2',
  'blue_tang1',
  'Yellow2',
];
// These windows intentionally include the authored starting phases for the
// selected routes (roughly .36, .18 and .84), so all three tunnel behaviours
// become visible during the first playback cycle after the reef mounts.
const TUNNEL_PHASES = [
  [0.28, 0.5],
  [0.1, 0.32],
  [0.73, 0.95],
] as const;
const FISH_STRUCTURE_MARGIN = 0.26;
const FISH_FOUNDATION_MARGIN = 0.52;
const FISH_FOUNDATION_TOP_CLEARANCE = 0.48;

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Creates three deterministic passages perpendicular to real arch planes.
 * Each selected fish reaches the exact centre of an opening at mid-pass, while
 * entry/exit points remain in open water on opposite sides of the arch.
 */
export function buildReefFishTunnelPassages(
  build: ReefPreviewBuild,
): ReefFishTunnelPassage[] {
  if (build.structures.arches.length === 0) return [];

  const profile = createReefTerracedFoundationProfile({
    radius: build.structures.visibleFoundationRadius,
    verticalScale: build.structures.foundationScaleY,
    seed: build.species.moduleEvolution.identitySeed,
  });

  return TUNNEL_ROUTES.map((routeId, index) => {
    const arch = build.structures.arches[index % build.structures.arches.length]!;
    const ground = sampleReefTerracedFoundation(profile, arch.center.x, arch.center.z).height;
    const forward = new THREE.Vector3(Math.sin(arch.rotationY), 0, Math.cos(arch.rotationY));
    const lateral = new THREE.Vector3(Math.cos(arch.rotationY), 0, -Math.sin(arch.rotationY));
    const lateralOffset = (index - 1) * Math.min(0.08, arch.span * 0.045);
    const center = new THREE.Vector3(
      arch.center.x,
      ground + Math.max(0.42, arch.height * 0.46),
      arch.center.z,
    ).addScaledVector(lateral, lateralOffset);
    const halfLength = Math.max(0.95, arch.thickness * 4.5 + 0.45);
    const [phaseStart, phaseEnd] = TUNNEL_PHASES[index]!;

    return {
      routeId,
      entry: center.clone().addScaledVector(forward, -halfLength),
      center,
      exit: center.clone().addScaledVector(forward, halfLength),
      phaseStart,
      phaseEnd,
    };
  });
}

/**
 * Returns a smooth world-space tunnel target. Weight is zero at the edges of
 * the phase window and one at its middle, so authored swimming blends in/out
 * without snapping while the fish is guaranteed to cross the opening centre.
 */
export function sampleReefFishTunnelPassage(
  passage: ReefFishTunnelPassage,
  normalizedPhase: number,
): { target: THREE.Vector3; weight: number } | null {
  const span = passage.phaseEnd - passage.phaseStart;
  if (span <= 0) return null;
  const local = (normalizedPhase - passage.phaseStart) / span;
  if (local < 0 || local > 1) return null;

  const progress = smoothstep(local);
  const target = local <= 0.5
    ? passage.entry.clone().lerp(passage.center, smoothstep(local * 2))
    : passage.center.clone().lerp(passage.exit, smoothstep((local - 0.5) * 2));
  const weight = Math.sin(Math.PI * progress) ** 2;
  return { target, weight };
}

/**
 * Pre-emptively keeps authored fish routes out of the solid central reef body.
 * This is deliberately a continuous radial field rather than a collision hit:
 * routes begin bending around the reef before a rig penetrates geometry.
 *
 * Real arch tunnel guidance can blend this delta down to zero while a fish is
 * crossing a known opening. Fish above the reef crown are also left untouched.
 */
export function reefFishFoundationAvoidanceDelta(
  point: THREE.Vector3,
  build: ReefPreviewBuild,
  margin = FISH_FOUNDATION_MARGIN,
): THREE.Vector3 {
  const reefTop = build.species.structure.reefHeight + FISH_FOUNDATION_TOP_CLEARANCE;
  if (point.y > reefTop) return new THREE.Vector3();

  const safeRadius = build.structures.visibleFoundationRadius + margin;
  const horizontalRadius = Math.hypot(point.x, point.z);
  if (horizontalRadius >= safeRadius) return new THREE.Vector3();

  const directionX = horizontalRadius > 1e-6 ? point.x / horizontalRadius : 1;
  const directionZ = horizontalRadius > 1e-6 ? point.z / horizontalRadius : 0;
  const distance = safeRadius - horizontalRadius;

  return new THREE.Vector3(
    directionX * distance,
    0,
    directionZ * distance,
  );
}

function usableObstacle(object: THREE.Mesh): boolean {
  if (!object.visible) return false;
  if (object.geometry.type === 'CircleGeometry') return false;
  if (object.userData.reefContactPatchCount !== undefined) return false;
  if (object.userData.reefSupportSurfaceKind === 'arch') return false;
  return true;
}

/**
 * Captures visible static structure boxes after world-composition transforms.
 * Natural arches are instanced, so every limestone mass receives its own box;
 * using one box for the whole arch would incorrectly block the opening itself.
 */
export function collectReefFishObstacles(scene: THREE.Scene): ReefFishObstacle[] {
  scene.updateMatrixWorld(true);
  const obstacles: ReefFishObstacle[] = [];
  const environment = scene.getObjectByName('reef-environment-light-terraces');

  environment?.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    if (!usableObstacle(object)) return;
    const box = new THREE.Box3().setFromObject(object, true);
    if (box.isEmpty()) return;
    obstacles.push({ box, label: object.name || object.geometry.type });
  });

  const naturalArches = scene.getObjectByName('reef-natural-year-arches');
  if (naturalArches instanceof THREE.InstancedMesh) {
    naturalArches.geometry.computeBoundingBox();
    const geometryBox = naturalArches.geometry.boundingBox;
    if (geometryBox) {
      const instanceMatrix = new THREE.Matrix4();
      const worldMatrix = new THREE.Matrix4();
      for (let index = 0; index < naturalArches.count; index += 1) {
        naturalArches.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(naturalArches.matrixWorld, instanceMatrix);
        obstacles.push({
          box: geometryBox.clone().applyMatrix4(worldMatrix),
          label: `natural-arch-rock:${index}`,
        });
      }
    }
  }

  return obstacles;
}

/**
 * Finds the smallest safe correction when a fish centre enters a structure's
 * safety volume. This is now a final local fallback; the central reef itself is
 * avoided earlier by reefFishFoundationAvoidanceDelta so the correction should
 * not oscillate against authored animation on every frame.
 */
export function reefFishCollisionDelta(
  point: THREE.Vector3,
  obstacles: readonly ReefFishObstacle[],
  margin = FISH_STRUCTURE_MARGIN,
): THREE.Vector3 {
  const corrected = point.clone();
  const delta = new THREE.Vector3();

  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    for (const obstacle of obstacles) {
      const box = obstacle.box.clone().expandByScalar(margin);
      if (!box.containsPoint(corrected)) continue;

      const candidates = [
        { distance: corrected.x - box.min.x, axis: 'x' as const, value: box.min.x - 0.01 },
        { distance: box.max.x - corrected.x, axis: 'x' as const, value: box.max.x + 0.01 },
        { distance: corrected.z - box.min.z, axis: 'z' as const, value: box.min.z - 0.01 },
        { distance: box.max.z - corrected.z, axis: 'z' as const, value: box.max.z + 0.01 },
        { distance: box.max.y - corrected.y, axis: 'y' as const, value: box.max.y + 0.01 },
      ].sort((left, right) => left.distance - right.distance);

      const escape = candidates[0]!;
      corrected[escape.axis] = escape.value;
      moved = true;
    }
    if (!moved) break;
  }

  delta.copy(corrected).sub(point);
  return delta;
}
