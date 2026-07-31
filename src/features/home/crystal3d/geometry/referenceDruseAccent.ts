// ============================================================
// referenceDruseAccent — гарантована коротка видима фракція юбки.
// ------------------------------------------------------------
// Структурний контракт вимірює 10-й перцентиль, а не абсолютний мінімум:
// у sparse-друзі одного короткого шпиля недостатньо. Тому два найменші
// non-hero dominants стабільно стають 13%-ми передніми шпилями на різних
// секторах зовнішнього краю монарха. Growth State і ключі не змінюються.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const unitFromKey = (key: string): number =>
  (hashSeedString(`reference-accent:${key}`) >>> 0) / 0x1_0000_0000;
const heightScale = (maturity: number): number => 0.32 + maturity * 0.68;
const radiusScale = (maturity: number): number => 0.4 + maturity * 0.6;

function quaternionFor(direction: THREE.Vector3, key: string): THREE.Quaternion {
  const aligned = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  const spin = new THREE.Quaternion().setFromAxisAngle(UP, unitFromKey(key) * TAU);
  return aligned.multiply(spin).normalize();
}

function chooseHero(branches: readonly ClusterBranch[]): string | null {
  return (
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.emissive === true)?.key ??
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.tier === 'support')?.key ??
    null
  );
}

function placeAccent(
  branch: ClusterBranch,
  monarch: ClusterBranch,
  accentIndex: number,
): ClusterBranch {
  const height = monarch.height * 0.13;
  const accentRadius = Math.min(
    Math.max(height / 4.6, monarch.radiusBottom * 0.055),
    monarch.radiusBottom * 0.28,
  );
  const monarchPosition = new THREE.Vector3(monarch.posX, monarch.posY, monarch.posZ);
  const monarchQuaternion = new THREE.Quaternion(
    monarch.quatX,
    monarch.quatY,
    monarch.quatZ,
    monarch.quatW,
  ).normalize();
  const monarchAxis = UP.clone().applyQuaternion(monarchQuaternion).normalize();
  const monarchHeight = monarch.height * heightScale(monarch.maturity);
  const monarchRadius = monarch.radiusBottom * radiusScale(monarch.maturity);

  const reference = Math.abs(monarchAxis.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  const u = reference.addScaledVector(monarchAxis, -reference.dot(monarchAxis)).normalize();
  const w = new THREE.Vector3().crossVectors(u, monarchAxis).normalize();
  // Keyed angle preserves old slots; a half-turn offset guarantees that the
  // two short accents do not collapse into the same screen-space cluster.
  const angle = unitFromKey(branch.key) * TAU + accentIndex * Math.PI;
  const radial = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize();
  const tangent = new THREE.Vector3().crossVectors(radial, monarchAxis).normalize();

  const position = monarchPosition
    .addScaledVector(monarchAxis, monarchHeight * (0.018 + accentIndex * 0.008))
    .addScaledVector(radial, monarchRadius + accentRadius * 0.08)
    .addScaledVector(tangent, monarchRadius * (accentIndex === 0 ? 0.05 : -0.05));
  const direction = monarchAxis
    .clone()
    .multiplyScalar(0.84)
    .addScaledVector(UP, 0.18)
    .addScaledVector(radial, 0.56)
    .addScaledVector(tangent, accentIndex === 0 ? 0.06 : -0.06)
    .normalize();
  const quaternion = quaternionFor(direction, branch.key);

  return {
    ...branch,
    hostKey: monarch.key,
    height,
    radiusBottom: accentRadius,
    posX: position.x,
    posY: position.y,
    posZ: position.z,
    quatX: quaternion.x,
    quatY: quaternion.y,
    quatZ: quaternion.z,
    quatW: quaternion.w,
    archetype: 'prismatic',
  };
}

export function ensureVisibleReferenceAccent(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));

  const heroKey = chooseHero(branches);
  const accents = branches
    .filter((branch) => (
      !branch.primary
      && branch.role === 'dominant'
      && branch.archetype !== 'matrix'
      && branch.key !== heroKey
    ))
    .sort((left, right) => {
      const lv = left.height * left.radiusBottom * left.radiusBottom;
      const rv = right.height * right.radiusBottom * right.radiusBottom;
      return lv - rv || left.key.localeCompare(right.key);
    })
    .slice(0, 2);
  if (accents.length === 0) return branches.map((branch) => ({ ...branch }));

  const accentIndex = new Map(accents.map((branch, index) => [branch.key, index] as const));
  return branches.map((branch) => {
    const index = accentIndex.get(branch.key);
    return index === undefined ? { ...branch } : placeAccent(branch, monarch, index);
  });
}
