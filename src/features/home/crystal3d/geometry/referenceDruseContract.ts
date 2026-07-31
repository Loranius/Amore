// ============================================================
// referenceDruseContract — останній renderer-only санітарний контракт.
// ------------------------------------------------------------
// Layout формує силует. Цей вузький pass лише фіксує дві інваріанти:
//   • hero-spire помітний, але монарх лишається щонайменше удвічі вищим;
//   • micro — внутрішні зародки біля осі свого господаря, а видиму юбку
//     утворюють середні satellites/dominants, не хаотичний «пил».
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

export function enforceReferenceDruseContract(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  if (!branches.some((branch) => branch.archetype === 'matrix')) {
    return branches.map((branch) => ({ ...branch }));
  }
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));

  const heroKey = chooseHero(branches)?.key ?? null;
  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));

  return branches.map((branch) => {
    if (branch.key === heroKey) {
      const height = clamp(branch.height, monarch.height * 0.46, monarch.height * 0.5);
      return {
        ...branch,
        height,
        radiusBottom: Math.min(
          Math.max(branch.radiusBottom, height / 5.8),
          monarch.radiusBottom * 0.58,
        ),
      };
    }

    if (branch.role !== 'micro' || branch.hostKey === null) return { ...branch };
    const host = byKey.get(branch.hostKey);
    if (host === undefined) return { ...branch };

    const hostAxis = axisOf(host);
    const hostPosition = positionOf(host);
    const hostHeight = host.height * heightScale(host.maturity);
    const hostRadius = host.radiusBottom * radiusScale(host.maturity);
    const angle = unitFromKey(branch.key, 'reference-contract-micro-angle') * TAU;

    const reference = Math.abs(hostAxis.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 0, 1);
    const u = reference.addScaledVector(hostAxis, -reference.dot(hostAxis)).normalize();
    const w = new THREE.Vector3().crossVectors(u, hostAxis).normalize();
    const radial = u.multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize();

    // Майже на осі й низько: оболонка господаря повністю приховує micro,
    // але attachment-граф і стабільний ключ лишаються незмінними.
    const position = hostPosition
      .addScaledVector(hostAxis, hostHeight * 0.025)
      .addScaledVector(radial, hostRadius * 0.08);
    const direction = hostAxis
      .clone()
      .multiplyScalar(0.9)
      .addScaledVector(radial, 0.16)
      .normalize();
    const height = Math.min(
      branch.height,
      monarch.height * 0.1,
      host.height * 0.34,
    );
    const adjusted = withDirection(branch, direction);
    return {
      ...adjusted,
      height,
      radiusBottom: Math.min(branch.radiusBottom, host.radiusBottom * 0.22),
      posX: position.x,
      posY: position.y,
      posZ: position.z,
      archetype: branch.archetype === 'etched' ? 'etched' : 'spear',
    };
  });
}
