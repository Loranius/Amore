// ============================================================
// portalSceneDecor — presentation-only life around the crystal temple.
// ------------------------------------------------------------
// The relationship crystal and every data-owned child stay authoritative in
// src/engine. These stones, plants, banners and temple lights are scenery:
// deterministic per couple, bounded, and always outside the reliquary.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../mulberry32';
import { PORTAL_RELIC_OUTER_RADIUS } from './portalRelicPedestal';
import { PORTAL_PILLAR_ASPECT } from './portalColonnadeMesh';

export const PORTAL_GROUND_CLUSTER_COUNT = 8;
export const PORTAL_GROUND_DECOR_CLEARANCE = 0.34;
export const PORTAL_BANNER_COUNT = 4;
export const PORTAL_VINE_COUNT = 3;
export const PORTAL_CRYSTAL_LAMP_COUNT = 4;
export const PORTAL_CELESTIAL_ARC_COUNT = 3;
export const PORTAL_CELESTIAL_ARC_SEGMENTS = 48;
/** Ground, colonnade growth, crystal beacons and celestial linework. */
export const PORTAL_DECOR_DRAW_CALLS = 4;
/** Opaque decor geometry only; celestial arcs are line primitives. */
export const PORTAL_DECOR_TRIANGLES = 1_620;

export interface PortalGroundDecorPalette {
  rock: string;
  rockAccent: string;
  moss: string;
  grass: string;
  plinth: string;
}

export interface PortalColonnadeDecorPalette {
  banner: string;
  vine: string;
  vineAccent: string;
}

export interface PortalDecorPillar {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotationY: number;
}

export interface PortalGroundClusterPlacement {
  position: readonly [number, number, number];
  rotationY: number;
  scale: number;
}

export interface PortalCrystalLampPlacement {
  position: readonly [number, number, number];
  rotationY: number;
  scale: number;
}

const LAMP_ANGLES = [-1.02, 1.02, Math.PI - 0.82, Math.PI + 0.82] as const;
const PLINTH_HEIGHT = 0.46;

function safeDaisScale(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function transform(
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
}

function tintGeometry(geometry: THREE.BufferGeometry, colour: string): THREE.BufferGeometry {
  const value = new THREE.Color(colour);
  const count = geometry.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) value.toArray(colours, index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function addPart(
  parts: THREE.BufferGeometry[],
  geometry: THREE.BufferGeometry,
  colour: string,
  matrix: THREE.Matrix4,
): void {
  geometry.applyMatrix4(matrix);
  parts.push(tintGeometry(geometry, colour));
}

function mergeParts(parts: THREE.BufferGeometry[], label: string): THREE.BufferGeometry {
  const compatible = parts.map((geometry) => {
    if (geometry.index === null) return geometry;
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    return flat;
  });
  const merged = mergeGeometries(compatible, false);
  compatible.forEach((geometry) => geometry.dispose());
  if (merged === null) throw new Error(`Could not merge portal ${label} geometry.`);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Eight authored-looking islands instead of an even decorative ring. */
export function portalGroundClusterPlacements(
  seed: number,
  daisScale: number,
  floorY: number,
): PortalGroundClusterPlacement[] {
  const random = mulberry32((seed ^ 0x53a91f2d) >>> 0);
  const innerRadius = PORTAL_RELIC_OUTER_RADIUS * safeDaisScale(daisScale)
    + PORTAL_GROUND_DECOR_CLEARANCE;
  const placements: PortalGroundClusterPlacement[] = [];
  for (let index = 0; index < PORTAL_GROUND_CLUSTER_COUNT; index += 1) {
    // Half a step keeps the front emblem clear. Jitter breaks the machine-made
    // ring while the lower bound still proves every island is off the metal.
    const angle = ((index + 0.58) / PORTAL_GROUND_CLUSTER_COUNT) * Math.PI * 2
      + (random() - 0.5) * 0.24;
    const radius = innerRadius + 0.18 + random() * 0.92;
    placements.push({
      position: [Math.sin(angle) * radius, floorY, Math.cos(angle) * radius],
      rotationY: angle + (random() - 0.5) * 0.6,
      scale: 0.82 + random() * 0.42,
    });
  }
  return placements;
}

/** Four architectural beacons, clearly outside the data-owned crystal zone. */
export function portalCrystalLampPlacements(
  seed: number,
  daisScale: number,
  floorY: number,
): PortalCrystalLampPlacement[] {
  const random = mulberry32((seed ^ 0x7c28d4b1) >>> 0);
  const radius = PORTAL_RELIC_OUTER_RADIUS * safeDaisScale(daisScale) + 1.28;
  return LAMP_ANGLES.map((baseAngle) => {
    const angle = baseAngle + (random() - 0.5) * 0.1;
    const localRadius = radius + (random() - 0.5) * 0.18;
    return {
      position: [
        Math.sin(angle) * localRadius,
        floorY + PLINTH_HEIGHT,
        Math.cos(angle) * localRadius,
      ] as const,
      rotationY: angle + random() * Math.PI,
      scale: 0.9 + random() * 0.18,
    };
  });
}

/** One merged emissive mesh; the stone plinths already live in ground decor. */
export function buildPortalCrystalLampGeometry(
  seed: number,
  daisScale: number,
  floorY: number,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const lamp of portalCrystalLampPlacements(seed, daisScale, floorY)) {
    const height = 0.29 * lamp.scale;
    addPart(
      parts,
      new THREE.OctahedronGeometry(1, 0),
      '#ffffff',
      transform(
        [lamp.position[0], lamp.position[1] + height, lamp.position[2]],
        [0.16 * lamp.scale, height, 0.16 * lamp.scale],
        [0, lamp.rotationY, 0.1],
      ),
    );
  }
  return mergeParts(parts, 'crystal lamp');
}

export interface PortalHazeField {
  positions: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  count: number;
}

/** Large soft points mixed into the existing star draw call by the renderer. */
export function buildPortalHazeField(seed: number, count = 7): PortalHazeField {
  const safeCount = Math.max(0, Math.floor(count));
  const random = mulberry32((seed ^ 0xd5317a41) >>> 0);
  const positions = new Float32Array(safeCount * 3);
  const sizes = new Float32Array(safeCount);
  const alphas = new Float32Array(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    const azimuth = ((index + 0.35 + random() * 0.3) / Math.max(1, safeCount)) * Math.PI * 2;
    const elevation = 0.2 + random() * 0.55;
    const radius = 30 + random() * 3;
    const horizontal = Math.cos(elevation) * radius;
    positions[index * 3] = Math.sin(azimuth) * horizontal;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.cos(azimuth) * horizontal;
    sizes[index] = 86 + random() * 70;
    alphas[index] = 0.42 + random() * 0.5;
  }
  return { positions, sizes, alphas, count: safeCount };
}

/** Three incomplete great-circle-like arcs preserve the open upper sky. */
export function buildPortalCelestialArcGeometry(seed: number): THREE.BufferGeometry {
  const random = mulberry32((seed ^ 0x6af143e9) >>> 0);
  const positions: number[] = [];
  for (let arc = 0; arc < PORTAL_CELESTIAL_ARC_COUNT; arc += 1) {
    const yaw = random() * Math.PI * 2 + arc * 1.73;
    const radius = 27.5 + arc * 1.8 + random();
    const start = Math.PI * (0.13 + random() * 0.04);
    const end = Math.PI * (0.87 - random() * 0.04);
    const point = (progress: number): readonly [number, number, number] => {
      const angle = THREE.MathUtils.lerp(start, end, progress);
      const horizontal = Math.cos(angle) * radius;
      return [
        Math.sin(yaw) * horizontal,
        Math.sin(angle) * radius * 0.48,
        Math.cos(yaw) * horizontal,
      ];
    };
    for (let segment = 0; segment < PORTAL_CELESTIAL_ARC_SEGMENTS; segment += 1) {
      positions.push(
        ...point(segment / PORTAL_CELESTIAL_ARC_SEGMENTS),
        ...point((segment + 1) / PORTAL_CELESTIAL_ARC_SEGMENTS),
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Moss, low-poly stones, grass and the four lamp plinths share vertex colours
 * and one material. The middle ground therefore gains depth for one draw call.
 */
export function buildPortalGroundDecorGeometry(
  seed: number,
  daisScale: number,
  floorY: number,
  palette: PortalGroundDecorPalette,
): THREE.BufferGeometry {
  const random = mulberry32((seed ^ 0x2ea117c9) >>> 0);
  const parts: THREE.BufferGeometry[] = [];

  for (const cluster of portalGroundClusterPlacements(seed, daisScale, floorY)) {
    const [x, y, z] = cluster.position;
    addPart(
      parts,
      new THREE.CircleGeometry(1, 12),
      palette.moss,
      transform(
        [x, y + 0.024, z],
        [0.48 * cluster.scale, 0.34 * cluster.scale, 1],
        [-Math.PI / 2, cluster.rotationY, 0],
      ),
    );

    for (let rock = 0; rock < 2; rock += 1) {
      const offset = (rock === 0 ? -0.16 : 0.19) * cluster.scale;
      const radius = (0.15 + random() * 0.1) * cluster.scale;
      addPart(
        parts,
        new THREE.IcosahedronGeometry(1, 0),
        rock === 0 ? palette.rock : palette.rockAccent,
        transform(
          [
            x + Math.cos(cluster.rotationY) * offset,
            y + radius * 0.62,
            z - Math.sin(cluster.rotationY) * offset,
          ],
          [radius * (0.9 + random() * 0.45), radius * 0.62, radius],
          [random() * 0.45, random() * Math.PI, random() * 0.35],
        ),
      );
    }

    for (let blade = 0; blade < 4; blade += 1) {
      const side = (blade - 1.5) * 0.105 * cluster.scale;
      const height = (0.19 + random() * 0.16) * cluster.scale;
      addPart(
        parts,
        new THREE.ConeGeometry(0.035, 1, 3, 1, false),
        blade % 2 === 0 ? palette.grass : palette.moss,
        transform(
          [
            x + Math.cos(cluster.rotationY) * side,
            y + height * 0.5,
            z - Math.sin(cluster.rotationY) * side,
          ],
          [1, height, 1],
          [0.08 + random() * 0.13, cluster.rotationY + random() * 0.7, 0.08],
        ),
      );
    }
  }

  for (const lamp of portalCrystalLampPlacements(seed, daisScale, floorY)) {
    addPart(
      parts,
      new THREE.CylinderGeometry(0.28, 0.36, PLINTH_HEIGHT, 8, 1, false),
      palette.plinth,
      transform(
        [lamp.position[0], floorY + PLINTH_HEIGHT * 0.5, lamp.position[2]],
        [lamp.scale, 1, lamp.scale],
        [0, lamp.rotationY, 0],
      ),
    );
  }

  return mergeParts(parts, 'ground decor');
}

function shortestAngle(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

function selectPillars(
  pillars: readonly PortalDecorPillar[],
  targets: readonly number[],
): PortalDecorPillar[] {
  const available = [...pillars];
  const selected: PortalDecorPillar[] = [];
  for (const target of targets) {
    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < available.length; index += 1) {
      const candidate = available[index]!;
      const angle = Math.atan2(candidate.position[0], candidate.position[2]);
      const candidateDistance = shortestAngle(angle, target);
      if (candidateDistance < distance) {
        nearest = index;
        distance = candidateDistance;
      }
    }
    if (nearest >= 0) selected.push(...available.splice(nearest, 1));
  }
  return selected;
}

/** Side and rear banners frame the default portrait view without forming a wall. */
export function portalBannerPillars(
  pillars: readonly PortalDecorPillar[],
): PortalDecorPillar[] {
  return selectPillars(pillars, [2.08, 2.76, 3.58, 4.24]);
}

/** Vines deliberately use a different rhythm so the arcade stops looking cloned. */
export function portalVinePillars(
  pillars: readonly PortalDecorPillar[],
): PortalDecorPillar[] {
  return selectPillars(pillars, [1.76, 3.16, 4.58]);
}

function buildBanner(seed: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1.8, 4, 6);
  geometry.translate(0, -0.9, 0);
  const position = geometry.getAttribute('position');
  const phase = (seed % 997) * 0.017;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const depth = Math.sin((x + 0.5) * Math.PI * 2 + phase + y * 0.8) * 0.055;
    // A narrower lower edge keeps the cloth heraldic rather than rectangular.
    const taper = THREE.MathUtils.lerp(0.72, 1, THREE.MathUtils.clamp((y + 1.8) / 0.6, 0, 1));
    position.setXYZ(index, x * taper, y, depth);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function pillarSurfacePosition(
  pillar: PortalDecorPillar,
  inset: number,
): readonly [number, number, number] {
  const radius = Math.hypot(pillar.position[0], pillar.position[2]) || 1;
  const factor = 1 - inset / radius;
  return [pillar.position[0] * factor, pillar.position[1], pillar.position[2] * factor];
}

function vinePath(pillar: PortalDecorPillar, seed: number): THREE.CatmullRomCurve3 {
  const random = mulberry32((seed ^ 0xb31849e7) >>> 0);
  const points: THREE.Vector3[] = [];
  const height = pillar.scale[1] * PORTAL_PILLAR_ASPECT;
  const baseAngle = Math.atan2(pillar.position[0], pillar.position[2]);
  const start = random() * Math.PI * 2;
  for (let step = 0; step <= 9; step += 1) {
    const progress = step / 9;
    const wrap = start + progress * Math.PI * (2.05 + random() * 0.18);
    const reach = pillar.scale[0] * 1.015;
    points.push(new THREE.Vector3(
      pillar.position[0] + Math.sin(baseAngle + wrap) * reach,
      pillar.position[1] + 0.12 + height * progress * 0.91,
      pillar.position[2] + Math.cos(baseAngle + wrap) * reach,
    ));
  }
  // Centripetal interpolation cannot overshoot below the floor between the
  // first control points, unlike the uniform Catmull-Rom variant.
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

/**
 * Cloth and vegetation share an opaque vertex-coloured material and one mesh.
 * Their forms stay sparse: four banners and three climbing vines across an
 * eighteen-bay ring are accents, not a new wall around the artifact.
 */
export function buildPortalColonnadeDecorGeometry(
  seed: number,
  pillars: readonly PortalDecorPillar[],
  palette: PortalColonnadeDecorPalette,
): THREE.BufferGeometry {
  const random = mulberry32((seed ^ 0x9c47f1a3) >>> 0);
  const parts: THREE.BufferGeometry[] = [];

  portalBannerPillars(pillars).forEach((pillar, index) => {
    const surface = pillarSurfacePosition(pillar, pillar.scale[0] * 1.04);
    const height = pillar.scale[1] * PORTAL_PILLAR_ASPECT;
    addPart(
      parts,
      buildBanner(seed + index * 31),
      palette.banner,
      transform(
        [surface[0], pillar.position[1] + height * 0.91, surface[2]],
        [0.78 + random() * 0.1, 0.92 + random() * 0.1, 1],
        [0, pillar.rotationY + Math.PI, 0],
      ),
    );
  });

  portalVinePillars(pillars).forEach((pillar, vineIndex) => {
    const curve = vinePath(pillar, seed + vineIndex * 103);
    addPart(
      parts,
      new THREE.TubeGeometry(curve, 24, 0.026, 4, false),
      palette.vine,
      new THREE.Matrix4(),
    );

    for (let leaf = 0; leaf < 7; leaf += 1) {
      const progress = 0.16 + leaf * 0.115;
      const point = curve.getPoint(progress);
      const angle = Math.atan2(pillar.position[0], pillar.position[2])
        + Math.PI
        + (leaf % 2 === 0 ? -0.42 : 0.42);
      addPart(
        parts,
        new THREE.CircleGeometry(1, 4),
        leaf % 3 === 0 ? palette.vineAccent : palette.vine,
        transform(
          [point.x, point.y, point.z],
          [0.095 + random() * 0.035, 0.155 + random() * 0.045, 1],
          [0, angle, leaf % 2 === 0 ? -0.36 : 0.36],
        ),
      );
    }
  });

  return mergeParts(parts, 'colonnade decor');
}
