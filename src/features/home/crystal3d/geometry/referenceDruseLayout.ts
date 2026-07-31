// ============================================================
// referenceDruseLayout — renderer-only анатомія референсної друзи.
// Growth State не змінюється: цей pass працює лише перед Geometry Engine.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
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

function radialFrame(axis: THREE.Vector3, angle: number): { radial: THREE.Vector3; tangent: THREE.Vector3 } {
  const ref = Math.abs(axis.x) < 0.88
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  const u = ref.addScaledVector(axis, -ref.dot(axis)).normalize();
  const w = new THREE.Vector3().crossVectors(u, axis).normalize();
  return {
    radial: u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize(),
    tangent: u.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(w, Math.cos(angle)).normalize(),
  };
}

function quaternionFor(direction: THREE.Vector3, key: string): THREE.Quaternion {
  const aligned = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  const spin = new THREE.Quaternion().setFromAxisAngle(
    UP,
    unitFromKey(key, 'reference-druse-spin') * TAU,
  );
  return aligned.multiply(spin).normalize();
}

function withPose(
  branch: ClusterBranch,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  hostKey: string | null,
): ClusterBranch {
  const quat = quaternionFor(direction, branch.key);
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
  const radiusBottom = Math.max(branch.radiusBottom, height / 4.7);
  const direction = axisOf(branch).multiplyScalar(0.12).addScaledVector(UP, 0.88).normalize();
  return {
    ...withPose(branch, positionOf(branch), direction, branch.hostKey),
    height,
    radiusBottom,
    tier: 'king',
    archetype: 'prismatic',
  };
}

function shapeMatrix(branch: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  return {
    ...branch,
    radiusBottom: Math.max(branch.radiusBottom, monarch.radiusBottom * 1.32),
    height: Math.max(branch.height, monarch.radiusBottom * 0.62),
  };
}

function shapeHero(branch: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  const height = clamp(branch.height, monarch.height * 0.64, monarch.height * 0.76);
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / 5.8),
      monarch.radiusBottom * 0.62,
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
    ? clamp(originalRatio, 0.28, 0.48)
    : clamp(originalRatio, 0.14, 0.34);
  const height = monarch.height * ratio;
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / (support ? 5.7 : 5.1)),
      monarch.radiusBottom * (support ? 0.5 : 0.4),
    ),
    archetype: safeArchetype(branch),
  };
}

function shapeLocal(branch: ClusterBranch, host: ClusterBranch, monarch: ClusterBranch): ClusterBranch {
  const micro = branch.role === 'micro';
  const height = Math.min(
    clamp(branch.height, monarch.height * (micro ? 0.04 : 0.075), monarch.height * (micro ? 0.12 : 0.21)),
    host.height * (micro ? 0.52 : 0.64),
  );
  return {
    ...branch,
    height,
    radiusBottom: Math.min(
      Math.max(branch.radiusBottom, height / (micro ? 4.0 : 4.8)),
      host.radiusBottom * (micro ? 0.48 : 0.64),
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
): ClusterBranch {
  const hostAxis = axisOf(host);
  const { radial, tangent } = radialFrame(hostAxis, angle);
  const hostHeight = renderedHeight(host);
  const hostRadius = renderedRadius(host);
  const radiusHere = hostRadius * (1 - clamp(hostT, 0, 1) * 0.62);
  const center = positionOf(host).addScaledVector(hostAxis, hostHeight * hostT);
  const contact = center.addScaledVector(radial, radiusHere);
  const ownRadius = renderedRadius(branch);
  const burial = Math.min(ownRadius * 1.8 + radiusHere * 0.25, radiusHere * 0.88);
  const position = contact.addScaledVector(radial, -burial);
  const direction = hostAxis
    .clone()
    .multiplyScalar(upWeight)
    .addScaledVector(UP, 0.24)
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

export function applyReferenceDruseLayout(branches: readonly ClusterBranch[]): ClusterBranch[] {
  const originalMonarch = branches.find((branch) => branch.primary);
  if (originalMonarch === undefined) return branches.map((branch) => ({ ...branch }));

  const monarch = shapeMonarch(originalMonarch);
  const heroKey = chooseHero(branches)?.key ?? null;
  const originalByKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  const output = new Map<string, ClusterBranch>([[monarch.key, monarch]]);
  const originalYaw = new THREE.Euler().setFromQuaternion(quaternionOf(originalMonarch), 'YXZ').y;
  const baseAngle = originalYaw + 0.35;

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
      result = shapeMatrix(source, monarch);
    } else if (source.primary) {
      result = monarch;
    } else if (source.role === 'dominant') {
      if (source.key === heroKey) {
        result = placeOnHost(
          shapeHero(source, monarch), monarch, baseAngle + Math.PI * 1.18,
          0.055, 1, 0.26, 0.03, monarch.key,
        );
      } else {
        const index = dominantIndex.get(source.key) ?? 0;
        const ring = index % 3;
        const around = Math.floor(index / 3);
        const shaped = shapeDominant(source, monarch, originalMonarch);
        const support = shaped.tier === 'support';
        result = placeOnHost(
          shaped,
          monarch,
          baseAngle + ring * 0.34 + around * GOLDEN_ANGLE,
          0.025 + ring * 0.034,
          support ? 0.82 : 0.62,
          support ? 0.62 : 0.92,
          (unitFromKey(source.key, 'reference-druse-tangent') - 0.5) * 0.16,
          monarch.key,
        );
      }
    } else {
      const sourceHost = source.hostKey === null ? undefined : originalByKey.get(source.hostKey);
      const host = sourceHost === undefined || sourceHost.archetype === 'matrix'
        ? monarch
        : layout(sourceHost.key);
      const index = siblingIndex.get(source.key) ?? 0;
      const ring = index % 3;
      const shaped = shapeLocal(source, host, monarch);
      const micro = shaped.role === 'micro';
      result = placeOnHost(
        shaped,
        host,
        baseAngle + unitFromKey(host.key, 'reference-druse-family') * TAU + index * GOLDEN_ANGLE,
        (micro ? 0.018 : 0.028) + ring * (micro ? 0.018 : 0.026),
        micro ? 0.48 : 0.58,
        micro ? 1.02 : 0.86,
        (unitFromKey(source.key, 'reference-druse-local-tangent') - 0.5) * 0.2,
        host.key,
      );
    }

    visiting.delete(key);
    output.set(key, result);
    return result;
  };

  return branches.map((branch) => layout(branch.key));
}
