// ============================================================
// portalRelicPedestal — metal reliquary under the crystal colony.
// ------------------------------------------------------------
// The relationship crystal is authoritative engine output; this pedestal is
// presentation only. It therefore lives beside PortalEnvironment and never
// feeds geometry, growth, placement, or material decisions back into the
// deterministic engine.
//
// The three exported geometries map to three optical roles and three draw
// calls: bronze body, dark engraving, violet glass. Keeping each role merged
// gives the reference its layered construction without turning every ring and
// rune into an individual mesh on mobile.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Flat setting that carries the quartz vein and every ground-rooted crystal. */
export const PORTAL_RELIC_TOP_RADIUS = 1.3;
/** Furthest metal edge, before the scene's artifact-dependent XZ scale. */
export const PORTAL_RELIC_OUTER_RADIUS = 1.76;
/** Full model depth. The surrounding floor hides the lowest foundation tier. */
export const PORTAL_RELIC_DEPTH = 0.55;
/** Centre of the luminous side band, measured down from the crystal plane. */
export const PORTAL_RELIC_GLOW_Y = -0.205;

const RADIAL_SEGMENTS = 64;
const RING_SEGMENTS = 48;

const BODY_PROFILE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1.05, 0],
  [1.1, -0.012],
  [1.15, -0.035],
  [1.29, -0.035],
  [1.34, -0.065],
  [1.34, -0.095],
  [1.45, -0.095],
  [1.45, -0.14],
  [1.56, -0.14],
  [1.6, -0.176],
  [1.6, -0.234],
  [1.68, -0.234],
  [1.72, -0.274],
  [1.72, -0.382],
  [1.76, -0.422],
  [1.76, -0.49],
  [1.7, -PORTAL_RELIC_DEPTH],
  [0, -PORTAL_RELIC_DEPTH],
];

function horizontalTorus(radius: number, tube: number, y: number): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(radius, tube, 6, RING_SEGMENTS);
  geometry.rotateX(Math.PI * 0.5);
  geometry.translate(0, y, 0);
  return geometry;
}

function box(
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(position[0], position[1], position[2]);
  return geometry;
}

function merge(parts: readonly THREE.BufferGeometry[], label: string): THREE.BufferGeometry {
  // BufferGeometryUtils requires every input to agree on indexedness. Flatten
  // here once; the resulting buffers stay compact enough for the scene budget
  // and preserve the authored normals of the curved metal profile.
  const compatible = parts.map((geometry) => {
    if (geometry.index === null) return geometry;
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    return flat;
  });
  const merged = mergeGeometries(compatible, false);
  compatible.forEach((geometry) => geometry.dispose());
  if (merged === null) throw new Error(`Could not merge portal relic ${label} geometry.`);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** One continuous bronze shell plus its raised rims. */
export function buildPortalRelicBodyGeometry(): THREE.BufferGeometry {
  // LatheGeometry derives winding from profile order. Walking from the top
  // centre towards the outer skirt points the entire shell inward: the top is
  // back-face culled from above and the temple tiles show through it. Traverse
  // the closed section from the bottom centre back up instead, so the load-
  // bearing disc faces +Y and every skirt tier faces away from the axis.
  const profile = [...BODY_PROFILE]
    .reverse()
    .map(([radius, y]) => new THREE.Vector2(radius, y));
  const body = new THREE.LatheGeometry(profile, RADIAL_SEGMENTS);
  const parts: THREE.BufferGeometry[] = [
    body,
    horizontalTorus(1.305, 0.018, -0.032),
    horizontalTorus(1.69, 0.02, -0.276),
  ];
  return merge(parts, 'body');
}

function topRuneGeometry(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const count = 20;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = 1.215;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    // Two short strokes form an angular mineral glyph. Both live in the same
    // merged buffer, so the full inscription remains one draw call.
    parts.push(
      box([0.07, 0.009, 0.014], [x, -0.026, z], [0, angle - 0.42, 0]),
      box([0.07, 0.009, 0.014], [x, -0.026, z], [0, angle + 0.42, 0]),
    );
  }
  return parts;
}

function sideRuneGeometry(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const count = 14;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = PORTAL_RELIC_OUTER_RADIUS + 0.006;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    parts.push(
      box([0.075, 0.012, 0.012], [x, -0.327, z], [0, angle, 0.68]),
      box([0.075, 0.012, 0.012], [x, -0.327, z], [0, angle, -0.68]),
    );
  }
  return parts;
}

/** Recess-darkened rings and inscriptions, merged into one optical layer. */
export function buildPortalRelicEngravingGeometry(): THREE.BufferGeometry {
  return merge([
    horizontalTorus(1.345, 0.011, -0.066),
    horizontalTorus(1.505, 0.01, -0.139),
    horizontalTorus(1.708, 0.01, -0.377),
    ...topRuneGeometry(),
    ...sideRuneGeometry(),
  ], 'engraving');
}

/** Violet glass band and top seal share one emissive layer. */
export function buildPortalRelicGlowGeometry(): THREE.BufferGeometry {
  const band = new THREE.CylinderGeometry(1.607, 1.607, 0.046, RADIAL_SEGMENTS, 1, true);
  band.translate(0, PORTAL_RELIC_GLOW_Y, 0);

  return merge([
    band,
    horizontalTorus(1.08, 0.014, 0.012),
  ], 'glow');
}

/**
 * Tiny deterministic roughness texture for a brushed-alloy response.
 *
 * A PBR metal without an environment or roughness variation reads as painted
 * plastic. This 64² map adds circumferential brushing at negligible memory
 * cost and does not require a network-loaded asset.
 */
function brushedGrain(x: number, y: number): number {
  return Math.sin(y * 1.71 + x * 0.13) * 17
    + Math.sin(y * 0.37 - x * 0.29) * 9
    + ((x * 17 + y * 31) % 11) - 5;
}

function finishBrushedTexture(texture: THREE.DataTexture): THREE.DataTexture {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.needsUpdate = true;
  return texture;
}

export function buildPortalBrushedMetalTexture(): THREE.DataTexture {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = Math.max(150, Math.min(238, Math.round(196 + brushedGrain(x, y))));
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return finishBrushedTexture(new THREE.DataTexture(data, width, height, THREE.RGBAFormat));
}

/** Tangent-space companion to the roughness grain: fine grooves, no new asset. */
export function buildPortalBrushedMetalNormalTexture(): THREE.DataTexture {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = brushedGrain((x + width - 1) % width, y);
      const right = brushedGrain((x + 1) % width, y);
      const down = brushedGrain(x, (y + height - 1) % height);
      const up = brushedGrain(x, (y + 1) % height);
      const offset = (y * width + x) * 4;
      data[offset] = Math.max(0, Math.min(255, Math.round(128 + (left - right) * 1.4)));
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(128 + (down - up) * 1.4)));
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }
  return finishBrushedTexture(new THREE.DataTexture(data, width, height, THREE.RGBAFormat));
}
