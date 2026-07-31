// ============================================================
// referenceDisplayCrown — контрольований renderer-only силует друзи.
// ------------------------------------------------------------
// Growth/Artifact State лишається джерелом кількості, ключів і кольору hero.
// Кожне ВИДИМЕ неосновне логічне тіло отримує display-mesh з ТИМ САМИМ
// ключем; canonical mesh лишається валідним для shell-аудиту, але не
// входить у фактичний renderable. Приховані canonical тіла не оживають.
// ============================================================
import * as THREE from 'three';
import {
  buildBranchGeometry,
  type ClusterBranch,
  type ClusterMaterial,
} from '../crystalCluster';
import { buildHostSolid, type HostSolid } from './hostBody';
import type { LodLevel } from './lod';
import {
  bindMaterialRegions,
  type MaterialRegionStats,
} from '../material/crystalMaterial';

const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_FRONT = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HERO_ANGLE = -1.72;
const HERO_RATIO = 0.48;
const MEDIUM_ANGLES = [-1.25, 1.25, -0.82, 0.82, -0.4, 0.4] as const;
const SHORT_ANGLES = [-1.5, 1.5, -1.14, 1.14, -0.78, 0.78, -0.42, 0.42, 0] as const;
const MEDIUM_RATIOS = [0.38, 0.34, 0.31, 0.28, 0.25, 0.23] as const;

const heightScale = (maturity: number): number => 0.32 + maturity * 0.68;
const radiusScale = (maturity: number): number => 0.4 + maturity * 0.6;
const renderedHeight = (branch: ClusterBranch): number => branch.height * heightScale(branch.maturity);
const renderedRadius = (branch: ClusterBranch): number => branch.radiusBottom * radiusScale(branch.maturity);
const volume = (branch: ClusterBranch): number =>
  renderedHeight(branch) * renderedRadius(branch) * renderedRadius(branch);

const shortRatio = (index: number, count: number): number => {
  if (count <= 1) return 0.12;
  const t = index / (count - 1);
  return 0.17 - t * 0.095;
};

const shortAngle = (index: number): number => {
  const fixed = SHORT_ANGLES[index];
  if (fixed !== undefined) return fixed;
  const angle = index * GOLDEN_ANGLE + 0.31;
  return ((angle + Math.PI) % TAU) - Math.PI;
};

export interface ReferenceDisplayBody {
  readonly branch: ClusterBranch;
  readonly solid: HostSolid;
  readonly geometry: THREE.BufferGeometry;
  readonly material: MaterialRegionStats;
  readonly sourceKey: string;
  readonly kind: 'hero' | 'medium' | 'short';
}

export interface ReferenceDisplaySelection {
  readonly heroKey: string | null;
  readonly mediumKeys: readonly string[];
  readonly shortKeys: readonly string[];
  readonly sourceKeys: ReadonlySet<string>;
}

function chooseHero(
  branches: readonly ClusterBranch[],
  eligibleKeys?: ReadonlySet<string>,
): ClusterBranch | null {
  const eligible = (branch: ClusterBranch): boolean =>
    eligibleKeys === undefined || eligibleKeys.has(branch.key);
  return (
    branches.find((branch) => (
      eligible(branch)
      && !branch.primary
      && branch.role === 'dominant'
      && branch.emissive === true
    )) ??
    branches.find((branch) => (
      eligible(branch)
      && !branch.primary
      && branch.role === 'dominant'
      && branch.tier === 'support'
    )) ??
    null
  );
}

/**
 * Усі фактично видимі неосновні тіла переходять у контрольовану корону.
 * Це прибирає випадкові canonical-уламки зі стовбура, але не змінює
 * кількість подій: один source key → рівно один display key.
 */
export function selectReferenceDisplaySources(
  branches: readonly ClusterBranch[],
  accentKeys: ReadonlySet<string>,
  eligibleKeys?: ReadonlySet<string>,
): ReferenceDisplaySelection {
  const matrix = branches.find((branch) => branch.archetype === 'matrix');
  const monarch = branches.find((branch) => branch.primary);
  if (matrix === undefined || monarch === undefined) {
    return { heroKey: null, mediumKeys: [], shortKeys: [], sourceKeys: new Set() };
  }

  const isEligible = (branch: ClusterBranch): boolean =>
    eligibleKeys === undefined || eligibleKeys.has(branch.key);
  const hero = chooseHero(branches, eligibleKeys);
  const heroKey = hero?.key ?? null;
  const population = branches.filter((branch) => (
    isEligible(branch)
    && !branch.primary
    && branch.archetype !== 'matrix'
    && branch.key !== heroKey
  ));

  // Найбільші неакцентні family/satellite формують середнє кільце. Micro й
  // accent завжди лишаються у короткій юбці.
  const mediumSources = population
    .filter((branch) => branch.role !== 'micro' && !accentKeys.has(branch.key))
    .sort((left, right) => volume(right) - volume(left) || left.key.localeCompare(right.key))
    .slice(0, MEDIUM_ANGLES.length);
  const mediumSet = new Set(mediumSources.map((branch) => branch.key));
  const shortSources = population
    .filter((branch) => !mediumSet.has(branch.key))
    .sort((left, right) => {
      const leftAccent = accentKeys.has(left.key) ? 0 : 1;
      const rightAccent = accentKeys.has(right.key) ? 0 : 1;
      return (
        leftAccent - rightAccent
        || volume(left) - volume(right)
        || left.key.localeCompare(right.key)
      );
    });

  const sourceKeys = new Set<string>([
    ...mediumSources.map((branch) => branch.key),
    ...shortSources.map((branch) => branch.key),
  ]);
  if (heroKey !== null) sourceKeys.add(heroKey);

  return {
    heroKey,
    mediumKeys: Object.freeze(mediumSources.map((branch) => branch.key)),
    shortKeys: Object.freeze(shortSources.map((branch) => branch.key)),
    sourceKeys,
  };
}

function basis(axis: THREE.Vector3): { front: THREE.Vector3; right: THREE.Vector3 } {
  let front = CAMERA_FRONT.clone().addScaledVector(axis, -CAMERA_FRONT.dot(axis));
  if (front.lengthSq() < 1e-6) front = new THREE.Vector3(0, 0, 1);
  front.normalize();
  return { front, right: new THREE.Vector3().crossVectors(axis, front).normalize() };
}

function radialAt(front: THREE.Vector3, right: THREE.Vector3, angle: number): THREE.Vector3 {
  return front
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(right, Math.sin(angle))
    .normalize();
}

function quaternionFor(direction: THREE.Vector3, spin: number): THREE.Quaternion {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
  quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  return quaternion.normalize();
}

function displayBranch(
  source: ClusterBranch,
  monarch: ClusterBranch,
  base: THREE.Vector3,
  radial: THREE.Vector3,
  heightRatio: number,
  radiusDistance: number,
  outward: number,
  spin: number,
  kind: ReferenceDisplayBody['kind'],
): ClusterBranch {
  const monarchHeight = renderedHeight(monarch);
  const height = monarchHeight * heightRatio;
  const radiusBottom = height / (kind === 'hero' ? 2.9 : kind === 'medium' ? 3.9 : 3.45);
  const position = base.clone().addScaledVector(radial, radiusDistance);
  const direction = UP
    .clone()
    .multiplyScalar(kind === 'hero' ? 0.99 : kind === 'medium' ? 0.88 : 0.76)
    .addScaledVector(radial, outward)
    .normalize();
  const quaternion = quaternionFor(direction, spin);
  const skirt = kind !== 'hero';

  return {
    ...source,
    hostKey: null,
    height,
    radiusBottom,
    posX: position.x,
    posY: position.y,
    posZ: position.z,
    quatX: quaternion.x,
    quatY: quaternion.y,
    quatZ: quaternion.z,
    quatW: quaternion.w,
    maturity: 1,
    primary: false,
    role: kind === 'short' ? 'satellite' : 'dominant',
    tier: kind === 'hero' ? 'support' : kind === 'medium' ? 'family' : 'companion',
    archetype: 'prismatic',
    colorA: skirt ? monarch.colorA : source.colorA,
    colorB: skirt ? monarch.colorB : source.colorB,
    breathePhase: source.breathePhase,
    breatheSpeed: source.breatheSpeed,
  };
}

function makeBody(
  branch: ClusterBranch,
  sourceKey: string,
  kind: ReferenceDisplayBody['kind'],
  material: ClusterMaterial,
  lod: LodLevel,
): ReferenceDisplayBody {
  const solid = buildHostSolid(branch, material, lod);
  const geometry = buildBranchGeometry(branch, material, lod);
  geometry.userData.referenceDisplay = true;
  geometry.userData.sourceKey = sourceKey;
  geometry.userData.referenceKind = kind;
  const materialStats = bindMaterialRegions(geometry, branch, solid, material);
  return { branch, solid, geometry, material: materialStats, sourceKey, kind };
}

export function buildReferenceDisplayCrown(
  branches: readonly ClusterBranch[],
  material: ClusterMaterial,
  lod: LodLevel,
  accentKeys: ReadonlySet<string>,
  eligibleKeys?: ReadonlySet<string>,
): { selection: ReferenceDisplaySelection; bodies: ReferenceDisplayBody[] } {
  const selection = selectReferenceDisplaySources(branches, accentKeys, eligibleKeys);
  const monarch = branches.find((branch) => branch.primary);
  const matrix = branches.find((branch) => branch.archetype === 'matrix');
  if (monarch === undefined || matrix === undefined) return { selection, bodies: [] };

  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  const axis = UP.clone().applyQuaternion(new THREE.Quaternion(
    monarch.quatX,
    monarch.quatY,
    monarch.quatZ,
    monarch.quatW,
  )).normalize();
  const { front, right } = basis(axis);
  const monarchRadius = renderedRadius(monarch);
  const matrixHeight = renderedHeight(matrix);
  const foundation = new THREE.Vector3(matrix.posX, matrix.posY, matrix.posZ)
    .addScaledVector(axis, matrixHeight * 0.58);
  const bodies: ReferenceDisplayBody[] = [];

  if (selection.heroKey !== null) {
    const source = byKey.get(selection.heroKey);
    if (source !== undefined) {
      const radial = radialAt(front, right, HERO_ANGLE);
      const branch = displayBranch(
        source,
        monarch,
        foundation.clone().addScaledVector(axis, matrixHeight * 0.08),
        radial,
        HERO_RATIO,
        monarchRadius * 1.18,
        0.18,
        0.08,
        'hero',
      );
      bodies.push(makeBody(branch, source.key, 'hero', material, lod));
    }
  }

  selection.mediumKeys.forEach((key, index) => {
    const source = byKey.get(key);
    if (source === undefined) return;
    const ratio = MEDIUM_RATIOS[index] ?? 0.23;
    const radial = radialAt(front, right, MEDIUM_ANGLES[index] ?? index * 0.6);
    const ownRadius = renderedHeight(monarch) * ratio / 3.9;
    const branch = displayBranch(
      source,
      monarch,
      foundation.clone().addScaledVector(axis, matrixHeight * (0.08 + (index % 2) * 0.035)),
      radial,
      ratio,
      monarchRadius * 1.02 + ownRadius * 0.58,
      0.5 + (index % 3) * 0.05,
      index * 0.37,
      'medium',
    );
    bodies.push(makeBody(branch, source.key, 'medium', material, lod));
  });

  const shortCount = selection.shortKeys.length;
  selection.shortKeys.forEach((key, index) => {
    const source = byKey.get(key);
    if (source === undefined) return;
    const ratio = shortRatio(index, shortCount);
    const radial = radialAt(front, right, shortAngle(index));
    const ownRadius = renderedHeight(monarch) * ratio / 3.45;
    const ring = Math.floor(index / 10);
    const branch = displayBranch(
      source,
      monarch,
      foundation.clone().addScaledVector(
        axis,
        matrixHeight * (0.1 + (index % 3) * 0.025 + ring * 0.035),
      ),
      radial,
      ratio,
      monarchRadius * (1.07 + ring * 0.24) + ownRadius * 0.62,
      0.62 + (index % 3) * 0.055,
      index * 0.51,
      'short',
    );
    bodies.push(makeBody(branch, source.key, 'short', material, lod));
  });

  return { selection, bodies };
}
