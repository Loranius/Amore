// ============================================================
// referenceDruseContract — останній renderer-only санітарний контракт.
// ------------------------------------------------------------
// Layout формує силует. Цей pass фіксує три інваріанти:
//   • hero-spire помітний, але монарх лишається >2× вищим;
//   • micro та два найменші synthetic satellites стають внутрішніми
//     включеннями, а не хаотичним пилом на поверхні;
//   • родина hero має невеликий тангенційний рознос без z-fighting.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

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

function withDirection(branch: ClusterBranch, direction: THREE.Vector3): ClusterBranch {
  const aligned = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  const spin = new THREE.Quaternion().setFromAxisAngle(
    UP,
    unitFromKey(branch.key, 'reference-contract-spin') * TAU,
  );
  const quaternion = aligned.multiply(spin).normalize();
  return {
    ...branch,
    quatX: quaternion.x,
    quatY: quaternion.y,
    quatZ: quaternion.z,
    quatW: quaternion.w,
  };
}

function chooseHero(branches: readonly ClusterBranch[]): ClusterBranch | null {
  return (
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.emissive === true) ??
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.tier === 'support') ??
    null
  );
}

function radialBasis(axis: THREE.Vector3, key: string): { radial: THREE.Vector3; tangent: THREE.Vector3 } {
  const angle = unitFromKey(key, 'reference-contract-angle') * TAU;
  const reference = Math.abs(axis.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  const u = reference.addScaledVector(axis, -reference.dot(axis)).normalize();
  const w = new THREE.Vector3().crossVectors(u, axis).normalize();
  return {
    radial: u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize(),
    tangent: u.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(w, Math.cos(angle)).normalize(),
  };
}

function hiddenInclusion(
  branch: ClusterBranch,
  host: ClusterBranch,
  monarch: ClusterBranch,
  satellite: boolean,
): ClusterBranch {
  const hostAxis = axisOf(host);
  const hostPosition = positionOf(host);
  const hostHeight = host.height * heightScale(host.maturity);
  const hostRadius = host.radiusBottom * radiusScale(host.maturity);
  const { radial } = radialBasis(hostAxis, branch.key);
  const position = hostPosition
    .addScaledVector(hostAxis, hostHeight * 0.025)
    .addScaledVector(radial, hostRadius * 0.045);
  const direction = hostAxis
    .clone()
    .multiplyScalar(0.96)
    .addScaledVector(radial, 0.08)
    .normalize();
  const height = Math.min(
    branch.height,
    monarch.height * (satellite ? 0.105 : 0.075),
    host.height * (satellite ? 0.24 : 0.22),
  );
  const adjusted = withDirection(branch, direction);
  return {
    ...adjusted,
    height,
    radiusBottom: Math.min(
      branch.radiusBottom,
      host.radiusBottom * (satellite ? 0.15 : 0.13),
    ),
    posX: position.x,
    posY: position.y,
    posZ: position.z,
    archetype: branch.archetype === 'etched' ? 'etched' : 'spear',
  };
}

function separateHeroChild(branch: ClusterBranch, host: ClusterBranch): ClusterBranch {
  const hostAxis = axisOf(host);
  const hostRadius = host.radiusBottom * radiusScale(host.maturity);
  const { tangent } = radialBasis(hostAxis, branch.key);
  const position = positionOf(branch).addScaledVector(tangent, hostRadius * 0.24);
  const direction = axisOf(branch).addScaledVector(tangent, 0.2).normalize();
  const adjusted = withDirection(branch, direction);
  return {
    ...adjusted,
    posX: position.x,
    posY: position.y,
    posZ: position.z,
  };
}

export function enforceReferenceDruseContract(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  if (!branches.some((branch) => branch.archetype === 'matrix')) {
    return branches.map((branch) => ({ ...branch }));
  }
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));

  const hero = chooseHero(branches);
  const heroKey = hero?.key ?? null;
  const heroHeight = hero === null
    ? null
    : clamp(hero.height, monarch.height * 0.46, monarch.height * 0.495);
  const adjustedHero = hero === null || heroHeight === null
    ? null
    : {
        ...hero,
        height: heroHeight,
        radiusBottom: Math.min(
          Math.max(hero.radiusBottom, heroHeight / 5.8),
          monarch.radiusBottom * 0.58,
        ),
      };

  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  if (adjustedHero !== null) byKey.set(adjustedHero.key, adjustedHero);

  const satellites = branches
    .filter((branch) => branch.role === 'satellite' && branch.hostKey !== null)
    .sort((left, right) => {
      const lv = left.height * left.radiusBottom * left.radiusBottom;
      const rv = right.height * right.radiusBottom * right.radiusBottom;
      return lv - rv || left.key.localeCompare(right.key);
    });
  const innerSatelliteKeys = new Set(satellites.slice(0, 2).map((branch) => branch.key));

  return branches.map((branch) => {
    if (branch.key === heroKey && adjustedHero !== null) return adjustedHero;
    if (branch.hostKey === null) return { ...branch };
    const host = byKey.get(branch.hostKey);
    if (host === undefined) return { ...branch };

    if (branch.role === 'micro' || innerSatelliteKeys.has(branch.key)) {
      return hiddenInclusion(branch, host, monarch, branch.role === 'satellite');
    }
    if (branch.role === 'satellite' && branch.hostKey === heroKey) {
      return separateHeroChild(branch, host);
    }
    return { ...branch };
  });
}
