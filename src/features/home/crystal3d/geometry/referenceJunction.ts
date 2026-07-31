// ============================================================
// referenceJunction — один гарантовано замкнений implicit-комірець.
// ------------------------------------------------------------
// Low/medium використовують дешеву замкнену ікосаедричну апроксимацію
// smooth-union; high — локальне поле Three.js MarchingCubes. Обидва шляхи
// виконуються один раз під час publication і не створюють логічного тіла.
// ============================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ClusterBranch } from '../crystalCluster';
import type { HostSolid } from './hostBody';
import type { LodLevel } from './lod';

interface JunctionBudget {
  readonly resolution: number;
  readonly maxPolyCount: number;
  readonly detail: number;
}

const BUDGET: Record<LodLevel, JunctionBudget> = {
  low: { resolution: 8, maxPolyCount: 500, detail: 1 },
  medium: { resolution: 9, maxPolyCount: 700, detail: 1 },
  high: { resolution: 11, maxPolyCount: 1_000, detail: 2 },
};

export interface ImplicitJunctionStats {
  readonly key: string;
  readonly sourceKey: string;
  readonly hostKey: string;
  readonly resolution: number;
  readonly trianglesGenerated: number;
  readonly trianglesKept: number;
  readonly exposedBoundaryEdges: number;
}

export interface ReferenceJunctionBody {
  readonly branch: ClusterBranch;
  readonly solid: HostSolid;
  readonly geometry: THREE.BufferGeometry;
  readonly stats: ImplicitJunctionStats;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function ellipsoidSdf(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
): number {
  return Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1;
}

function field(x: number, y: number, z: number, hostX: number, hostZ: number): number {
  const child = ellipsoidSdf(x, y, z, 0, 0.18, 0, 0.58, 0.7, 0.58);
  const neck = ellipsoidSdf(x, y, z, hostX * 0.45, 0.02, hostZ * 0.45, 0.68, 0.52, 0.68);
  const host = ellipsoidSdf(x, y, z, hostX, -0.15, hostZ, 0.62, 0.5, 0.62);
  return -smoothMin(smoothMin(child, neck, 0.3), host, 0.28);
}

function ensureIndexedUv(geometry: THREE.BufferGeometry, radius: number): THREE.BufferGeometry {
  if (geometry.getIndex() === null) {
    geometry.setIndex(Array.from(
      { length: geometry.getAttribute('position').count },
      (_, index) => index,
    ));
  }
  geometry.computeVertexNormals();
  if (geometry.getAttribute('uv') === undefined) {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i += 1) {
      uv[i * 2] = clamp(position.getX(i) / (radius * 3) + 0.5, 0, 1);
      uv[i * 2 + 1] = clamp(position.getY(i) / (radius * 2.4) + 0.5, 0, 1);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  return geometry;
}

function facetedClosedGeometry(radius: number, detail: number): THREE.BufferGeometry {
  const raw = new THREE.IcosahedronGeometry(radius * 1.22, detail);
  raw.scale(1.18, 0.78, 1.08);
  raw.translate(0, radius * 0.12, 0);
  const geometry = mergeVertices(raw, Math.max(1e-5, radius * 1e-4));
  raw.dispose();
  return ensureIndexedUv(geometry, radius);
}

function marchingGeometry(
  resolution: number,
  maxPolyCount: number,
  radius: number,
  hostX: number,
  hostZ: number,
): THREE.BufferGeometry | null {
  const material = new THREE.MeshBasicMaterial();
  const effect = new MarchingCubes(resolution, material, false, false, maxPolyCount);
  effect.isolation = 0;

  for (let z = 0; z < resolution; z += 1) {
    const nz = -1 + (z / (resolution - 1)) * 2;
    for (let y = 0; y < resolution; y += 1) {
      const ny = -1 + (y / (resolution - 1)) * 2;
      for (let x = 0; x < resolution; x += 1) {
        const nx = -1 + (x / (resolution - 1)) * 2;
        effect.setCell(x, y, z, field(nx, ny, nz, hostX, hostZ));
      }
    }
  }
  effect.update();

  const source = effect.geometry.getAttribute('position') as THREE.BufferAttribute;
  const drawn = effect.geometry.drawRange.count;
  const count = Number.isFinite(drawn) ? Math.min(source.count, drawn) : 0;
  if (count < 3) {
    effect.geometry.dispose();
    material.dispose();
    return null;
  }

  const radial = radius * 1.48;
  const axial = radius * 1.08;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = source.getX(i) * radial;
    positions[i * 3 + 1] = source.getY(i) * axial + radius * 0.12;
    positions[i * 3 + 2] = source.getZ(i) * radial;
  }

  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const geometry = mergeVertices(raw, Math.max(1e-5, radius * 1e-4));
  raw.dispose();
  effect.geometry.dispose();
  material.dispose();
  return ensureIndexedUv(geometry, radius);
}

function selectSource(
  branches: readonly ClusterBranch[],
  solids: ReadonlyMap<string, HostSolid>,
): ClusterBranch | null {
  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  return branches
    .filter((branch) => {
      if (branch.hostKey === null || branch.role === 'micro' || branch.archetype === 'matrix') return false;
      return byKey.get(branch.hostKey)?.primary === true && solids.has(branch.key);
    })
    .sort((left, right) => {
      const a = solids.get(left.key)!;
      const b = solids.get(right.key)!;
      const av = a.profile.r * a.profile.r * a.profile.h;
      const bv = b.profile.r * b.profile.r * b.profile.h;
      return bv - av || left.key.localeCompare(right.key);
    })[0] ?? null;
}

export function buildReferenceJunctionBodies(
  branches: readonly ClusterBranch[],
  solids: ReadonlyMap<string, HostSolid>,
  lod: LodLevel,
): ReferenceJunctionBody[] {
  const source = selectSource(branches, solids);
  if (source === null || source.hostKey === null) return [];
  const self = solids.get(source.key);
  const host = solids.get(source.hostKey);
  if (self === undefined || host === undefined) return [];

  const towardHost = host.position.clone().sub(self.position).applyQuaternion(self.inverseQuaternion);
  const horizontal = Math.hypot(towardHost.x, towardHost.z);
  const hostX = horizontal > 1e-8 ? clamp((towardHost.x / horizontal) * 0.24, -0.24, 0.24) : 0;
  const hostZ = horizontal > 1e-8 ? clamp((towardHost.z / horizontal) * 0.24, -0.24, 0.24) : 0;
  const radius = Math.max(0.05, self.profile.r);
  const budget = BUDGET[lod];
  const geometry = lod === 'high'
    ? (marchingGeometry(budget.resolution, budget.maxPolyCount, radius, hostX, hostZ)
      ?? facetedClosedGeometry(radius, budget.detail))
    : facetedClosedGeometry(radius, budget.detail);

  const index = geometry.getIndex();
  if (index === null || index.count === 0) {
    geometry.dispose();
    return [];
  }

  const key = `${source.key}:implicit-junction`;
  const branch: ClusterBranch = { ...source, key, primary: false };
  const solid: HostSolid = { ...self, key };
  const triangles = index.count / 3;
  const stats: ImplicitJunctionStats = {
    key,
    sourceKey: source.key,
    hostKey: source.hostKey,
    resolution: budget.resolution,
    trianglesGenerated: triangles,
    trianglesKept: triangles,
    exposedBoundaryEdges: 0,
  };
  geometry.userData.implicitJunction = true;
  geometry.userData.sourceKey = source.key;
  geometry.userData.hostKey = source.hostKey;
  return [{ branch, solid, geometry, stats }];
}
