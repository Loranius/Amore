// ============================================================
// referenceDruseAccent — гарантована коротка видима фракція юбки.
// ------------------------------------------------------------
// У sparse-історії після приховування micro може не лишитися жодного
// кристала нижче 20% висоти монарха. Один найменший не-hero dominant
// стабільно стає 17.5%-м переднім шпилем: його основа частково занурена,
// але більша частина перерізу гарантовано виходить за оболонку монарха.
// Growth State та стабільний ключ не змінюються.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const unitFromKey = (key: string): number =>
  (hashSeedString(`reference-accent:${key}`) >>> 0) / 0x1_0000_0000;
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

export function ensureVisibleReferenceAccent(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  if (!branches.some((branch) => branch.archetype === 'matrix')) {
    return branches.map((branch) => ({ ...branch }));
  }
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));
  const heroKey = chooseHero(branches);
  const accent = branches
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
    })[0];
  if (accent === undefined) return branches.map((branch) => ({ ...branch }));

  const height = monarch.height * 0.175;
  const accentRadius = Math.min(
    Math.max(accent.radiusBottom, height / 4.6),
    monarch.radiusBottom * 0.34,
  );
  const monarchPosition = new THREE.Vector3(monarch.posX, monarch.posY, monarch.posZ);
  const monarchQuaternion = new THREE.Quaternion(
    monarch.quatX,
    monarch.quatY,
    monarch.quatZ,
    monarch.quatW,
  ).normalize();
  const monarchAxis = UP.clone().applyQuaternion(monarchQuaternion).normalize();
  const reference = Math.abs(monarchAxis.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  const u = reference.addScaledVector(monarchAxis, -reference.dot(monarchAxis)).normalize();
  const w = new THREE.Vector3().crossVectors(u, monarchAxis).normalize();
  const angle = unitFromKey(accent.key) * TAU;
  const radial = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize();
  const tangent = new THREE.Vector3().crossVectors(radial, monarchAxis).normalize();
  const hostRadius = monarch.radiusBottom * radiusScale(monarch.maturity);

  // Центр основи стоїть лише на 48% власного радіуса всередині поверхні:
  // цього досить для мінерального контакту, але не досить, щоб trim повністю
  // поглинув короткий передній шпиль, як було при старих 70% hostRadius.
  const radialDistance = hostRadius - accentRadius * 0.48;
  const position = monarchPosition
    .addScaledVector(monarchAxis, monarch.height * 0.014)
    .addScaledVector(radial, radialDistance)
    .addScaledVector(tangent, hostRadius * 0.12);
  const direction = monarchAxis
    .clone()
    .multiplyScalar(0.42)
    .addScaledVector(UP, 0.14)
    .addScaledVector(radial, 1.02)
    .addScaledVector(tangent, 0.12)
    .normalize();
  const quaternion = quaternionFor(direction, accent.key);

  return branches.map((branch) => branch.key === accent.key
    ? {
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
      }
    : { ...branch });
}
