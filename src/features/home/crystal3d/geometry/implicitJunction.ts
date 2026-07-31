// ============================================================
// implicitJunction — bounded implicit fusion for visible basal junctions.
// ------------------------------------------------------------
// Uses Three.js' MarchingCubes implementation once during publication to
// extract a small smooth-union collar around a child/host contact. The full
// crystal remains faceted lathe geometry; only the seam receives an implicit
// bridge, keeping the mobile cost bounded and preserving deterministic bodies.
// ============================================================
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ClusterBranch } from '../crystalCluster';
import { breatheMargin, isInsideHost, type HostSolid } from './hostBody';
import { triangleInside } from './junctionTrim';
import type { LodLevel } from './lod';

interface FusionBudget {
  readonly resolution: number;
  readonly maxPolyCount: number;
  readonly maxJunctions: number;
  readonly minRadius: number;
}

const FUSION_BUDGET: Record<LodLevel, FusionBudget> = {
  low: { resolution: 10, maxPolyCount: 900, maxJunctions: 4, minRadius: 0.045 },
  medium: { resolution: 12, maxPolyCount: 1_400, maxJunctions: 6, minRadius: 0.04 },
  high: { resolution: 14, maxPolyCount: 2_000, maxJunctions: 8, minRadius: 0.035 },
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

export interface ImplicitJunctionBody {
  readonly branch: ClusterBranch;
  readonly solid: HostSolid;
  readonly geometry: THREE.BufferGeometry;
  readonly stats: ImplicitJunctionStats;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function smoothMin(left: number, right: number, radius: number): number {
  const h = Math.max(radius - Math.abs(left - right), 0) / radius;
  return Math.min(left, right) - h * h * radius * 0.25;
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

function implicitField(x: number, y: number, z: number, hostX: number, hostZ: number): number {
  const base = ellipsoidSdf(x, y, z, 0, -0.08, 0, 0.82, 0.54, 0.82);
  const neck = ellipsoidSdf(x, y, z, 0, 0.38, 0, 0.56, 0.72, 0.56);
  const host = ellipsoidSdf(x, y, z, hostX, -0.34, hostZ, 0.76, 0.46, 0.76);
  return -smoothMin(smoothMin(base, neck, 0.22), host, 0.25);
}

function extractMarchingGeometry(
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
        effect.setCell(x, y, z, implicitField(nx, ny, nz, hostX, hostZ));
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

  const radialScale = radius * 1.3;
  const axialScale = radius * 0.92;
  const axialOffset = radius * 0.08;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = source.getX(i) * radialScale;
    positions[i * 3 + 1] = source.getY(i) * axialScale + axialOffset;
    positions[i * 3 + 2] = source.getZ(i) * radialScale;
  }

  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const geometry = mergeVertices(raw, Math.max(1e-5, radius * 1e-4));
  raw.dispose();
  effect.geometry.dispose();
  material.dispose();

  if (geometry.getIndex() === null) {
    geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, index) => index));
  }
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = clamp(position.getX(i) / (radialScale * 2) + 0.5, 0, 1);
    uv[i * 2 + 1] = clamp((position.getY(i) + axialScale) / (axialScale * 2), 0, 1);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function worldVertices(geometry: THREE.BufferGeometry, solid: HostSolid): THREE.Vector3[] {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const quaternion = solid.inverseQuaternion.clone().invert();
  return Array.from({ length: position.count }, (_, index) =>
    new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index))
      .applyQuaternion(quaternion)
      .add(solid.position),
  );
}

function trimInsideBodies(
  geometry: THREE.BufferGeometry,
  self: HostSolid,
  host: HostSolid,
): { generated: number; kept: number } {
  const index = geometry.getIndex();
  if (index === null) return { generated: 0, kept: 0 };
  const world = worldVertices(geometry, self);
  const generated = index.count / 3;
  const kept: number[] = [];
  const selfMargin = Math.min(breatheMargin(self, self) * 0.35, self.profile.r * 0.12);
  const hostMargin = Math.min(breatheMargin(self, host) * 0.35, self.profile.r * 0.16);

  for (let triangle = 0; triangle < generated; triangle += 1) {
    const a = index.getX(triangle * 3);
    const b = index.getX(triangle * 3 + 1);
    const c = index.getX(triangle * 3 + 2);
    const hidden = triangleInside(world[a]!, world[b]!, world[c]!, self, selfMargin)
      || triangleInside(world[a]!, world[b]!, world[c]!, host, hostMargin);
    if (!hidden) kept.push(a, b, c);
  }

  geometry.setIndex(kept);
  geometry.computeVertexNormals();
  return { generated, kept: kept.length / 3 };
}

function exposedBoundaryEdges(
  geometry: THREE.BufferGeometry,
  self: HostSolid,
  host: HostSolid,
): number {
  const index = geometry.getIndex();
  if (index === null || index.count === 0) return 0;
  const world = worldVertices(geometry, self);
  const edges = new Map<string, { a: number; b: number; count: number }>();

  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge]!;
      const b = triangle[(edge + 1) % 3]!;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const current = edges.get(key);
      if (current === undefined) edges.set(key, { a, b, count: 1 });
      else current.count += 1;
    }
  }

  const hidden = (vertex: number): boolean =>
    isInsideHost(world[vertex]!, self, 0) || isInsideHost(world[vertex]!, host, 0);
  let exposed = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1 && (!hidden(edge.a) || !hidden(edge.b))) exposed += 1;
  }
  return exposed;
}

function syntheticBranch(source: ClusterBranch): ClusterBranch {
  return {
    ...source,
    key: `${source.key}:implicit-junction`,
    primary: false,
  };
}

function syntheticSolid(source: HostSolid, key: string): HostSolid {
  return { ...source, key };
}

export function selectImplicitJunctionBranches(
  branches: readonly ClusterBranch[],
  solids: ReadonlyMap<string, HostSolid>,
  lod: LodLevel,
): ClusterBranch[] {
  const budget = FUSION_BUDGET[lod];
  const byKey = new Map(branches.map((branch) => [branch.key, branch] as const));
  return branches
    .filter((branch) => {
      if (branch.hostKey === null || branch.role === 'micro' || branch.archetype === 'matrix') return false;
      const self = solids.get(branch.key);
      const host = solids.get(branch.hostKey);
      const hostBranch = byKey.get(branch.hostKey);
      return self !== undefined
        && host !== undefined
        && hostBranch?.primary === true
        && self.profile.r >= budget.minRadius;
    })
    .sort((left, right) => {
      const a = solids.get(left.key)!;
      const b = solids.get(right.key)!;
      const aScore = a.profile.r * a.profile.r * a.profile.h;
      const bScore = b.profile.r * b.profile.r * b.profile.h;
      return bScore - aScore || left.key.localeCompare(right.key);
    })
    .slice(0, budget.maxJunctions);
}

export function buildImplicitJunctionBody(
  source: ClusterBranch,
  self: HostSolid,
  host: HostSolid,
  lod: LodLevel,
): ImplicitJunctionBody | null {
  const budget = FUSION_BUDGET[lod];
  const towardHost = host.position.clone().sub(self.position).applyQuaternion(self.inverseQuaternion);
  const horizontal = Math.hypot(towardHost.x, towardHost.z);
  const hostX = horizontal > 1e-8 ? clamp((towardHost.x / horizontal) * 0.28, -0.28, 0.28) : 0;
  const hostZ = horizontal > 1e-8 ? clamp((towardHost.z / horizontal) * 0.28, -0.28, 0.28) : 0;
  const radius = Math.max(budget.minRadius, self.profile.r);
  const geometry = extractMarchingGeometry(
    budget.resolution,
    budget.maxPolyCount,
    radius,
    hostX,
    hostZ,
  );
  if (geometry === null) return null;

  const trim = trimInsideBodies(geometry, self, host);
  const exposed = exposedBoundaryEdges(geometry, self, host);
  if (trim.kept === 0 || exposed > 0) {
    geometry.dispose();
    return null;
  }

  const branch = syntheticBranch(source);
  const solid = syntheticSolid(self, branch.key);
  geometry.userData.implicitJunction = true;
  geometry.userData.sourceKey = source.key;
  geometry.userData.hostKey = source.hostKey;

  return {
    branch,
    solid,
    geometry,
    stats: {
      key: branch.key,
      sourceKey: source.key,
      hostKey: source.hostKey!,
      resolution: budget.resolution,
      trianglesGenerated: trim.generated,
      trianglesKept: trim.kept,
      exposedBoundaryEdges: exposed,
    },
  };
}

export function buildImplicitJunctionBodies(
  branches: readonly ClusterBranch[],
  solids: ReadonlyMap<string, HostSolid>,
  lod: LodLevel,
): ImplicitJunctionBody[] {
  return selectImplicitJunctionBranches(branches, solids, lod).flatMap((branch) => {
    const self = solids.get(branch.key);
    const host = branch.hostKey === null ? undefined : solids.get(branch.hostKey);
    if (self === undefined || host === undefined) return [];
    const body = buildImplicitJunctionBody(branch, self, host, lod);
    return body === null ? [] : [body];
  });
}
