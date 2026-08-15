import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import { isReefVolcanoEruptionActive } from './ReefVolcano';

const TAU = Math.PI * 2;
const VOLCANO_ALBEDO_URL = `${import.meta.env.BASE_URL}assets/reef/volcano/volcano-reference-albedo.webp`;
const FISSURE_STEPS = 11;

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

interface FissureRibbonGeometries {
  scar: THREE.BufferGeometry;
  core: THREE.BufferGeometry;
}

interface RibbonSample {
  left: THREE.Vector3;
  right: THREE.Vector3;
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

function appendRibbonQuad(
  positions: number[],
  current: RibbonSample,
  next: RibbonSample,
): void {
  positions.push(
    current.left.x,
    current.left.y,
    current.left.z,
    current.right.x,
    current.right.y,
    current.right.z,
    next.right.x,
    next.right.y,
    next.right.z,
    current.left.x,
    current.left.y,
    current.left.z,
    next.right.x,
    next.right.y,
    next.right.z,
    next.left.x,
    next.left.y,
    next.left.z,
  );
}

function makeRibbonGeometry(positions: number[], kind: string): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefVolcanoFissureKind = kind;
  return geometry;
}

function projectSurfacePoint(
  mesh: THREE.Mesh,
  raycaster: THREE.Raycaster,
  radial: number,
  angle: number,
  lift: number,
  topY: number,
  bottomY: number,
): THREE.Vector3 | null {
  const topLocal = new THREE.Vector3(
    Math.cos(angle) * radial,
    topY,
    Math.sin(angle) * radial,
  );
  const bottomLocal = new THREE.Vector3(
    Math.cos(angle) * radial,
    bottomY,
    Math.sin(angle) * radial,
  );
  const topWorld = mesh.localToWorld(topLocal);
  const bottomWorld = mesh.localToWorld(bottomLocal);
  const direction = bottomWorld.clone().sub(topWorld).normalize();

  raycaster.set(topWorld, direction);
  raycaster.near = 0;
  raycaster.far = topWorld.distanceTo(bottomWorld) + 0.5;
  const hit = raycaster.intersectObject(mesh, false)[0];
  if (!hit) return null;

  const local = mesh.worldToLocal(hit.point.clone());
  local.y += lift;
  return local;
}

function sampleRibbon(
  mesh: THREE.Mesh,
  raycaster: THREE.Raycaster,
  radial: number,
  angle: number,
  width: number,
  lift: number,
  topY: number,
  bottomY: number,
): RibbonSample | null {
  const angleOffset = width / Math.max(0.08, radial);
  const left = projectSurfacePoint(
    mesh,
    raycaster,
    radial,
    angle - angleOffset,
    lift,
    topY,
    bottomY,
  );
  const right = projectSurfacePoint(
    mesh,
    raycaster,
    radial,
    angle + angleOffset,
    lift,
    topY,
    bottomY,
  );
  if (!left || !right) return null;
  return { left, right };
}

function buildFissureRibbonGeometries(
  mesh: THREE.Mesh,
  identitySeed: number,
): FissureRibbonGeometries {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3(
    new THREE.Vector3(-1, -1, -1),
    new THREE.Vector3(1, 1, 1),
  );
  const position = geometry.getAttribute('position');

  let maxRadius = 1;
  if (position) {
    maxRadius = 0.01;
    for (let index = 0; index < position.count; index += 1) {
      maxRadius = Math.max(maxRadius, Math.hypot(position.getX(index), position.getZ(index)));
    }
  }

  const growth = typeof geometry.userData.reefVolcanoGrowth === 'number'
    ? THREE.MathUtils.clamp(geometry.userData.reefVolcanoGrowth, 0, 1)
    : 0.5;
  const fissureCount = 4 + Math.round(growth * 3);
  const scarPositions: number[] = [];
  const corePositions: number[] = [];
  const raycaster = new THREE.Raycaster();
  const topY = box.max.y + Math.max(1, box.getSize(new THREE.Vector3()).y * 0.35);
  const bottomY = box.min.y - 0.5;

  for (let fissure = 0; fissure < fissureCount; fissure += 1) {
    const baseAngle = stableUnit(identitySeed, `volcano:fissure:${fissure}:angle`) * TAU;
    const reach = 0.5 + stableUnit(identitySeed, `volcano:fissure:${fissure}:reach`) * 0.23;
    const bend = (stableUnit(identitySeed, `volcano:fissure:${fissure}:bend`) - 0.5) * 0.18;
    const phase = stableUnit(identitySeed, `volcano:fissure:${fissure}:phase`) * TAU;
    const widthVariation = 0.82
      + stableUnit(identitySeed, `volcano:fissure:${fissure}:width`) * 0.42;
    const startRadial = maxRadius * (0.105 + stableUnit(
      identitySeed,
      `volcano:fissure:${fissure}:start`,
    ) * 0.028);
    const endRadial = maxRadius * reach;

    let previousScar: RibbonSample | null = null;
    let previousCore: RibbonSample | null = null;

    for (let step = 0; step <= FISSURE_STEPS; step += 1) {
      const t = step / FISSURE_STEPS;
      const radial = THREE.MathUtils.lerp(startRadial, endRadial, Math.pow(t, 0.94));
      const meander = Math.sin(t * Math.PI * 2.2 + phase) * (0.016 + t * 0.034);
      const angle = baseAngle + meander + bend * t * t;
      const taper = THREE.MathUtils.lerp(1, 0.48, t);
      const scarWidth = maxRadius * 0.0125 * widthVariation * taper;
      const coreWidth = scarWidth * (0.22 + (1 - t) * 0.06);
      const scar = sampleRibbon(
        mesh,
        raycaster,
        radial,
        angle,
        scarWidth,
        0.006,
        topY,
        bottomY,
      );
      const core = sampleRibbon(
        mesh,
        raycaster,
        radial,
        angle,
        coreWidth,
        0.011,
        topY,
        bottomY,
      );

      if (scar && previousScar) appendRibbonQuad(scarPositions, previousScar, scar);
      if (core && previousCore) appendRibbonQuad(corePositions, previousCore, core);
      previousScar = scar;
      previousCore = core;
    }
  }

  return {
    scar: makeRibbonGeometry(scarPositions, 'basalt-scar'),
    core: makeRibbonGeometry(corePositions, 'lava-core'),
  };
}

export function ReefVolcanoSurfacePass({ build }: { build: ReefPreviewBuild }) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const albedo = useTexture(VOLCANO_ALBEDO_URL);
  const bump = useMemo(() => albedo.clone(), [albedo]);
  const scarMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const identitySeed = build.species.moduleEvolution.identitySeed;
  const [eruptionActive, setEruptionActive] = useState(
    () => isReefVolcanoEruptionActive(new Date()),
  );

  useEffect(() => () => bump.dispose(), [bump]);

  useEffect(() => {
    const refresh = () => setEruptionActive(isReefVolcanoEruptionActive(new Date()));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const scarMaterial = scarMaterialRef.current;
    if (scarMaterial) {
      scarMaterial.color.set(eruptionActive ? '#1b0d08' : '#12100f');
      scarMaterial.emissive.set(eruptionActive ? '#351006' : '#050404');
      scarMaterial.emissiveIntensity = eruptionActive ? 0.32 : 0.025;
    }

    const coreMaterial = coreMaterialRef.current;
    if (coreMaterial) {
      coreMaterial.color.set(eruptionActive ? '#ff6b21' : '#7b2a19');
      coreMaterial.opacity = eruptionActive ? 0.9 : 0.055;
    }
    invalidate();
  }, [eruptionActive, invalidate]);

  useLayoutEffect(() => {
    const object = scene.getObjectByName('reef-volcano-support-surface');
    if (!(object instanceof THREE.Mesh)) return undefined;
    const volcanoRoot = scene.getObjectByName('reef-submarine-volcano');
    if (!volcanoRoot) return undefined;

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

    const fissures = buildFissureRibbonGeometries(object, identitySeed);
    const scarMaterial = new THREE.MeshStandardMaterial({
      color: eruptionActive ? '#1b0d08' : '#12100f',
      roughness: 1,
      metalness: 0,
      emissive: eruptionActive ? '#351006' : '#050404',
      emissiveIntensity: eruptionActive ? 0.32 : 0.025,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.2,
      polygonOffsetUnits: -1.2,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: eruptionActive ? '#ff6b21' : '#7b2a19',
      transparent: true,
      opacity: eruptionActive ? 0.9 : 0.055,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.2,
      polygonOffsetUnits: -2.2,
    });
    scarMaterialRef.current = scarMaterial;
    coreMaterialRef.current = coreMaterial;

    const scarMesh = new THREE.Mesh(fissures.scar, scarMaterial);
    scarMesh.name = 'reef-volcano-fissure-scars';
    scarMesh.renderOrder = 5;
    scarMesh.frustumCulled = false;
    scarMesh.userData.reefVolcanoFissureLayer = 'scar';

    const coreMesh = new THREE.Mesh(fissures.core, coreMaterial);
    coreMesh.name = 'reef-volcano-fissure-cores';
    coreMesh.renderOrder = 6;
    coreMesh.frustumCulled = false;
    coreMesh.userData.reefVolcanoFissureLayer = 'lava-core';

    volcanoRoot.add(scarMesh, coreMesh);
    object.userData.reefVolcanoReferenceSurface = 'uploaded-glb-texture-v2';
    object.userData.reefVolcanoSeamRepair = 'double-sided+seam-safe-uv-v2';
    object.userData.reefVolcanoTextureSource = 'uploaded Sketchfab GLB basalt surface crop';
    object.userData.reefVolcanoTextureIdentity = identitySeed;
    object.userData.reefVolcanoFissureRenderer = 'inset-ribbon-v1';
    invalidate();

    return () => {
      volcanoRoot.remove(scarMesh, coreMesh);
      fissures.scar.dispose();
      fissures.core.dispose();
      scarMaterial.dispose();
      coreMaterial.dispose();
      if (scarMaterialRef.current === scarMaterial) scarMaterialRef.current = null;
      if (coreMaterialRef.current === coreMaterial) coreMaterialRef.current = null;

      if (previousUv) geometry.setAttribute('uv', previousUv);
      else geometry.deleteAttribute('uv');
      if (previousUvProjection === undefined) delete geometry.userData.reefVolcanoUvProjection;
      else geometry.userData.reefVolcanoUvProjection = previousUvProjection;

      restoreMaterial(material, snapshot);
      delete object.userData.reefVolcanoReferenceSurface;
      delete object.userData.reefVolcanoSeamRepair;
      delete object.userData.reefVolcanoTextureSource;
      delete object.userData.reefVolcanoTextureIdentity;
      delete object.userData.reefVolcanoFissureRenderer;
      invalidate();
    };
  }, [albedo, bump, gl, identitySeed, invalidate, scene]);

  return null;
}
