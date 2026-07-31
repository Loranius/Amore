import type { BufferAttribute, MeshPhysicalMaterial } from 'three';
import type {
  ReefColonyMorphotype,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import type {
  ReefBatchRuntimeRange,
  ReefRenderableBatch,
  ReefThreeSceneState,
} from './reefThreeAdapter';

export const REEF_MATERIAL_PRESENTATION_VERSION = 'reef-material-v1';
export const REEF_MATERIAL_PASS = 'phase-11-material-pass';

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface ReefMaterialPresentationProfile {
  readonly rootColor: Rgb;
  readonly bodyColor: Rgb;
  readonly tipColor: Rgb;
  readonly edgeColor: Rgb;
  readonly roughness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly sheen: number;
  readonly sheenRoughness: number;
  readonly sheenColor: Rgb;
  readonly transmission: number;
  readonly thickness: number;
  readonly ior: number;
}

const rgb = (hex: number): Rgb => ({
  r: ((hex >> 16) & 0xff) / 255,
  g: ((hex >> 8) & 0xff) / 255,
  b: (hex & 0xff) / 255,
});

/**
 * A deliberately separated marine palette. Hard corals stay warm and mineral,
 * while tissue morphotypes move into lavender, rose and blue-violet ranges.
 */
export const REEF_MATERIAL_PROFILES: Readonly<
  Record<ReefColonyMorphotype, ReefMaterialPresentationProfile>
> = Object.freeze({
  branching: {
    rootColor: rgb(0xa85f58),
    bodyColor: rgb(0xe68f7f),
    tipColor: rgb(0xffcfb8),
    edgeColor: rgb(0xf6b19d),
    roughness: 0.58,
    clearcoat: 0.14,
    clearcoatRoughness: 0.48,
    sheen: 0.12,
    sheenRoughness: 0.62,
    sheenColor: rgb(0xffd8cc),
    transmission: 0,
    thickness: 0.13,
    ior: 1.39,
  },
  massive: {
    rootColor: rgb(0x8f6749),
    bodyColor: rgb(0xd59a62),
    tipColor: rgb(0xf5c98f),
    edgeColor: rgb(0xe8b777),
    roughness: 0.72,
    clearcoat: 0.08,
    clearcoatRoughness: 0.68,
    sheen: 0.06,
    sheenRoughness: 0.76,
    sheenColor: rgb(0xffd9a4),
    transmission: 0,
    thickness: 0.22,
    ior: 1.4,
  },
  plating: {
    rootColor: rgb(0x728b68),
    bodyColor: rgb(0xb7d296),
    tipColor: rgb(0xebefb7),
    edgeColor: rgb(0xd9e8a4),
    roughness: 0.52,
    clearcoat: 0.17,
    clearcoatRoughness: 0.42,
    sheen: 0.11,
    sheenRoughness: 0.58,
    sheenColor: rgb(0xf5f4c9),
    transmission: 0,
    thickness: 0.11,
    ior: 1.38,
  },
  encrusting: {
    rootColor: rgb(0x824d63),
    bodyColor: rgb(0xc77991),
    tipColor: rgb(0xf1a7b4),
    edgeColor: rgb(0xe495a7),
    roughness: 0.67,
    clearcoat: 0.09,
    clearcoatRoughness: 0.65,
    sheen: 0.12,
    sheenRoughness: 0.7,
    sheenColor: rgb(0xf6bcc8),
    transmission: 0,
    thickness: 0.09,
    ior: 1.39,
  },
  'soft-coral': {
    rootColor: rgb(0x654b98),
    bodyColor: rgb(0xa675d0),
    tipColor: rgb(0xdab0ee),
    edgeColor: rgb(0xc897e5),
    roughness: 0.42,
    clearcoat: 0.2,
    clearcoatRoughness: 0.34,
    sheen: 0.42,
    sheenRoughness: 0.4,
    sheenColor: rgb(0xefcfff),
    transmission: 0,
    thickness: 0.27,
    ior: 1.36,
  },
  'sea-fan': {
    rootColor: rgb(0x414f8f),
    bodyColor: rgb(0x667dc2),
    tipColor: rgb(0x9fcce7),
    edgeColor: rgb(0x8db5df),
    roughness: 0.48,
    clearcoat: 0.16,
    clearcoatRoughness: 0.4,
    sheen: 0.34,
    sheenRoughness: 0.46,
    sheenColor: rgb(0xc4e7f7),
    transmission: 0,
    thickness: 0.17,
    ior: 1.37,
  },
});

export const REEF_FOUNDATION_MATERIAL_PROFILE = Object.freeze({
  topColor: rgb(0xc8ba93),
  sideColor: rgb(0x91856f),
  bottomColor: rgb(0x596568),
  roughness: 0.87,
  clearcoat: 0.025,
  clearcoatRoughness: 0.86,
});

const EPSILON = 1e-6;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  const t = clamp01(amount);
  return {
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t,
  };
}

function multiply(color: Rgb, amount: number): Rgb {
  return {
    r: clamp01(color.r * amount),
    g: clamp01(color.g * amount),
    b: clamp01(color.b * amount),
  };
}

function mutableArray(attribute: BufferAttribute): Float32Array {
  return attribute.array as Float32Array;
}

function dot(left: ReefLayoutVec3, right: ReefLayoutVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableUnit(value: string): number {
  return stableHash(value) / 0xffffffff;
}

function setColor(target: Float32Array, offset: number, color: Rgb): void {
  target[offset] = clamp01(color.r);
  target[offset + 1] = clamp01(color.g);
  target[offset + 2] = clamp01(color.b);
}

function configureMaterial(
  material: MeshPhysicalMaterial,
  profile: ReefMaterialPresentationProfile,
): void {
  material.color.setRGB(1, 1, 1);
  material.roughness = profile.roughness;
  material.metalness = 0;
  material.clearcoat = profile.clearcoat;
  material.clearcoatRoughness = profile.clearcoatRoughness;
  material.sheen = profile.sheen;
  material.sheenRoughness = profile.sheenRoughness;
  material.sheenColor.setRGB(
    profile.sheenColor.r,
    profile.sheenColor.g,
    profile.sheenColor.b,
  );
  material.transmission = profile.transmission;
  material.thickness = profile.thickness;
  material.ior = profile.ior;
  material.opacity = 1;
  material.transparent = false;
  material.vertexColors = true;
  material.needsUpdate = true;
}

function presentFoundation(scene: ReefThreeSceneState): void {
  const geometry = scene.foundation.geometry;
  const positionAttribute = geometry.getAttribute('position') as BufferAttribute;
  const normalAttribute = geometry.getAttribute('normal') as BufferAttribute;
  const colorAttribute = geometry.getAttribute('color') as BufferAttribute;
  const positions = mutableArray(positionAttribute);
  const normals = mutableArray(normalAttribute);
  const colors = mutableArray(colorAttribute);

  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (let offset = 1; offset < positions.length; offset += 3) {
    minimumY = Math.min(minimumY, positions[offset] ?? 0);
    maximumY = Math.max(maximumY, positions[offset] ?? 0);
  }
  const height = Math.max(EPSILON, maximumY - minimumY);

  for (let offset = 0; offset < positions.length; offset += 3) {
    const normalY = normals[offset + 1] ?? 0;
    const heightT = clamp01(((positions[offset + 1] ?? minimumY) - minimumY) / height);
    const topness = smoothstep(0.18, 0.88, normalY) * smoothstep(0.22, 0.72, heightT);
    const bottomness = smoothstep(0.1, 0.82, -normalY) * (1 - smoothstep(0.2, 0.58, heightT));
    const grain = 0.94 + 0.06 * Math.sin(
      (positions[offset] ?? 0) * 3.7 + (positions[offset + 2] ?? 0) * 2.9,
    );
    let color = mix(
      REEF_FOUNDATION_MATERIAL_PROFILE.sideColor,
      REEF_FOUNDATION_MATERIAL_PROFILE.topColor,
      topness,
    );
    color = mix(color, REEF_FOUNDATION_MATERIAL_PROFILE.bottomColor, bottomness);
    setColor(colors, offset, multiply(color, grain));
  }

  colorAttribute.needsUpdate = true;
  geometry.userData.reefMaterialPresentationVersion = REEF_MATERIAL_PRESENTATION_VERSION;
  geometry.userData.reefMaterialPass = REEF_MATERIAL_PASS;

  const material = scene.foundation.material;
  material.color.setRGB(1, 1, 1);
  material.roughness = REEF_FOUNDATION_MATERIAL_PROFILE.roughness;
  material.metalness = 0;
  material.clearcoat = REEF_FOUNDATION_MATERIAL_PROFILE.clearcoat;
  material.clearcoatRoughness = REEF_FOUNDATION_MATERIAL_PROFILE.clearcoatRoughness;
  material.sheen = 0.03;
  material.sheenRoughness = 0.8;
  material.sheenColor.setRGB(0.88, 0.84, 0.72);
  material.transmission = 0;
  material.thickness = 0.05;
  material.opacity = 1;
  material.transparent = false;
  material.vertexColors = true;
  material.needsUpdate = true;
}

interface RangeMaterialMetrics {
  readonly maximumAxialDistance: number;
  readonly maximumRadialDistance: number;
}

function measureRange(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
): RangeMaterialMetrics {
  let maximumAxialDistance = EPSILON;
  let maximumRadialDistance = EPSILON;
  const { motion, range } = runtime;

  for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
    const offset = index * 3;
    const relative = {
      x: (batch.basePositions[offset] ?? 0) - motion.pivot.x,
      y: (batch.basePositions[offset + 1] ?? 0) - motion.pivot.y,
      z: (batch.basePositions[offset + 2] ?? 0) - motion.pivot.z,
    };
    const axial = dot(relative, motion.axis);
    const radialX = relative.x - motion.axis.x * axial;
    const radialY = relative.y - motion.axis.y * axial;
    const radialZ = relative.z - motion.axis.z * axial;
    maximumAxialDistance = Math.max(maximumAxialDistance, Math.max(0, axial));
    maximumRadialDistance = Math.max(
      maximumRadialDistance,
      Math.hypot(radialX, radialY, radialZ),
    );
  }

  return { maximumAxialDistance, maximumRadialDistance };
}

function colorRange(batch: ReefRenderableBatch, runtime: ReefBatchRuntimeRange): void {
  const profile = REEF_MATERIAL_PROFILES[runtime.range.morphotype];
  const metrics = measureRange(batch, runtime);
  const variation = 0.9 + stableUnit(runtime.range.id) * 0.18;
  const accentPhase = stableUnit(`${runtime.range.id}:accent`) * Math.PI * 2;

  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    const relative = {
      x: (batch.basePositions[offset] ?? 0) - runtime.motion.pivot.x,
      y: (batch.basePositions[offset + 1] ?? 0) - runtime.motion.pivot.y,
      z: (batch.basePositions[offset + 2] ?? 0) - runtime.motion.pivot.z,
    };
    const axial = dot(relative, runtime.motion.axis);
    const radial = {
      x: relative.x - runtime.motion.axis.x * axial,
      y: relative.y - runtime.motion.axis.y * axial,
      z: relative.z - runtime.motion.axis.z * axial,
    };
    const axialT = clamp01(axial / metrics.maximumAxialDistance);
    const radialT = clamp01(
      Math.hypot(radial.x, radial.y, radial.z) / metrics.maximumRadialDistance,
    );
    const rootMix = smoothstep(0, 0.32, axialT);
    const tipMix = smoothstep(0.5, 1, axialT);
    const edgeMix = smoothstep(0.58, 0.98, radialT)
      * (0.34 + 0.66 * smoothstep(0.18, 0.86, axialT));
    const normalLight = clamp01(
      (batch.baseNormals[offset + 1] ?? 0) * 0.5 + 0.5,
    );
    const accent = 0.5 + 0.5 * Math.sin(
      radial.x * 7.1 + radial.z * 5.3 + accentPhase,
    );

    let color = mix(profile.rootColor, profile.bodyColor, rootMix);
    color = mix(color, profile.tipColor, tipMix * 0.82);
    color = mix(color, profile.edgeColor, edgeMix * (0.22 + accent * 0.18));
    color = multiply(color, variation * (0.84 + normalLight * 0.22));
    setColor(batch.baseColors, offset, color);
  }
}

function presentBatch(batch: ReefRenderableBatch): void {
  const profile = REEF_MATERIAL_PROFILES[batch.source.morphotype];
  for (const runtime of batch.runtimeRanges) colorRange(batch, runtime);

  const colorAttribute = batch.geometry.getAttribute('color') as BufferAttribute;
  mutableArray(colorAttribute).set(batch.baseColors);
  colorAttribute.needsUpdate = true;

  configureMaterial(batch.material, profile);
  batch.geometry.userData.reefMaterialPresentationVersion = REEF_MATERIAL_PRESENTATION_VERSION;
  batch.geometry.userData.reefMaterialPass = REEF_MATERIAL_PASS;
}

/**
 * Renderer-only Phase 11. It reuses existing color buffers and material
 * objects; therefore geometry identity, resources, draw calls and budgets do
 * not change. Updated baseColors remain the exact source for Phase 7 motion.
 */
export function applyReefMaterialPresentation(
  scene: ReefThreeSceneState,
): ReefThreeSceneState {
  if (
    scene.foundation.geometry.userData.reefMaterialPresentationVersion
    === REEF_MATERIAL_PRESENTATION_VERSION
  ) {
    return scene;
  }

  presentFoundation(scene);
  for (const batch of scene.batches) presentBatch(batch);
  return scene;
}
