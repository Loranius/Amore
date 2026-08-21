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

export const PORTAL_GROUND_CLUSTER_COUNT = 6;
export const PORTAL_GROUND_DECOR_CLEARANCE = 0.34;
export const PORTAL_BANNER_COUNT = 4;
export const PORTAL_VINE_COUNT = 3;
export const PORTAL_CRYSTAL_LAMP_COUNT = 4;
export const PORTAL_CRYSTAL_PLINTH_HEIGHT = 0.15;
export const PORTAL_CELESTIAL_ARC_COUNT = 3;
export const PORTAL_CELESTIAL_ARC_SEGMENTS = 48;
/** Ground, colonnade growth, crystal beacons and celestial linework. */
export const PORTAL_DECOR_DRAW_CALLS = 4;
/** Opaque decor geometry only; celestial arcs are line primitives. */
export const PORTAL_DECOR_TRIANGLES = 1_533;

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

const LAMP_ANGLES = [-1.08, 1.08, Math.PI - 0.9, Math.PI + 0.9] as const;
const GROUND_CLUSTER_ANGLES = [1.9, 2.42, 2.94, 3.46, 3.98, 4.5] as const;
const BANNER_WIDTH = 0.52;
const BANNER_HEIGHT = 1.08;

function safeDaisScale(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function transform(
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  rotationOrder: THREE.EulerOrder = 'XYZ',
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(
      rotation[0],
      rotation[1],
      rotation[2],
      rotationOrder,
    )),
    new THREE.Vector3(...scale),
  );
}

function tintGeometry(geometry: THREE.BufferGeometry, colour: string): THREE.BufferGeometry {
  if (geometry.getAttribute('color') !== undefined) return geometry;
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

/**
 * Six small accents tied to column bases instead of loose islands on the
 * open floor. They remain deterministic, but their architecture owns their
 * position so they still look intentional from the free camera.
 */
export function portalGroundClusterPlacements(
  seed: number,
  pillars: readonly PortalDecorPillar[],
  floorY: number,
): PortalGroundClusterPlacement[] {
  const random = mulberry32((seed ^ 0x53a91f2d) >>> 0);
  return selectPillars(pillars, GROUND_CLUSTER_ANGLES).map((pillar) => {
    const radius = Math.hypot(pillar.position[0], pillar.position[2]) || 1;
    const inwardX = -pillar.position[0] / radius;
    const inwardZ = -pillar.position[2] / radius;
    const tangentX = pillar.position[2] / radius;
    const tangentZ = -pillar.position[0] / radius;
    const baseClearance = pillar.scale[0] + 0.14 + random() * 0.12;
    const tangentOffset = (random() - 0.5) * 0.28;
    return {
      position: [
        pillar.position[0] + inwardX * baseClearance + tangentX * tangentOffset,
        floorY,
        pillar.position[2] + inwardZ * baseClearance + tangentZ * tangentOffset,
      ] as const,
      rotationY: Math.atan2(inwardX, inwardZ) + (random() - 0.5) * 0.34,
      scale: 0.52 + random() * 0.18,
    };
  });
}

/** Four architectural beacons, clearly outside the data-owned crystal zone. */
export function portalCrystalLampPlacements(
  seed: number,
  daisScale: number,
  floorY: number,
): PortalCrystalLampPlacement[] {
  const random = mulberry32((seed ^ 0x7c28d4b1) >>> 0);
  const radius = PORTAL_RELIC_OUTER_RADIUS * safeDaisScale(daisScale) + 4;
  return LAMP_ANGLES.map((baseAngle) => {
    const angle = baseAngle + (random() - 0.5) * 0.08;
    const localRadius = radius + (random() - 0.5) * 0.14;
    return {
      position: [
        Math.sin(angle) * localRadius,
        floorY + PORTAL_CRYSTAL_PLINTH_HEIGHT,
        Math.cos(angle) * localRadius,
      ] as const,
      rotationY: angle + random() * Math.PI,
      scale: 0.82 + random() * 0.1,
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
    const bodyHeight = 0.11 * lamp.scale;
    const tipHeight = 0.13 * lamp.scale;
    addPart(
      parts,
      new THREE.CylinderGeometry(0.055, 0.07, bodyHeight, 6, 1, false),
      '#ffffff',
      transform(
        [lamp.position[0], lamp.position[1] + bodyHeight * 0.5, lamp.position[2]],
        [lamp.scale, 1, lamp.scale],
        [0, lamp.rotationY, 0],
      ),
    );
    addPart(
      parts,
      new THREE.ConeGeometry(0.055, tipHeight, 6, 1, false),
      '#ffffff',
      transform(
        [
          lamp.position[0],
          lamp.position[1] + bodyHeight + tipHeight * 0.5,
          lamp.position[2],
        ],
        [lamp.scale, 1, lamp.scale],
        [0, lamp.rotationY, 0],
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

function buildMossPatchGeometry(random: () => number): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(1, 7);
  const position = geometry.getAttribute('position');
  for (let index = 1; index < position.count; index += 1) {
    const irregularity = 0.78 + random() * 0.28;
    position.setXY(
      index,
      position.getX(index) * irregularity,
      position.getY(index) * irregularity,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function buildGrassBladeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0,
    0.5, 0, 0,
    0, 1, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    0.5, 1,
  ], 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Moss, low-poly stones, grass and the four lamp plinths share vertex colours
 * and one material. Plants hug column bases; nothing reads as a loose carpet
 * dropped into the middle of the temple floor.
 */
export function buildPortalGroundDecorGeometry(
  seed: number,
  daisScale: number,
  floorY: number,
  pillars: readonly PortalDecorPillar[],
  palette: PortalGroundDecorPalette,
): THREE.BufferGeometry {
  const random = mulberry32((seed ^ 0x2ea117c9) >>> 0);
  const parts: THREE.BufferGeometry[] = [];

  for (const cluster of portalGroundClusterPlacements(seed, pillars, floorY)) {
    const [x, y, z] = cluster.position;
    for (let patch = 0; patch < 2; patch += 1) {
      const side = (patch === 0 ? -0.085 : 0.09) * cluster.scale;
      addPart(
        parts,
        buildMossPatchGeometry(random),
        palette.moss,
        transform(
          [
            x + Math.cos(cluster.rotationY) * side,
            y + 0.009 + patch * 0.002,
            z - Math.sin(cluster.rotationY) * side,
          ],
          [
            (0.24 + random() * 0.05) * cluster.scale,
            (0.14 + random() * 0.04) * cluster.scale,
            1,
          ],
          [-Math.PI / 2, cluster.rotationY + (random() - 0.5) * 0.32, 0],
          'YXZ',
        ),
      );
    }

    for (let rock = 0; rock < 2; rock += 1) {
      const angle = cluster.rotationY + (rock === 0 ? -0.72 : 1.18) + (random() - 0.5) * 0.36;
      const offset = (0.08 + random() * 0.12) * cluster.scale;
      const radius = (0.12 + random() * 0.07) * cluster.scale;
      const rockHeight = radius * (0.48 + random() * 0.16);
      addPart(
        parts,
        new THREE.IcosahedronGeometry(1, 0),
        rock === 0 ? palette.rock : palette.rockAccent,
        transform(
          [
            x + Math.sin(angle) * offset,
            y + rockHeight * 0.9,
            z + Math.cos(angle) * offset,
          ],
          [radius * (0.9 + random() * 0.34), rockHeight, radius],
          [random() * 0.3, random() * Math.PI, random() * 0.24],
        ),
      );
    }

    for (let blade = 0; blade < 5; blade += 1) {
      const angle = cluster.rotationY + (blade - 2) * 0.34 + (random() - 0.5) * 0.2;
      const distance = (0.06 + random() * 0.12) * cluster.scale;
      const height = (0.14 + random() * 0.1) * cluster.scale;
      const width = (0.025 + random() * 0.012) * cluster.scale;
      addPart(
        parts,
        buildGrassBladeGeometry(),
        blade % 2 === 0 ? palette.grass : palette.moss,
        transform(
          [
            x + Math.sin(angle) * distance,
            y + 0.006,
            z + Math.cos(angle) * distance,
          ],
          [width, height, 1],
          [0, angle, (random() - 0.5) * 0.24],
        ),
      );
    }
  }

  for (const lamp of portalCrystalLampPlacements(seed, daisScale, floorY)) {
    addPart(
      parts,
      new THREE.CylinderGeometry(0.22, 0.26, 0.07, 8, 1, false),
      palette.plinth,
      transform(
        [lamp.position[0], floorY + 0.035, lamp.position[2]],
        [lamp.scale, 1, lamp.scale],
        [0, lamp.rotationY, 0],
      ),
    );
    addPart(
      parts,
      new THREE.CylinderGeometry(0.14, 0.19, 0.08, 8, 1, false),
      palette.plinth,
      transform(
        [lamp.position[0], floorY + 0.11, lamp.position[2]],
        [lamp.scale, 1, lamp.scale],
        [0, lamp.rotationY + Math.PI / 8, 0],
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

function buildBanner(seed: number, colour: string): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(BANNER_WIDTH, BANNER_HEIGHT, 4, 7);
  geometry.translate(0, -BANNER_HEIGHT * 0.5, 0);
  const position = geometry.getAttribute('position');
  const phase = (seed % 997) * 0.017;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const down = THREE.MathUtils.clamp(-y / BANNER_HEIGHT, 0, 1);
    const depth = Math.sin((x / BANNER_WIDTH) * Math.PI * 2 + phase + down * 1.3)
      * THREE.MathUtils.lerp(0.009, 0.028, down);
    const taper = THREE.MathUtils.lerp(1, 0.64, THREE.MathUtils.smoothstep(down, 0.42, 1));
    const point = down > 0.98
      ? (1 - Math.min(1, Math.abs(x) / (BANNER_WIDTH * 0.5))) * 0.12
      : 0;
    position.setXYZ(index, x * taper, y - point, depth);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const base = new THREE.Color(colour);
  const top = base.clone().offsetHSL(0, -0.02, 0.055);
  const bottom = base.clone().offsetHSL(0, 0.02, -0.07);
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const down = THREE.MathUtils.clamp(-position.getY(index) / (BANNER_HEIGHT + 0.12), 0, 1);
    new THREE.Color().lerpColors(top, bottom, down).toArray(colours, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
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
  const radius = Math.hypot(pillar.position[0], pillar.position[2]) || 1;
  const inwardX = -pillar.position[0] / radius;
  const inwardZ = -pillar.position[2] / radius;
  const tangentX = pillar.position[2] / radius;
  const tangentZ = -pillar.position[0] / radius;
  const surface = pillarSurfacePosition(pillar, pillar.scale[0] * 1.025);
  const phase = random() * Math.PI * 2;
  const sway = 0.055 + random() * 0.025;
  for (let step = 0; step <= 7; step += 1) {
    const progress = step / 7;
    const lateral = Math.sin(phase + progress * Math.PI * 2.15) * sway;
    const depth = Math.sin(phase * 0.7 + progress * Math.PI * 1.6) * 0.015;
    points.push(new THREE.Vector3(
      surface[0] + tangentX * lateral + inwardX * depth,
      pillar.position[1] + height * (0.9 - progress * 0.72),
      surface[2] + tangentZ * lateral + inwardZ * depth,
    ));
  }
  // A hanging S-curve follows the inner face. The old double helix wrapped
  // around the whole shaft and exposed its low-poly tube from every angle.
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
      buildBanner(seed + index * 31, palette.banner),
      palette.banner,
      transform(
        [surface[0], pillar.position[1] + height * 0.87, surface[2]],
        [0.94 + random() * 0.08, 0.96 + random() * 0.05, 1],
        [0, pillar.rotationY + Math.PI, 0],
      ),
    );
  });

  portalVinePillars(pillars).forEach((pillar, vineIndex) => {
    const curve = vinePath(pillar, seed + vineIndex * 103);
    addPart(
      parts,
      new THREE.TubeGeometry(curve, 20, 0.011, 4, false),
      palette.vine,
      new THREE.Matrix4(),
    );

    for (let leaf = 0; leaf < 5; leaf += 1) {
      const progress = 0.2 + leaf * 0.14;
      const point = curve.getPoint(progress);
      const angle = Math.atan2(pillar.position[0], pillar.position[2])
        + Math.PI
        + (leaf % 2 === 0 ? -0.34 : 0.34);
      addPart(
        parts,
        new THREE.CircleGeometry(1, 5),
        leaf % 3 === 0 ? palette.vineAccent : palette.vine,
        transform(
          [point.x, point.y, point.z],
          [0.045 + random() * 0.015, 0.075 + random() * 0.022, 1],
          [0, angle, leaf % 2 === 0 ? -0.3 : 0.3],
        ),
      );
    }
  });

  return mergeParts(parts, 'colonnade decor');
}
