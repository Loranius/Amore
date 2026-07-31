// ============================================================
// referenceDruseLayout — renderer-only анатомія референсної друзи.
// Growth State не змінюється: цей pass працює лише перед Geometry Engine.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
/** Камера CrystalScene стоїть на +Z. Початковий кадр має читатися одразу,
 *  але повне кільце зберігає правильний силует і після OrbitControls/оберту. */
const CAMERA_FRONT = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HERO_ANGLE = -2.12; // позаду-ліворуч від монарха у стартовому кадрі
const FRONT_CROWN_SLOTS = [
  -1.12,
  1.12,
  -0.72,
  0.72,
  -0.36,
  0.36,
  0,
  -1.48,
  1.48,
] as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const unitFromKey = (key: string, channel: string): number =>
  (hashSeedString(`${channel}:${key}`) >>> 0) / 0x1_0000_0000;
const heightScale = (maturity: number): number => 0.32 + maturity * 0.68;
const radiusScale = (maturity: number): number => 0.4 + maturity * 0.6;

const positionOf = (branch: ClusterBranch): THREE.Vector3 =>
  new THREE.Vector3(branch.posX, branch.posY, branch.posZ);
const quaternionOf = (branch: ClusterBranch): THREE.Quaternion =>
  new THREE.Quaternion(branch.quatX, branch.quatY, branch.quatZ, branch.quatW).normalize();
const axisOf = (branch: ClusterBranch): THREE.Vector3 =>
  UP.clone().applyQuaternion(quaternionOf(branch)).normalize();
const renderedHeight = (branch: ClusterBranch): number => branch.height * heightScale(branch.maturity);
const renderedRadius = (branch: ClusterBranch): number => branch.radiusBottom * radiusScale(branch.maturity);

/**
 * angle=0 дивиться до камери (+Z), додатний кут іде вправо (+X).
 * На похиленому монарху front/right проєктуються на площину його основи.
 */
function presentationFrame(
  axis: THREE.Vector3,
  angle: number,
): { radial: THREE.Vector3; tangent: THREE.Vector3 } {
  let front = CAMERA_FRONT.clone().addScaledVector(axis, -CAMERA_FRONT.dot(axis));
  if (front.lengthSq() < 1e-6) {
    front = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y);
  }
  front.normalize();
  const right = new THREE.Vector3().crossVectors(axis, front).normalize();
  const radial = front
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(right, Math.sin(angle))
    .normalize();
  return {
    radial,
    tangent: new THREE.Vector3().crossVectors(radial, axis).normalize(),
  };
}

function radialFrame(axis: THREE.Vector3, angle: number): { radial: THREE.Vector3; tangent: THREE.Vector3 } {
  return presentationFrame(axis, angle);
}

function quaternionFor(
  direction: THREE.Vector3,
  key: string,
  spinOverride?: number,
): THREE.Quaternion {
  const aligned = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  const spin = new THREE.Quaternion().setFromAxisAngle(
    UP,
    spinOverride ?? unitFromKey(key, 'reference-druse-spin') * TAU,
  );
  return aligned.multiply(spin).normalize();
}

function withPose(
  branch: ClusterBranch,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  hostKey: string | null,
  spinOverride?: number,
): ClusterBranch {
  const quat = quaternionFor(direction, branch.key, spinOverride);
  return {
    ...branch,
    hostKey,
    posX: position.x,
    posY: position.y,
    posZ: position.z,
    quatX: quat.x,
    quatY: quat.y,
    quatZ: quat.z,
    quatW: quat.w,
  };
}

function safeArchetype(branch: ClusterBranch): ClusterBranch['archetype'] {
  if (branch.archetype === 'blade' || branch.archetype === 'tabular' || branch.archetype === 'matrix') {
    return branch.role === 'micro' ? 'spear' : 'prismatic';
  }
  return branch.archetype;
}

function shapeMonarch(branch: ClusterBranch): ClusterBranch {
  const height = Math.min(branch.height, 2.15);
  const radiusBottom = Math.max(branch.radiusBottom, height / 4.35);
  const direction = axisOf(branch).multiplyScalar(0.08).addScaledVector(UP, 0.92).normalize();
  return {
    ...withPose(branch, positionOf(branch), direction, branch.hostKey, 0),
    height,
    radiusBottom,
    tier: 'king',
    archetype: 'prismatic',
  };
}

function shapeMatrix(branch: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  return {
    ...branch,
    radiusBottom: Math.max(branch.radiusBottom, monarch.radiusBottom * 1.62),
    height: Math.max(branch.height, monarch.radiusBottom * 0.68),
  };
}

function shapeHero(branch: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  const height = clamp(branch.height, monarch.height * 0.68, monarch.height * 0.76);
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / 4.45),
      monarch.radiusBottom * 0.68,
    ),
    tier: 'support',
    archetype: 'prismatic',
  };
}

function shapeDominant(
  branch: ClusterBranch,
  monarch: ClusterBranch,
  originalMonarch: ClusterBranch,
): ClusterBranch {
  const originalRatio = originalMonarch.height > 0 ? branch.height / originalMonarch.height : 0;
  const support = branch.tier === 'support';
  const ratio = support
    ? clamp(originalRatio, 0.32, 0.46)
    : clamp(originalRatio, 0.22, 0.36);
  const height = monarch.height * ratio;
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / (support ? 4.8 : 4.5)),
      monarch.radiusBottom * (support ? 0.52 : 0.44),
    ),
    archetype: safeArchetype(branch),
  };
}

function shapeLocal(branch: ClusterBranch, host: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  const micro = branch.role === 'micro';
  const requested = clamp(
    branch.height,
    monarch.height * (micro ? 0.05 : 0.18),
    monarch.height * (micro ? 0.12 : 0.29),
  );
  const height = micro
    ? Math.min(requested, host.height * 0.46)
    : Math.min(requested, Math.max(host.height * 0.72, monarch.height * 0.18));
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / (micro ? 4.1 : 4.5)),
      host.radiusBottom * (micro ? 0.42 : 0.66),
    ),
    archetype: safeArchetype(branch),
  };
}

function placeOnHost(
  branch: ClusterBranch,
  host: ClusterBranch,
  angle: number,
  hostT: number,
  upWeight: number,
  outwardWeight: number,
  tangentWeight: number,
  hostKey: string,
  burialFactor = 0.78,
  radialGapFactor = 0,
): ClusterBranch {
  const hostAxis = axisOf(host);
  const { radial, tangent } = radialFrame(hostAxis, angle);
  const hostHeight = renderedHeight(host);
  const hostRadius = renderedRadius(host);
  const radiusHere = hostRadius * (1 - clamp(hostT, 0, 1) * 0.62);
  const center = positionOf(host).addScaledVector(hostAxis, hostHeight * hostT);
  const contact = center.addScaledVector(radial, radiusHere);
  const ownRadius = renderedRadius(branch);
  const burial = branch.role === 'micro'
    ? Math.min(ownRadius * 0.5 + radiusHere * 0.015, radiusHere * 0.32)
    : Math.min(ownRadius * burialFactor + radiusHere * 0.025, radiusHere * 0.58);
  const position = contact
    .addScaledVector(radial, ownRadius * radialGapFactor - burial);
  const direction = hostAxis
    .clone()
    .multiplyScalar(upWeight)
    .addScaledVector(UP, 0.28)
    .addScaledVector(radial, outwardWeight)
    .addScaledVector(tangent, tangentWeight)
    .normalize();
  return withPose(branch, position, direction, hostKey);
}

function chooseHero(branches: readonly ClusterBranch[]): ClusterBranch | null {
  return (
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.emissive === true) ??
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.tier === 'support') ??
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.archetype !== 'matrix') ??
    null
  );
}

function dominantSlot(index: number): number {
  if (index < FRONT_CROWN_SLOTS.length) return FRONT_CROWN_SLOTS[index]!;
  return FRONT_CROWN_SLOTS[index % FRONT_CROWN_SLOTS.length]!
    + (Math.floor(index / FRONT_CROWN_SLOTS.length) + 1) * GOLDEN_ANGLE;
}

export function applyReferenceDruseLayout(branches: readonly ClusterBranch[]): ClusterBranch[] {
  const matrixSource = branches.find((branch) => branch.archetype === 'matrix');
  if (matrixSource === undefined) {
    return branches.map((branch) => ({ ...branch }));
  }

  const originalMonarch = branches.find((branch) => branch.primary);
  if (originalMonarch === undefined) return branches.map((branch) => ({ ...branch }));

  const monarch = shapeMonarch(originalMonarch);
  const matrix = shapeMatrix(matrixSource, monarch);
  const heroKey = chooseHero(branches)?.key ?? null;
  const originalByKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  const output = new Map<string, ClusterBranch>([
    [matrix.key, matrix],
    [monarch.key, monarch],
  ]);

  const dominantIndex = new Map<string, number>();
  let nextDominant = 0;
  for (const branch of branches) {
    if (
      branch.primary || branch.key === heroKey || branch.role !== 'dominant' || branch.archetype === 'matrix'
    ) continue;
    dominantIndex.set(branch.key, nextDominant++);
  }

  const siblingIndex = new Map<string, number>();
  const siblingCount = new Map<string, number>();
  for (const branch of branches) {
    if (branch.role === 'dominant') continue;
    const hostKey = branch.hostKey ?? monarch.key;
    const index = siblingCount.get(hostKey) ?? 0;
    siblingIndex.set(branch.key, index);
    siblingCount.set(hostKey, index + 1);
  }

  const visiting = new Set<string>();
  const layout = (key: string): ClusterBranch => {
    const cached = output.get(key);
    if (cached !== undefined) return cached;
    const source = originalByKey.get(key);
    if (source === undefined || visiting.has(key)) return monarch;
    visiting.add(key);

    let result: ClusterBranch;
    if (source.archetype === 'matrix') {
      result = matrix;
    } else if (source.primary) {
      result = monarch;
    } else if (source.role === 'dominant') {
      if (source.key === heroKey) {
        result = placeOnHost(
          shapeHero(source, monarch),
          matrix,
          HERO_ANGLE,
          0.46,
          1.06,
          0.22,
          0,
          matrix.key,
          0.44,
          -0.08,
        );
      } else {
        const index = dominantIndex.get(source.key) ?? 0;
        const shaped = shapeDominant(source, monarch, originalMonarch);
        const support = shaped.tier === 'support';
        result = placeOnHost(
          shaped,
          matrix,
          dominantSlot(index),
          0.38 + (index % 3) * 0.045,
          support ? 0.86 : 0.7,
          support ? 0.56 : 0.76,
          (unitFromKey(source.key, 'reference-druse-tangent') - 0.5) * 0.12,
          matrix.key,
          0.62,
          0.05 + (index % 2) * 0.08,
        );
      }
    } else {
      const sourceHost = source.hostKey === null ? undefined : originalByKey.get(source.hostKey);
      const host = sourceHost === undefined || sourceHost.archetype === 'matrix'
        ? matrix
        : layout(sourceHost.key);
      const index = siblingIndex.get(source.key) ?? 0;
      const ring = index % 3;
      const shaped = shapeLocal(source, host, monarch);
      const micro = shaped.role === 'micro';
      const hostIsMatrix = host.archetype === 'matrix';
      result = placeOnHost(
        shaped,
        host,
        hostIsMatrix
          ? dominantSlot(index + nextDominant)
          : unitFromKey(host.key, 'reference-druse-family') * TAU + index * GOLDEN_ANGLE,
        hostIsMatrix
          ? 0.34 + ring * 0.04
          : (micro ? 0.008 : 0.018) + ring * (micro ? 0.012 : 0.018),
        micro ? 0.56 : 0.72,
        micro ? 0.92 : 0.7,
        (unitFromKey(source.key, 'reference-druse-local-tangent') - 0.5) * 0.14,
        host.key,
        micro ? 0.48 : 0.62,
        hostIsMatrix ? 0.12 : 0,
      );
    }

    visiting.delete(key);
    output.set(key, result);
    return result;
  };

  return branches.map((branch) => layout(branch.key));
}
