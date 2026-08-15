import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';

const TAU = Math.PI * 2;
const TEXTURE_SIZE = 256;

interface VolcanoReferenceTextures {
  albedo: THREE.DataTexture;
  bump: THREE.DataTexture;
}

interface MaterialSnapshot {
  map: THREE.Texture | null;
  bumpMap: THREE.Texture | null;
  bumpScale: number;
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  vertexColors: boolean;
  roughness: number;
  metalness: number;
  side: THREE.Side;
  flatShading: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

function harmonic(
  u: number,
  v: number,
  xFrequency: number,
  yFrequency: number,
  phase: number,
): number {
  return Math.sin(TAU * (u * xFrequency + v * yFrequency) + phase);
}

function lerpColor(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  const t = clamp01(amount);
  return [
    THREE.MathUtils.lerp(from[0], to[0], t),
    THREE.MathUtils.lerp(from[1], to[1], t),
    THREE.MathUtils.lerp(from[2], to[2], t),
  ];
}

/**
 * Builds a new seamless basalt texture from the colour/roughness character of
 * the uploaded Sketchfab GLB. No UV atlas from the reference is shipped: the
 * map is synthesized for Amore's procedural topology, so it remains seamless
 * while the volcano continues to grow.
 */
function buildReferenceTextures(identitySeed: number): VolcanoReferenceTextures {
  const albedoData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const bumpData = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  const phases = Array.from({ length: 8 }, (_value, index) => (
    stableUnit(identitySeed, `volcano:reference-texture:${index}`) * TAU
  ));

  // Palette sampled from the reference's cold basalt, then lifted slightly so
  // the underwater light rig does not crush the rock back to black.
  const dark = [44, 49, 52] as const;
  const middle = [86, 94, 96] as const;
  const light = [136, 143, 141] as const;

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    const v = y / TEXTURE_SIZE;

    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const u = x / TEXTURE_SIZE;
      const pixel = (y * TEXTURE_SIZE + x) * 4;

      // Integer harmonic frequencies guarantee periodic edges, so RepeatWrapping
      // cannot expose a vertical texture seam.
      const broad = harmonic(u, v, 1, 2, phases[0] ?? 0) * 0.32
        + harmonic(u, v, 2, 1, phases[1] ?? 0) * 0.22;
      const medium = harmonic(u, v, 4, 3, phases[2] ?? 0) * 0.17
        + harmonic(u, v, 7, -5, phases[3] ?? 0) * 0.1;
      const fine = harmonic(u, v, 13, 8, phases[4] ?? 0) * 0.055
        + harmonic(u, v, 19, -11, phases[5] ?? 0) * 0.035;

      const warp = harmonic(u, v, 2, -1, phases[6] ?? 0) * 0.12
        + harmonic(u, v, 3, 2, phases[7] ?? 0) * 0.055;
      const striationPhase = TAU * (u * 5 + v * 2 + warp);
      const striation = Math.sign(Math.cos(striationPhase))
        * Math.pow(Math.abs(Math.cos(striationPhase)), 2.1) * 0.19;

      const height = clamp01(0.51 + broad + medium + fine + striation);
      const colour = height < 0.52
        ? lerpColor(dark, middle, height / 0.52)
        : lerpColor(middle, light, (height - 0.52) / 0.48);

      // Very small mineral colour shifts keep the surface geological rather
      // than monochrome without turning it green under the reef fog.
      const mineral = harmonic(u, v, 5, -3, phases[1] ?? 0);
      albedoData[pixel] = Math.round(clamp01((colour[0] + mineral * 4) / 255) * 255);
      albedoData[pixel + 1] = Math.round(clamp01((colour[1] + mineral * 2) / 255) * 255);
      albedoData[pixel + 2] = Math.round(clamp01((colour[2] - mineral * 1.5) / 255) * 255);
      albedoData[pixel + 3] = 255;

      const bump = Math.round(clamp01(0.18 + height * 0.78) * 255);
      bumpData[pixel] = bump;
      bumpData[pixel + 1] = bump;
      bumpData[pixel + 2] = bump;
      bumpData[pixel + 3] = 255;
    }
  }

  const albedo = new THREE.DataTexture(
    albedoData,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.magFilter = THREE.LinearFilter;
  albedo.minFilter = THREE.LinearMipmapLinearFilter;
  albedo.generateMipmaps = true;
  albedo.needsUpdate = true;

  const bump = new THREE.DataTexture(
    bumpData,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.magFilter = THREE.LinearFilter;
  bump.minFilter = THREE.LinearMipmapLinearFilter;
  bump.generateMipmaps = true;
  bump.needsUpdate = true;

  return { albedo, bump };
}

function textureU(x: number, z: number): number {
  const normalized = Math.atan2(z, x) / TAU;
  return normalized < 0 ? normalized + 1 : normalized;
}

/**
 * Reprojects the procedural volcano to a cylindrical/slope UV field.
 *
 * The generator deliberately emits non-indexed triangles, so every triangle can
 * own seam-safe UVs. When a triangle crosses 0/1 around the azimuth, the low U
 * values are lifted by one repeat instead of interpolating through the whole
 * texture. This removes the radial strip visible in the mobile screenshots.
 */
function projectVolcanoUvs(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize !== 3 || position.count < 3) return;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const minY = box?.min.y ?? 0;
  const maxY = box?.max.y ?? 1;
  const height = Math.max(1e-4, maxY - minY);

  let maxRadius = 1e-4;
  for (let index = 0; index < position.count; index += 1) {
    maxRadius = Math.max(
      maxRadius,
      Math.hypot(position.getX(index), position.getZ(index)),
    );
  }

  const uv = new Float32Array(position.count * 2);

  for (let triangle = 0; triangle < position.count; triangle += 3) {
    const baseU: [number, number, number] = [
      textureU(position.getX(triangle), position.getZ(triangle)),
      textureU(position.getX(triangle + 1), position.getZ(triangle + 1)),
      textureU(position.getX(triangle + 2), position.getZ(triangle + 2)),
    ];

    const minU = Math.min(...baseU);
    const maxU = Math.max(...baseU);
    if (maxU - minU > 0.5) {
      for (let offset = 0; offset < 3; offset += 1) {
        const slot = offset as 0 | 1 | 2;
        if (baseU[slot] < 0.5) baseU[slot] += 1;
      }
    }

    for (let offset = 0; offset < 3; offset += 1) {
      const slot = offset as 0 | 1 | 2;
      const index = triangle + offset;
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const radial = Math.hypot(x, z) / maxRadius;
      const height01 = THREE.MathUtils.clamp((y - minY) / height, 0, 1);

      uv[index * 2] = baseU[slot] * 3.15 + height01 * 0.13;
      uv[index * 2 + 1] = radial * 2.35 + (1 - height01) * 0.22;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.reefVolcanoUvProjection = 'reference-cylindrical-v1';
}

function snapshotMaterial(material: THREE.MeshStandardMaterial): MaterialSnapshot {
  return {
    map: material.map,
    bumpMap: material.bumpMap,
    bumpScale: material.bumpScale,
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    emissiveIntensity: material.emissiveIntensity,
    vertexColors: material.vertexColors,
    roughness: material.roughness,
    metalness: material.metalness,
    side: material.side,
    flatShading: material.flatShading,
  };
}

function restoreMaterial(
  material: THREE.MeshStandardMaterial,
  snapshot: MaterialSnapshot,
): void {
  material.map = snapshot.map;
  material.bumpMap = snapshot.bumpMap;
  material.bumpScale = snapshot.bumpScale;
  material.color.copy(snapshot.color);
  material.emissive.copy(snapshot.emissive);
  material.emissiveIntensity = snapshot.emissiveIntensity;
  material.vertexColors = snapshot.vertexColors;
  material.roughness = snapshot.roughness;
  material.metalness = snapshot.metalness;
  material.side = snapshot.side;
  material.flatShading = snapshot.flatShading;
  material.needsUpdate = true;
}

export function ReefVolcanoSurfacePass({ build }: { build: ReefPreviewBuild }) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const identitySeed = build.species.moduleEvolution.identitySeed;
  const textures = useMemo(
    () => buildReferenceTextures(identitySeed),
    [identitySeed],
  );

  useEffect(() => () => {
    textures.albedo.dispose();
    textures.bump.dispose();
  }, [textures]);

  useLayoutEffect(() => {
    const object = scene.getObjectByName('reef-volcano-support-surface');
    if (!(object instanceof THREE.Mesh)) return undefined;

    const geometry = object.geometry;
    const material = object.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return undefined;

    const previousUv = geometry.getAttribute('uv');
    const previousUvProjection = geometry.userData.reefVolcanoUvProjection;
    const snapshot = snapshotMaterial(material);

    projectVolcanoUvs(geometry);

    const anisotropy = Math.min(8, Math.max(1, gl.capabilities.getMaxAnisotropy()));
    textures.albedo.anisotropy = anisotropy;
    textures.bump.anisotropy = anisotropy;
    textures.albedo.needsUpdate = true;
    textures.bump.needsUpdate = true;

    material.map = textures.albedo;
    material.bumpMap = textures.bump;
    material.bumpScale = 0.072;
    material.color.set('#eef1ed');
    material.vertexColors = false;
    material.roughness = 0.975;
    material.metalness = 0;
    material.emissive.set('#111918');
    material.emissiveIntensity = 0.052;

    // On the highly asymmetric cone a few triangles can face away enough to
    // expose a wedge when back-face culling is active. Double-sided rendering
    // closes that transparent seam without adding duplicate geology.
    material.side = THREE.DoubleSide;
    material.flatShading = false;
    material.needsUpdate = true;

    object.userData.reefVolcanoReferenceSurface = 'uploaded-glb-landscape-inspired-v1';
    object.userData.reefVolcanoSeamRepair = 'double-sided+seam-safe-uv';
    invalidate();

    return () => {
      if (previousUv) geometry.setAttribute('uv', previousUv);
      else geometry.deleteAttribute('uv');

      if (previousUvProjection === undefined) {
        delete geometry.userData.reefVolcanoUvProjection;
      } else {
        geometry.userData.reefVolcanoUvProjection = previousUvProjection;
      }

      restoreMaterial(material, snapshot);
      delete object.userData.reefVolcanoReferenceSurface;
      delete object.userData.reefVolcanoSeamRepair;
      invalidate();
    };
  }, [build, gl, invalidate, scene, textures]);

  return null;
}
