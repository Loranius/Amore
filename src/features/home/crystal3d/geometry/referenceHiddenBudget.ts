// ============================================================
// referenceHiddenBudget — renderer-only бюджет внутрішніх включень.
// ------------------------------------------------------------
// Reference accent навмисно робить частину листових тіл видимою юбкою.
// Щоб це не повертало зайві порожні draw calls, кілька інших найменших
// satellites (які НЕ входять до accent і не несуть дітей) переносяться
// всередину монарха лише в publication-layout. Growth State і стабільні
// ключі не змінюються.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';
import { selectReferenceAccentKeys } from './referenceDruseAccent';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const ADDITIONAL_HIDDEN_TARGET = 4;

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

function radialDirection(axis: THREE.Vector3, key: string): THREE.Vector3 {
  const angle = unitFromKey(key, 'reference-hidden-angle') * TAU;
  const reference = Math.abs(axis.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  const u = reference.addScaledVector(axis, -reference.dot(axis)).normalize();
  const w = new THREE.Vector3().crossVectors(u, axis).normalize();
  return u.multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)).normalize();
}

function radialDistanceFromHostAxis(branch: ClusterBranch, host: ClusterBranch): number {
  const axis = axisOf(host);
  const delta = positionOf(branch).sub(positionOf(host));
  const axial = delta.dot(axis);
  return delta.addScaledVector(axis, -axial).length();
}

function isAlreadyInternal(branch: ClusterBranch, host: ClusterBranch): boolean {
  const hostRadius = host.radiusBottom * radiusScale(host.maturity);
  return radialDistanceFromHostAxis(branch, host) <= hostRadius * 0.18;
}

/**
 * Малі батьківські шпилі не завжди можуть повністю поглинути satellite.
 * Тому бюджетні невидимі включення кладемо в гарантовано широкий монарх.
 * Це renderer-only branch copy: upstream Growth State і attachment-граф
 * залишаються недоторканними.
 */
function hideInsideMonarch(
  branch: ClusterBranch,
  monarch: ClusterBranch,
): ClusterBranch {
  const monarchAxis = axisOf(monarch);
  const monarchHeight = monarch.height * heightScale(monarch.maturity);
  const monarchRadius = monarch.radiusBottom * radiusScale(monarch.maturity);
  const radial = radialDirection(monarchAxis, branch.key);
  const position = positionOf(monarch)
    .addScaledVector(monarchAxis, monarchHeight * 0.018)
    .addScaledVector(radial, monarchRadius * 0.012);
  const direction = monarchAxis
    .clone()
    .multiplyScalar(0.995)
    .addScaledVector(radial, 0.025)
    .normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction);
  quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(
    UP,
    unitFromKey(branch.key, 'reference-hidden-spin') * TAU,
  ));
  quaternion.normalize();

  return {
    ...branch,
    hostKey: monarch.key,
    height: Math.min(branch.height, monarch.height * 0.045),
    radiusBottom: Math.min(branch.radiusBottom, monarch.radiusBottom * 0.065),
    posX: position.x,
    posY: position.y,
    posZ: position.z,
    quatX: quaternion.x,
    quatY: quaternion.y,
    quatZ: quaternion.z,
    quatW: quaternion.w,
    archetype: branch.archetype === 'etched' ? 'etched' : 'spear',
  };
}

/**
 * Ховає лише додаткові неакцентні листові satellites. Уже внутрішні тіла
 * пропускаються, тож pass справді збільшує економію, а не обирає ті самі
 * включення вдруге.
 */
export function enforceReferenceHiddenBudget(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  if (!branches.some((branch) => branch.archetype === 'matrix')) {
    return branches.map((branch) => ({ ...branch }));
  }
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));

  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  const loadBearing = new Set(
    branches
      .map((branch) => branch.hostKey)
      .filter((key): key is string => key !== null),
  );
  const accentKeys = selectReferenceAccentKeys(branches);
  const candidates = branches
    .filter((branch) => {
      if (
        branch.role !== 'satellite'
        || branch.hostKey === null
        || accentKeys.has(branch.key)
        || loadBearing.has(branch.key)
      ) return false;
      const host = byKey.get(branch.hostKey);
      return host !== undefined && !isAlreadyInternal(branch, host);
    })
    .sort((left, right) => {
      const leftVolume = left.height * left.radiusBottom * left.radiusBottom;
      const rightVolume = right.height * right.radiusBottom * right.radiusBottom;
      return leftVolume - rightVolume || left.key.localeCompare(right.key);
    })
    .slice(0, ADDITIONAL_HIDDEN_TARGET);

  const hiddenKeys = new Set(candidates.map((branch) => branch.key));
  return branches.map((branch) => (
    hiddenKeys.has(branch.key) ? hideInsideMonarch(branch, monarch) : { ...branch }
  ));
}
