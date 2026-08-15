import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReefAccretionKind, ReefAccretionLayer, ReefAccretionManifest } from '@/engine/species/reef';

const UP = new THREE.Vector3(0, 1, 0);
const PATCH_SEGMENTS = 18;
const PATCH_RINGS = 4;

const TONES: Record<ReefAccretionKind, readonly string[]> = {
  ENCRUSTING_SHEET: ['#747a68', '#6b7466', '#7b7c69', '#697365'],
  SKELETON_BASE: ['#8c8978', '#817f70', '#96917d', '#77776b'],
  PLATE_STACK: ['#9b6c73', '#906e70', '#a17770', '#896a70'],
  STRUCTURE_SKIRT: ['#61685e', '#596159', '#697065', '#555e56'],
  MINERAL_TRANSITION: ['#727565', '#687062', '#797867', '#626b60'],
};

function patchHeight(kind: 'sheet' | 'skeleton' | 'skirt' | 'mineral', u: number) {
  const crown = Math.pow(Math.max(0, 1 - u), kind === 'skirt' ? 0.72 : 1.15);
  if (kind === 'sheet') return crown * 0.46 - u * 0.12;
  if (kind === 'skeleton') return crown * 0.72 - u * 0.14;
  if (kind === 'mineral') return crown * 0.34 - u * 0.10;
  return crown * 0.92 - u * 0.16;
}

function createOrganicPatchGeometry(kind: 'sheet' | 'skeleton' | 'skirt' | 'mineral') {
  const positions: number[] = [0, patchHeight(kind, 0), 0];
  const indices: number[] = [];

  for (let ring = 1; ring <= PATCH_RINGS; ring += 1) {
    const u = ring / PATCH_RINGS;
    for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
      const angle = segment / PATCH_SEGMENTS * Math.PI * 2;
      const edgeWave = 1
        + Math.sin(angle * 3 + ring * 0.8) * 0.055
        + Math.cos(angle * 5 - ring * 0.55) * 0.035;
      const radius = u * edgeWave;
      const crownNoise = (1 - u) * (
        Math.sin(angle * 4 + ring * 0.9) * 0.045
        + Math.cos(angle * 7 - ring * 0.4) * 0.025
      );
      positions.push(
        Math.cos(angle) * radius,
        patchHeight(kind, u) + crownNoise,
        Math.sin(angle) * radius,
      );
    }
  }

  for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
    const next = (segment + 1) % PATCH_SEGMENTS;
    indices.push(0, 1 + segment, 1 + next);
  }

  for (let ring = 1; ring < PATCH_RINGS; ring += 1) {
    const currentStart = 1 + (ring - 1) * PATCH_SEGMENTS;
    const nextStart = currentStart + PATCH_SEGMENTS;
    for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
      const next = (segment + 1) % PATCH_SEGMENTS;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const outerStart = 1 + (PATCH_RINGS - 1) * PATCH_SEGMENTS;
  const sideStart = positions.length / 3;
  for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
    const angle = segment / PATCH_SEGMENTS * Math.PI * 2;
    const edgeWave = 1
      + Math.sin(angle * 3 + PATCH_RINGS * 0.8) * 0.055
      + Math.cos(angle * 5 - PATCH_RINGS * 0.55) * 0.035;
    positions.push(
      Math.cos(angle) * edgeWave,
      kind === 'skirt' ? -0.28 : -0.20,
      Math.sin(angle) * edgeWave,
    );
  }
  for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
    const next = (segment + 1) % PATCH_SEGMENTS;
    const topA = outerStart + segment;
    const topB = outerStart + next;
    const bottomA = sideStart + segment;
    const bottomB = sideStart + next;
    indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function layerQuaternion(layer: ReefAccretionLayer): THREE.Quaternion {
  const normal = new THREE.Vector3(layer.normal.x, layer.normal.y, layer.normal.z).normalize();
  const surface = new THREE.Quaternion().setFromUnitVectors(UP, normal);
  const tangent = new THREE.Quaternion().setFromAxisAngle(UP, layer.tangentRotation);
  return surface.multiply(tangent);
}

function layerPosition(layer: ReefAccretionLayer): THREE.Vector3 {
  return new THREE.Vector3(
    layer.position.x + layer.normal.x * layer.elevation,
    layer.position.y + layer.normal.y * layer.elevation,
    layer.position.z + layer.normal.z * layer.elevation,
  );
}

function setLayerInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  layer: ReefAccretionLayer,
  yScaleMultiplier = 1,
) {
  const growth = Math.max(0.001, layer.growth);
  const radialGrowth = 0.30 + growth * 0.70;
  const verticalGrowth = 0.26 + growth * 0.74;
  const burialScale = 1 - Math.min(0.28, layer.burial * 0.16);
  const matrix = new THREE.Matrix4().compose(
    layerPosition(layer),
    layerQuaternion(layer),
    new THREE.Vector3(
      layer.radiusX * radialGrowth,
      layer.thickness * verticalGrowth * burialScale * yScaleMultiplier,
      layer.radiusZ * radialGrowth,
    ),
  );
  mesh.setMatrixAt(index, matrix);
  const tones = TONES[layer.kind];
  mesh.setColorAt(index, new THREE.Color(tones[layer.toneIndex % tones.length]));
}

function useLayerGroups(manifest: ReefAccretionManifest) {
  return useMemo(() => {
    const visible = manifest.layers.filter((layer) => layer.growth > 0.015);
    return {
      sheets: visible.filter((layer) => layer.kind === 'ENCRUSTING_SHEET'),
      skeletons: visible.filter((layer) => layer.kind === 'SKELETON_BASE'),
      plates: visible.filter((layer) => layer.kind === 'PLATE_STACK'),
      skirts: visible.filter((layer) => layer.kind === 'STRUCTURE_SKIRT'),
      minerals: visible.filter((layer) => layer.kind === 'MINERAL_TRANSITION'),
    };
  }, [manifest.layers]);
}

export function ReefAccretionObject({ manifest }: { manifest: ReefAccretionManifest }) {
  const { sheets, skeletons, plates, skirts, minerals } = useLayerGroups(manifest);
  const sheetRef = useRef<THREE.InstancedMesh>(null);
  const skeletonRef = useRef<THREE.InstancedMesh>(null);
  const plateRef = useRef<THREE.InstancedMesh>(null);
  const skirtRef = useRef<THREE.InstancedMesh>(null);
  const mineralRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => ({
    sheet: createOrganicPatchGeometry('sheet'),
    skeleton: createOrganicPatchGeometry('skeleton'),
    plate: new THREE.CylinderGeometry(1, 0.9, 1, 16, 1, false),
    skirt: createOrganicPatchGeometry('skirt'),
    mineral: createOrganicPatchGeometry('mineral'),
  }), []);

  const material = useMemo(() => ({
    sheet: new THREE.MeshStandardMaterial({ color: '#747a68', roughness: 0.98, metalness: 0, flatShading: true }),
    skeleton: new THREE.MeshStandardMaterial({ color: '#8c8978', roughness: 0.99, metalness: 0, flatShading: true }),
    plate: new THREE.MeshStandardMaterial({ color: '#9b6c73', roughness: 0.95, metalness: 0 }),
    skirt: new THREE.MeshStandardMaterial({ color: '#61685e', roughness: 1, metalness: 0, flatShading: true }),
    mineral: new THREE.MeshStandardMaterial({ color: '#727565', roughness: 0.99, metalness: 0, flatShading: true }),
  }), []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(material).forEach((item) => item.dispose());
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = sheetRef.current;
    if (!mesh) return;
    sheets.forEach((layer, index) => setLayerInstance(mesh, index, layer, 2.4));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sheets]);

  useLayoutEffect(() => {
    const mesh = skeletonRef.current;
    if (!mesh) return;
    skeletons.forEach((layer, index) => setLayerInstance(mesh, index, layer, 2.7));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skeletons]);

  useLayoutEffect(() => {
    const mesh = plateRef.current;
    if (!mesh) return;
    plates.forEach((layer, index) => setLayerInstance(mesh, index, layer, 0.58));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plates]);

  useLayoutEffect(() => {
    const mesh = skirtRef.current;
    if (!mesh) return;
    skirts.forEach((layer, index) => setLayerInstance(mesh, index, layer, 3.7));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skirts]);

  useLayoutEffect(() => {
    const mesh = mineralRef.current;
    if (!mesh) return;
    minerals.forEach((layer, index) => setLayerInstance(mesh, index, layer, 1.9));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [minerals]);

  return (
    <group
      name="reef-phase-6-accretion"
      userData={{
        renderer: 'phase-6-organic-accretion',
        visibleLayerCount: sheets.length + skeletons.length + plates.length + skirts.length + minerals.length,
      }}
    >
      {skirts.length > 0 ? (
        <instancedMesh ref={skirtRef} args={[geometry.skirt, material.skirt, skirts.length]} castShadow receiveShadow />
      ) : null}
      {minerals.length > 0 ? (
        <instancedMesh ref={mineralRef} args={[geometry.mineral, material.mineral, minerals.length]} receiveShadow />
      ) : null}
      {sheets.length > 0 ? (
        <instancedMesh ref={sheetRef} args={[geometry.sheet, material.sheet, sheets.length]} receiveShadow />
      ) : null}
      {skeletons.length > 0 ? (
        <instancedMesh ref={skeletonRef} args={[geometry.skeleton, material.skeleton, skeletons.length]} castShadow receiveShadow />
      ) : null}
      {plates.length > 0 ? (
        <instancedMesh ref={plateRef} args={[geometry.plate, material.plate, plates.length]} castShadow receiveShadow />
      ) : null}
    </group>
  );
}
