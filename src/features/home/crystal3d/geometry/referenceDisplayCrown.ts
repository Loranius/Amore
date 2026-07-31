// ============================================================
// referenceDisplayCrown — контрольований renderer-only силует друзи.
// ------------------------------------------------------------
// Growth/Artifact State лишається джерелом кількості, ключів і кольору hero.
// Обрані логічні тіла отримують display-mesh з ТИМ САМИМ ключем; canonical
// mesh лишається валідним для shell-аудиту, але не входить у renderable.
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
const HERO_ANGLE = -1.72;
const HERO_RATIO = 0.48;
const MEDIUM_ANGLES = [-1.25, 1.25, -0.78, 0.78, -0.36, 0.36] as const;
const SHORT_ANGLES = [-1.5, 1.5, -1.12, 1.12, -0.76, 0.76, -0.42, 0.42, 0] as const;
const MEDIUM_RATIOS = [0.38, 0.34, 0.31, 0.28, 0.25, 0.23] as const;
const SHORT_RATIOS = [0.17, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09] as const;

const heightScale = (maturity: number): number => 0.32 + maturity * 0.68;
const radiusScale = (maturity: number): number => 0.4 + maturity * 0.6;
const renderedHeight = (branch: ClusterBranch): number => branch.height * heightScale(branch.maturity);
const renderedRadius = (branch: ClusterBranch): number => branch.radiusBottom * radiusScale(branch.maturity);
const volume = (branch: ClusterBranch): number =>
  renderedHeight(branch) * renderedRadius(branch) * renderedRadius(branch);

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

function chooseHero(branches: readonly ClusterBranch[]): ClusterBranch | null {
  return (
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.emissive === true) ??
    branches.find((branch) => !branch.primary && branch.role === 'dominant' && branch.tier === 'support') ??
    null
  );
}

/** Leaf-тіла можна замінити display-mesh без видимої сироти. Hero може
 * мати нащадків — їхні canonical mesh також не входять у renderable. */
export function selectReferenceDisplaySources(
  branches: readonly ClusterBranch[],
  accentKeys: ReadonlySet<string>,
): ReferenceDisplaySelection {
  const matrix = branches.find((branch) => branch.archetype === 'matrix');
  const monarch = branches.find((branch) => branch.primary);
  if (matrix === undefined || monarch === undefined) {
    return { heroKey: null, mediumKeys: [], shortKeys: [], sourceKeys: new Set() };
  }

  const hero = chooseHero(branches);
  const heroKey = hero?.key ?? null;
  const children = new Map<string, string[]>();
  for (const branch of branches) {
    if (branch.hostKey === null) continue;
    const list = children.get(branch.hostKey) ?? [];
    list.push(branch.key);
    children.set(branch.hostKey, list);
  }
  const hasChildren = (key: string): boolean => (children.get(key)?.length ?? 0) > 0;

  const eligible = branches.filter((branch) => (
    !branch.primary
    && branch.archetype !== 'matrix'
    && branch.key !== heroKey
    && branch.role !== 'micro'
    && !hasChildren(branch.key)
  ));

  const accentCandidates = eligible
    .filter((branch) => accentKeys.has(branch.key))
    .sort((left, right) => left.key.localeCompare(right.key));
  const smallestExtras = eligible
    .filter((branch) => !accentKeys.has(branch.key))
    .sort((left, right) => volume(left) - volume(right) || left.key.localeCompare(right.key));
  const shortSources = [...accentCandidates];
  for (const candidate of smallestExtras) {
    if (shortSources.length >= SHORT_ANGLES.length) break;
    shortSources.push(candidate);
  }

  const shortSet = new Set(shortSources.map((branch) => branch.key));
  const mediumSources = eligible
    .filter((branch) => !shortSet.has(branch.key))
    .sort((left, right) => volume(right) - volume(left) || left.key.localeCompare(right.key))
    .slice(0, MEDIUM_ANGLES.length);

  const sourceKeys = new Set<string>([
    ...shortSources.map((branch) => branch.key),
    ...mediumSources.map((branch) => branch.key),
  ]);
  if (heroKey !== null) {
    sourceKeys.add(heroKey);
    const stack = [...(children.get(heroKey) ?? [])];
    while (stack.length > 0) {
      const key = stack.pop()!;
      sourceKeys.add(key);
      stack.push(...(children.get(key) ?? []));
    }
  }

  return {
    heroKey,
    mediumKeys: Object.freeze(mediumSources.map((branch) => branch.key)),
    shortKeys: Object.freeze(shortSources.slice(0, SHORT_ANGLES.length).map((branch) => branch.key)),
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
  const radiusBottom = height / (kind === 'hero' ? 3.85 : kind === 'medium' ? 4.25 : 3.95);
  const position = base.clone().addScaledVector(radial, radiusDistance);
  const direction = UP
    .clone()
    .multiplyScalar(kind === 'hero' ? 0.99 : kind === 'medium' ? 0.88 : 0.78)
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
): { selection: ReferenceDisplaySelection; bodies: ReferenceDisplayBody[] } {
  const selection = selectReferenceDisplaySources(branches, accentKeys);
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
    .addScaledVector(axis, matrixHeight * 0.42);
  const bodies: ReferenceDisplayBody[] = [];

  if (selection.heroKey !== null) {
    const source = byKey.get(selection.heroKey);
    if (source !== undefined) {
      const radial = radialAt(front, right, HERO_ANGLE);
      const branch = displayBranch(
        source,
        monarch,
        foundation.clone().addScaledVector(axis, matrixHeight * 0.03),
        radial,
        HERO_RATIO,
        monarchRadius * 1.02,
        0.1,
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
    const ownRadius = renderedHeight(monarch) * ratio / 4.25;
    const branch = displayBranch(
      source,
      monarch,
      foundation.clone().addScaledVector(axis, matrixHeight * (0.02 + (index % 2) * 0.025)),
      radial,
      ratio,
      monarchRadius * 0.9 + ownRadius * 0.3,
      0.42 + (index % 3) * 0.04,
      index * 0.37,
      'medium',
    );
    bodies.push(makeBody(branch, source.key, 'medium', material, lod));
  });

  selection.shortKeys.forEach((key, index) => {
    const source = byKey.get(key);
    if (source === undefined) return;
    const ratio = SHORT_RATIOS[index] ?? 0.09;
    const radial = radialAt(front, right, SHORT_ANGLES[index] ?? index * 0.5);
    const ownRadius = renderedHeight(monarch) * ratio / 3.95;
    const branch = displayBranch(
      source,
      monarch,
      foundation.clone().addScaledVector(axis, matrixHeight * (0.04 + (index % 3) * 0.018)),
      radial,
      ratio,
      monarchRadius * 0.98 + ownRadius * 0.42,
      0.56 + (index % 3) * 0.05,
      index * 0.51,
      'short',
    );
    bodies.push(makeBody(branch, source.key, 'short', material, lod));
  });

  return { selection, bodies };
}
