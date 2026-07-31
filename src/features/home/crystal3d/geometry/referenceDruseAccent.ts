// ============================================================
// referenceDruseAccent — коротка видима фракція базальної юбки.
// ------------------------------------------------------------
// Структурний контракт вимірює 10-й перцентиль, тому фіксовані 2/6 шпилів
// не масштабуються від sparse до rich. Приблизно 14% неслужбових тіл стають
// короткою фракцією 10–11.8% висоти монарха. Беремо лише листові тіла без
// власних дітей: renderer-layout не розриває локальні колонії та Growth
// State/стабільні ключі лишаються недоторканними.
// ============================================================
import * as THREE from 'three';
import { hashSeedString } from '../../mulberry32';
import type { ClusterBranch } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_FRONT = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const NEAR_SPECK_PROMOTION_COUNT = 2;
const FRONT_ACCENT_SLOTS = [
  -0.96,
  0.96,
  -0.62,
  0.62,
  -0.31,
  0.31,
  0,
  -1.26,
  1.26,
] as const;

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

function presentationRadial(axis: THREE.Vector3, angle: number): THREE.Vector3 {
  let front = CAMERA_FRONT.clone().addScaledVector(axis, -CAMERA_FRONT.dot(axis));
  if (front.lengthSq() < 1e-6) front = new THREE.Vector3(1, 0, 0);
  front.normalize();
  const right = new THREE.Vector3().crossVectors(axis, front).normalize();
  return front
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(right, Math.sin(angle))
    .normalize();
}

function accentAngle(index: number): number {
  if (index < FRONT_ACCENT_SLOTS.length) return FRONT_ACCENT_SLOTS[index]!;
  return FRONT_ACCENT_SLOTS[index % FRONT_ACCENT_SLOTS.length]!
    + (Math.floor(index / FRONT_ACCENT_SLOTS.length) + 1) * GOLDEN_ANGLE;
}

function placeAccent(
  branch: ClusterBranch,
  monarch: ClusterBranch,
  foundation: ClusterBranch,
  accentIndex: number,
): ClusterBranch {
  const heightRatio = 0.1 + (accentIndex % 4) * 0.006;
  const height = monarch.height * heightRatio;
  const accentRadius = Math.min(
    Math.max(height / 4.4, monarch.radiusBottom * 0.045),
    monarch.radiusBottom * 0.24,
  );
  const foundationPosition = new THREE.Vector3(
    foundation.posX,
    foundation.posY,
    foundation.posZ,
  );
  const foundationQuaternion = new THREE.Quaternion(
    foundation.quatX,
    foundation.quatY,
    foundation.quatZ,
    foundation.quatW,
  ).normalize();
  const foundationAxis = UP.clone().applyQuaternion(foundationQuaternion).normalize();
  const foundationHeight = foundation.height * heightScale(foundation.maturity);
  const foundationRadius = foundation.radiusBottom * radiusScale(foundation.maturity);
  const radial = presentationRadial(foundationAxis, accentAngle(accentIndex));
  const tangent = new THREE.Vector3().crossVectors(radial, foundationAxis).normalize();

  // Низькі шпилі стоять на верхньому плечі прихованої матриці. Перші
  // дев'ять утворюють фронтальну дугу, решта добудовують друге повне кільце.
  // Основа занурена, але центр винесений майже до краю породи — юбка не
  // ховається за товстим монархом у стартовому Pixel 8 Pro кадрі.
  const ring = Math.floor(accentIndex / FRONT_ACCENT_SLOTS.length);
  const radialDistance = foundationRadius * (0.82 + ring * 0.14)
    + accentRadius * (0.2 + ring * 0.55);
  const position = foundationPosition
    .addScaledVector(foundationAxis, foundationHeight * (0.42 + (accentIndex % 3) * 0.025))
    .addScaledVector(radial, radialDistance)
    .addScaledVector(tangent, foundationRadius * ((accentIndex % 2 === 0 ? 1 : -1) * 0.025));
  const direction = foundationAxis
    .clone()
    .multiplyScalar(0.7 + (accentIndex % 3) * 0.06)
    .addScaledVector(UP, 0.28)
    .addScaledVector(radial, 0.72 + (accentIndex % 4) * 0.045)
    .addScaledVector(tangent, accentIndex % 2 === 0 ? 0.035 : -0.035)
    .normalize();
  const quaternion = quaternionFor(direction, branch.key);

  return {
    ...branch,
    hostKey: foundation.key,
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

/** Стабільна множина тіл, які мають лишитися видимою короткою фракцією. */
export function selectReferenceAccentKeys(
  branches: readonly ClusterBranch[],
): ReadonlySet<string> {
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return new Set();

  const heroKey = chooseHero(branches);
  const loadBearing = new Set(
    branches
      .map((branch) => branch.hostKey)
      .filter((key): key is string => key !== null),
  );
  const population = branches.filter((branch) => (
    !branch.primary
    && branch.archetype !== 'matrix'
    && branch.key !== heroKey
    && branch.role !== 'micro'
  ));
  const targetCount = Math.max(2, Math.ceil(population.length * 0.14));
  return new Set(
    population
      .filter((branch) => !loadBearing.has(branch.key))
      .sort((left, right) => {
        const lv = left.height * left.radiusBottom * left.radiusBottom;
        const rv = right.height * right.radiusBottom * right.radiusBottom;
        return lv - rv || left.key.localeCompare(right.key);
      })
      .slice(0, targetCount)
      .map((branch) => branch.key),
  );
}

/**
 * У щільній backfilled-друзі частина звичайних family-dominants може бути
 * буквально на кілька відсотків нижчою за радіус об’ємного монарха й
 * читатися пилом. Accent-шпилі не чіпаємо — вони потрібні короткому децилю.
 * Натомість два найближчі до порога неакцентні листові кристали піднімаємо
 * до 103,5% радіуса монарха, але не вище 24% його висоти.
 */
function promoteNearSpeckFamilySpires(
  branches: readonly ClusterBranch[],
  monarch: ClusterBranch,
  accentKeys: ReadonlySet<string>,
): ClusterBranch[] {
  const monarchHeight = monarch.height * heightScale(monarch.maturity);
  const monarchRadius = monarch.radiusBottom * radiusScale(monarch.maturity);
  const readableHeight = Math.min(monarchHeight * 0.24, monarchRadius * 1.035);
  if (readableHeight <= monarchRadius) return branches.map((branch) => ({ ...branch }));

  const loadBearing = new Set(
    branches
      .map((branch) => branch.hostKey)
      .filter((key): key is string => key !== null),
  );
  const promoted = new Set(
    branches
      .filter((branch) => {
        if (
          branch.primary
          || branch.archetype === 'matrix'
          || branch.role !== 'dominant'
          || accentKeys.has(branch.key)
          || loadBearing.has(branch.key)
        ) return false;
        const effectiveHeight = branch.height * heightScale(branch.maturity);
        return effectiveHeight < monarchRadius && effectiveHeight >= monarchRadius * 0.72;
      })
      .sort((left, right) => {
        const leftHeight = left.height * heightScale(left.maturity);
        const rightHeight = right.height * heightScale(right.maturity);
        return rightHeight - leftHeight || left.key.localeCompare(right.key);
      })
      .slice(0, NEAR_SPECK_PROMOTION_COUNT)
      .map((branch) => branch.key),
  );

  return branches.map((branch) => (
    promoted.has(branch.key)
      ? { ...branch, height: readableHeight / heightScale(branch.maturity) }
      : { ...branch }
  ));
}

export function ensureVisibleReferenceAccent(
  branches: readonly ClusterBranch[],
): ClusterBranch[] {
  const monarch = branches.find((branch) => branch.primary);
  if (monarch === undefined) return branches.map((branch) => ({ ...branch }));
  const foundation = branches.find((branch) => branch.archetype === 'matrix') ?? monarch;

  const accentKeys = selectReferenceAccentKeys(branches);
  if (accentKeys.size === 0) return branches.map((branch) => ({ ...branch }));
  const accentIndex = new Map(
    [...accentKeys].map((key, index) => [key, index] as const),
  );
  const accented = branches.map((branch) => {
    const index = accentIndex.get(branch.key);
    return index === undefined
      ? { ...branch }
      : placeAccent(branch, monarch, foundation, index);
  });
  return promoteNearSpeckFamilySpires(accented, monarch, accentKeys);
}
