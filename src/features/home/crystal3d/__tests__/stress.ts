// ============================================================
// Стрес-конфігурації §8 профілю.
// ------------------------------------------------------------
// Тут синтетика доречна — на відміну від основних тестів, які свідомо
// ганяють реальну масу рушія. Профіль вимагає конфігурацій, яких дані
// конкретної пари можуть не дати роками: тонкий господар із товстою
// дитиною, двоє сусідів рівно на мінімальній кутовій відстані, стеля
// кількості дітей. Чекати, доки життя пари їх згенерує, — не валідація.
//
// Тіла будуються як `ClusterBranch` напряму, але за тим самим контрактом,
// що й `deriveClusterBranch`: кватерніон з напрямку росту, `hostKey`,
// ярус/архетип. Далі — той самий `publishCrystal`, що й у застосунку.
// ============================================================
import * as THREE from 'three';
import { crystalSpecies } from '../../artifact/species/crystalSpecies';
import { TOTAL_BODY_CAP } from '../../artifact/composition/mineralPreset';
import type { ClusterBranch, ClusterMaterial } from '../crystalCluster';

const UP = new THREE.Vector3(0, 1, 0);

export interface BranchSpec {
  key: string;
  hostKey?: string | null;
  /** Світова позиція основи тіла. */
  pos: [number, number, number];
  /** Напрямок росту (нормалізується). */
  dir: [number, number, number];
  height: number;
  radius: number;
  maturity?: number;
  primary?: boolean;
  role?: ClusterBranch['role'];
  tier?: ClusterBranch['tier'];
  archetype?: ClusterBranch['archetype'];
}

/** Валідна гілка за контрактом `deriveClusterBranch`, але зібрана вручну. */
export function makeBranch(spec: BranchSpec): ClusterBranch {
  const direction = new THREE.Vector3(...spec.dir).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, direction);
  return {
    key: spec.key,
    kind: 'core',
    domain: null,
    hostKey: spec.hostKey ?? null,
    height: spec.height,
    radiusBottom: spec.radius,
    posX: spec.pos[0],
    posY: spec.pos[1],
    posZ: spec.pos[2],
    quatX: quat.x,
    quatY: quat.y,
    quatZ: quat.z,
    quatW: quat.w,
    colorA: '#6d4fa8',
    colorB: '#e9ddff',
    breathePhase: 0,
    breatheSpeed: 0.4,
    maturity: spec.maturity ?? 1,
    role: spec.role ?? 'dominant',
    tier: spec.tier ?? 'family',
    archetype: spec.archetype ?? 'spear',
    primary: spec.primary ?? false,
  };
}

/** Нейтральний матеріал: стрес-кейси про геометрію, не про тиски еволюції. */
export const STRESS_MATERIAL: ClusterMaterial = {
  roughness: 0.2,
  clearcoat: 0.7,
  polish: 0.5,
  warmthMix: 0,
  movieMix: 0,
  glow: 0,
  surfaceComplexity: 0.5,
  density: 0.5,
  dominant: null,
  dominance: 0,
};

/**
 * Точка на бічній поверхні господаря + напрямок назовні — так дитина
 * кріпиться туди, куди її поставив би рушій, а не «десь поруч».
 */
function onHostSurface(
  host: BranchSpec,
  t: number,
  angle: number,
  burial: number,
): { pos: [number, number, number]; dir: [number, number, number] } {
  // Господарі у стрес-кейсах ростуть строго вгору, тож локальна рамка = світова.
  const hostR = host.radius * (1 - 0.7 * t) * (0.4 + 0.6 * (host.maturity ?? 1));
  const hostH = host.height * (0.32 + 0.68 * (host.maturity ?? 1));
  const r = hostR - burial;
  return {
    pos: [host.pos[0] + Math.cos(angle) * r, host.pos[1] + hostH * t, host.pos[2] + Math.sin(angle) * r],
    dir: [Math.cos(angle) * 0.75, 0.9, Math.sin(angle) * 0.75],
  };
}

export interface StressCase {
  id: string;
  /** Що саме з §8 покриває цей кейс. */
  requirement: string;
  branches: ClusterBranch[];
}

/** §8: «a thin host with a comparatively thick child». */
function thinHostThickChild(): StressCase {
  const host: BranchSpec = { key: 'thin-host', pos: [0, 0, 0], dir: [0, 1, 0], height: 1.4, radius: 0.06 };
  const site = onHostSurface(host, 0.35, 0.6, 0.03);
  return {
    id: 'thin-host-thick-child',
    requirement: '§8 thin host / thick child',
    branches: [
      makeBranch({ ...host, primary: true, tier: 'king' }),
      makeBranch({
        key: 'thick-child',
        hostKey: 'thin-host',
        pos: site.pos,
        dir: site.dir,
        height: 0.7,
        radius: 0.09, // товща за господаря в 1.5 раза
        tier: 'support',
      }),
    ],
  };
}

/** §8: «two neighboring children at minimum allowed spacing». */
function minSpacingSiblings(): StressCase {
  const host: BranchSpec = { key: 'host', pos: [0, 0, 0], dir: [0, 1, 0], height: 1.2, radius: 0.22 };
  const gap = crystalSpecies.constrain().minAngularSeparation; // 0.55 рад
  const a = onHostSurface(host, 0.4, 0, 0.05);
  const b = onHostSurface(host, 0.4, gap, 0.05);
  return {
    id: 'min-spacing-siblings',
    requirement: '§8 two neighbours at minimum spacing',
    branches: [
      makeBranch({ ...host, primary: true, tier: 'king' }),
      makeBranch({ key: 'sib-a', hostKey: 'host', pos: a.pos, dir: a.dir, height: 0.6, radius: 0.07 }),
      makeBranch({ key: 'sib-b', hostKey: 'host', pos: b.pos, dir: b.dir, height: 0.6, radius: 0.07 }),
    ],
  };
}

/** §8: «a mature host with newly grown children» (append-only). */
function matureHostFreshChildren(): StressCase {
  const host: BranchSpec = { key: 'mature', pos: [0, 0, 0], dir: [0, 1, 0], height: 1.3, radius: 0.2, maturity: 1 };
  const branches = [makeBranch({ ...host, primary: true, tier: 'king' })];
  for (let i = 0; i < 5; i++) {
    const site = onHostSurface(host, 0.2 + i * 0.12, (i / 5) * Math.PI * 2, 0.04);
    branches.push(
      makeBranch({
        key: `fresh-${i}`,
        hostKey: 'mature',
        pos: site.pos,
        dir: site.dir,
        height: 0.45,
        radius: 0.05,
        maturity: 0.02, // щойно з'явилось
        role: 'satellite',
        tier: 'companion',
      }),
    );
  }
  return { id: 'mature-host-fresh-children', requirement: '§8 mature host + newly grown children', branches };
}

/** §8: «maximum supported child count» — стеля композиції. */
function maxChildren(): StressCase {
  const host: BranchSpec = { key: 'big-host', pos: [0, 0, 0], dir: [0, 1, 0], height: 1.6, radius: 0.3 };
  const branches = [makeBranch({ ...host, primary: true, tier: 'king' })];
  const n = TOTAL_BODY_CAP - 1;
  // Золотий кут дає рівномірний розподіл без збігів азимутів.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const site = onHostSurface(host, 0.08 + (i / n) * 0.8, i * golden, 0.03);
    branches.push(
      makeBranch({
        key: `child-${String(i).padStart(3, '0')}`,
        hostKey: 'big-host',
        pos: site.pos,
        dir: site.dir,
        height: 0.28,
        radius: 0.026,
        role: 'satellite',
        tier: 'micro',
      }),
    );
  }
  return { id: 'max-children', requirement: '§8 maximum supported child count', branches };
}

export const STRESS_CASES: StressCase[] = [
  thinHostThickChild(),
  minSpacingSiblings(),
  matureHostFreshChildren(),
  maxChildren(),
];
