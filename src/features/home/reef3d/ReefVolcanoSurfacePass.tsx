import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';

const TAU = Math.PI * 2;
const VOLCANO_ALBEDO_URL = `${import.meta.env.BASE_URL}assets/reef/volcano/volcano-reference-albedo.webp`;

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

function textureU(x: number, z: number): number {
  const normalized = Math.atan2(z, x) / TAU;
  return normalized < 0 ? normalized + 1 : normalized;
}

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
    maxRadius = Math.max(maxRadius, Math.hypot(position.getX(index), position.getZ(index)));
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

      uv[index * 2] = baseU[slot] * 4.2 + height01 * 0.16;
      uv[index * 2 + 1] = radial * 3.4 + (1 - height01) * 0.32;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData.reefVolcanoUvProjection = 'reference-cylindrical-v2';
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

function restoreMaterial(material: THREE.MeshStandardMaterial, snapshot: MaterialSnapshot): void {
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
  const albedo = useTexture(VOLCANO_ALBEDO_URL);
  const bump = useMemo(() => albedo.clone(), [albedo]);

  useEffect(() => () => bump.dispose(), [bump]);

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
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.anisotropy = anisotropy;
    albedo.needsUpdate = true;

    bump.colorSpace = THREE.NoColorSpace;
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = anisotropy;
    bump.needsUpdate = true;

    material.map = albedo;
    material.bumpMap = bump;
    material.bumpScale = 0.085;
    material.color.set('#d5d9d5');
    material.vertexColors = false;
    material.roughness = 0.97;
    material.metalness = 0;
    material.emissive.set('#0c1211');
    material.emissiveIntensity = 0.025;
    material.side = THREE.DoubleSide;
    material.flatShading = false;
    material.needsUpdate = true;

    object.userData.reefVolcanoReferenceSurface = 'uploaded-glb-texture-v2';
    object.userData.reefVolcanoSeamRepair = 'double-sided+seam-safe-uv-v2';
    object.userData.reefVolcanoTextureSource = 'uploaded Sketchfab GLB basalt surface crop';
    object.userData.reefVolcanoTextureIdentity = build.species.moduleEvolution.identitySeed;
    invalidate();

    return () => {
      if (previousUv) geometry.setAttribute('uv', previousUv);
      else geometry.deleteAttribute('uv');

      if (previousUvProjection === undefined) delete geometry.userData.reefVolcanoUvProjection;
      else geometry.userData.reefVolcanoUvProjection = previousUvProjection;

      restoreMaterial(material, snapshot);
      delete object.userData.reefVolcanoReferenceSurface;
      delete object.userData.reefVolcanoSeamRepair;
      delete object.userData.reefVolcanoTextureSource;
      delete object.userData.reefVolcanoTextureIdentity;
      invalidate();
    };
  }, [albedo, build, bump, gl, invalidate, scene]);

  return null;
}
