import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type {
  ReefAccretionKind,
  ReefAccretionLayer,
  ReefAccretionManifest,
  ReefCoreManifest,
} from '@/engine/species/reef';

const UP = new THREE.Vector3(0, 1, 0);
const PATCH_SEGMENTS = 18;
const PATCH_RINGS = 4;
const SHEET_CLUSTER_SIZE = 3;

const TONES: Record<ReefAccretionKind, readonly string[]> = {
  ENCRUSTING_SHEET: ['#747a68', '#6b7466', '#7b7c69', '#697365'],
  SKELETON_BASE: ['#8c8978', '#817f70', '#96917d', '#77776b'],
  PLATE_STACK: ['#9b6c73', '#906e70', '#a17770', '#896a70'],
  STRUCTURE_SKIRT: ['#626b61', '#5b645c', '#6c7368', '#586159'],
  MINERAL_TRANSITION: ['#727565', '#687062', '#797867', '#626b60'],
};

interface ConnectorSpec {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  height: number;
  length: number;
  toneIndex: number;
}

function patchHeight(kind: 'sheet' | 'skeleton' | 'skirt' | 'mineral', u: number) {
  const crown = Math.pow(Math.max(0, 1 - u), kind === 'skirt' ? 0.64 : 1.12);
  if (kind === 'sheet') return crown * 0.38 - u * 0.07;
  if (kind === 'skeleton') return crown * 0.58 - u * 0.08;
  if (kind === 'mineral') return crown * 0.28 - u * 0.06;
  return crown * 0.70 - u * 0.09;
}

function createOrganicPatchGeometry(kind: 'sheet' | 'skeleton' | 'skirt' | 'mineral') {
  const positions: number[] = [0, patchHeight(kind, 0), 0];
  const indices: number[] = [];

  for (let ring = 1; ring <= PATCH_RINGS; ring += 1) {
    const u = ring / PATCH_RINGS;
    for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
      const angle = segment / PATCH_SEGMENTS * Math.PI * 2;
      const edgeWave = 1
        + Math.sin(angle * 3 + ring * 0.8) * 0.07
        + Math.cos(angle * 5 - ring * 0.55) * 0.045;
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
      + Math.sin(angle * 3 + PATCH_RINGS * 0.8) * 0.07
      + Math.cos(angle * 5 - PATCH_RINGS * 0.55) * 0.045;
    positions.push(
      Math.cos(angle) * edgeWave,
      kind === 'skirt' ? -0.09 : -0.055,
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

function createConnectorGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const wave = Math.sin(z * 5.2) * 0.08 + Math.cos(x * 4.1) * 0.05;
    position.setXYZ(index, x * (1 + wave * 0.28), y * (0.74 + wave * 0.18), z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
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
  yScaleMultiplier: number,
  radiusScale = 1,
  position?: THREE.Vector3,
  toneOffset = 0,
) {
  const growth = Math.max(0.001, layer.growth);
  const radialGrowth = 0.30 + growth * 0.70;
  const verticalGrowth = 0.28 + growth * 0.72;
  const burialScale = 1 - Math.min(0.30, layer.burial * 0.18);
  const matrix = new THREE.Matrix4().compose(
    position ?? layerPosition(layer),
    layerQuaternion(layer),
    new THREE.Vector3(
      layer.radiusX * radialGrowth * radiusScale,
      layer.thickness * verticalGrowth * burialScale * yScaleMultiplier * radiusScale,
      layer.radiusZ * radialGrowth * radiusScale,
    ),
  );
  mesh.setMatrixAt(index, matrix);
  const tones = TONES[layer.kind];
  mesh.setColorAt(index, new THREE.Color(tones[(layer.toneIndex + toneOffset) % tones.length]));
}

function setSheetCluster(mesh: THREE.InstancedMesh, startIndex: number, layer: ReefAccretionLayer) {
  const base = layerPosition(layer);
  const quaternion = layerQuaternion(layer);
  setLayerInstance(mesh, startIndex, layer, 1.55, 1, base);

  for (let satellite = 1; satellite < SHEET_CLUSTER_SIZE; satellite += 1) {
    const phase = ((layer.seed >>> (satellite * 4)) % 4096) / 4096 * Math.PI * 2;
    const radius = Math.max(layer.radiusX, layer.radiusZ) * (0.50 + satellite * 0.12);
    const localOffset = new THREE.Vector3(
      Math.cos(phase) * radius,
      0,
      Math.sin(phase) * radius * 0.82,
    ).applyQuaternion(quaternion);
    const satellitePosition = base.clone().add(localOffset);
    const scale = satellite === 1 ? 0.42 : 0.30;
    setLayerInstance(mesh, startIndex + satellite, layer, 1.2, scale, satellitePosition, satellite);
  }
}

function ellipseRadiusAtAngle(core: ReefCoreManifest, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const denominator = Math.sqrt(
    (cosine * cosine) / Math.max(0.0001, core.platform.radiusX * core.platform.radiusX)
      + (sine * sine) / Math.max(0.0001, core.platform.radiusZ * core.platform.radiusZ),
  );
  return denominator > 0 ? 1 / denominator : 0;
}

function connectorFor(layer: ReefAccretionLayer, core: ReefCoreManifest): ConnectorSpec | null {
  const radialDistance = Math.hypot(layer.position.x, layer.position.z);
  if (radialDistance <= 0.0001) return null;
  const angle = Math.atan2(layer.position.z, layer.position.x);
  const edgeRadius = ellipseRadiusAtAngle(core, angle) * 0.96;
  if (radialDistance <= edgeRadius * 1.02) return null;

  const edgeX = Math.cos(angle) * edgeRadius;
  const edgeZ = Math.sin(angle) * edgeRadius;
  const dx = layer.position.x - edgeX;
  const dz = layer.position.z - edgeZ;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.20) return null;

  const visibleGrowth = 0.22 + Math.max(0, Math.min(1, layer.growth)) * 0.78;
  return {
    x: (edgeX + layer.position.x) * 0.5,
    y: -core.platform.thickness * 0.42 + Math.min(0.12, layer.thickness * 0.55),
    z: (edgeZ + layer.position.z) * 0.5,
    rotationY: Math.atan2(dx, dz),
    width: Math.max(0.40, Math.min(layer.radiusX, layer.radiusZ) * 1.35) * visibleGrowth,
    height: Math.max(0.12, layer.thickness * 1.65) * (0.62 + visibleGrowth * 0.38),
    length: distance * 0.68,
    toneIndex: layer.toneIndex,
  };
}

function useLayerGroups(manifest: ReefAccretionManifest, core: ReefCoreManifest) {
  return useMemo(() => {
    const visible = manifest.layers.filter((layer) => layer.growth > 0.015);
    const allSkirts = manifest.layers.filter((layer) => layer.kind === 'STRUCTURE_SKIRT');
    const skirts = visible.filter((layer) => layer.kind === 'STRUCTURE_SKIRT');
    return {
      sheets: visible.filter((layer) => layer.kind === 'ENCRUSTING_SHEET'),
      skeletons: visible.filter((layer) => layer.kind === 'SKELETON_BASE'),
      plates: visible.filter((layer) => layer.kind === 'PLATE_STACK'),
      skirts,
      minerals: visible.filter((layer) => layer.kind === 'MINERAL_TRANSITION'),
      connectors: allSkirts
        .map((layer) => connectorFor(layer, core))
        .filter((connector): connector is ConnectorSpec => connector !== null),
    };
  }, [core, manifest.layers]);
}

export function ReefAccretionObject({
  manifest,
  core,
}: {
  manifest: ReefAccretionManifest;
  core: ReefCoreManifest;
}) {
  const { sheets, skeletons, plates, skirts, minerals, connectors } = useLayerGroups(manifest, core);
  const sheetRef = useRef<THREE.InstancedMesh>(null);
  const skeletonRef = useRef<THREE.InstancedMesh>(null);
  const plateRef = useRef<THREE.InstancedMesh>(null);
  const skirtRef = useRef<THREE.InstancedMesh>(null);
  const mineralRef = useRef<THREE.InstancedMesh>(null);
  const connectorRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => ({
    sheet: createOrganicPatchGeometry('sheet'),
    skeleton: createOrganicPatchGeometry('skeleton'),
    plate: new THREE.CylinderGeometry(1, 0.9, 1, 16, 1, false),
    skirt: createOrganicPatchGeometry('skirt'),
    mineral: createOrganicPatchGeometry('mineral'),
    connector: createConnectorGeometry(),
  }), []);

  const material = useMemo(() => ({
    sheet: new THREE.MeshStandardMaterial({ color: '#747a68', roughness: 0.98, metalness: 0, flatShading: true }),
    skeleton: new THREE.MeshStandardMaterial({ color: '#8c8978', roughness: 0.99, metalness: 0, flatShading: true }),
    plate: new THREE.MeshStandardMaterial({ color: '#9b6c73', roughness: 0.95, metalness: 0 }),
    skirt: new THREE.MeshStandardMaterial({ color: '#626b61', roughness: 1, metalness: 0, flatShading: true }),
    mineral: new THREE.MeshStandardMaterial({ color: '#727565', roughness: 0.99, metalness: 0, flatShading: true }),
    connector: new THREE.MeshStandardMaterial({ color: '#5e675e', roughness: 1, metalness: 0, flatShading: true }),
  }), []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(material).forEach((item) => item.dispose());
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = sheetRef.current;
    if (!mesh) return;
    sheets.forEach((layer, index) => setSheetCluster(mesh, index * SHEET_CLUSTER_SIZE, layer));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sheets]);

  useLayoutEffect(() => {
    const mesh = skeletonRef.current;
    if (!mesh) return;
    skeletons.forEach((layer, index) => setLayerInstance(mesh, index, layer, 1.85, 1.08));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skeletons]);

  useLayoutEffect(() => {
    const mesh = plateRef.current;
    if (!mesh) return;
    plates.forEach((layer, index) => setLayerInstance(mesh, index, layer, 0.52, 0.92));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plates]);

  useLayoutEffect(() => {
    const mesh = skirtRef.current;
    if (!mesh) return;
    skirts.forEach((layer, index) => setLayerInstance(mesh, index, layer, 2.05, 1.24));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skirts]);

  useLayoutEffect(() => {
    const mesh = mineralRef.current;
    if (!mesh) return;
    minerals.forEach((layer, index) => setLayerInstance(mesh, index, layer, 1.25, 1.12));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [minerals]);

  useLayoutEffect(() => {
    const mesh = connectorRef.current;
    if (!mesh) return;
    connectors.forEach((connector, index) => {
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(connector.x, connector.y, connector.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, connector.rotationY, 0)),
        new THREE.Vector3(connector.width, connector.height, connector.length),
      );
      mesh.setMatrixAt(index, matrix);
      const tones = TONES.STRUCTURE_SKIRT;
      mesh.setColorAt(index, new THREE.Color(tones[connector.toneIndex % tones.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [connectors]);

  return (
    <group
      name="reef-phase-6-accretion"
      userData={{
        renderer: 'phase-6-organic-accretion-final',
        visibleLayerCount: sheets.length + skeletons.length + plates.length + skirts.length + minerals.length,
        connectorCount: connectors.length,
      }}
    >
      {connectors.length > 0 ? (
        <instancedMesh ref={connectorRef} args={[geometry.connector, material.connector, connectors.length]} receiveShadow />
      ) : null}
      {skirts.length > 0 ? (
        <instancedMesh ref={skirtRef} args={[geometry.skirt, material.skirt, skirts.length]} receiveShadow />
      ) : null}
      {minerals.length > 0 ? (
        <instancedMesh ref={mineralRef} args={[geometry.mineral, material.mineral, minerals.length]} receiveShadow />
      ) : null}
      {sheets.length > 0 ? (
        <instancedMesh
          ref={sheetRef}
          args={[geometry.sheet, material.sheet, sheets.length * SHEET_CLUSTER_SIZE]}
          receiveShadow
        />
      ) : null}
      {skeletons.length > 0 ? (
        <instancedMesh ref={skeletonRef} args={[geometry.skeleton, material.skeleton, skeletons.length]} receiveShadow />
      ) : null}
      {plates.length > 0 ? (
        <instancedMesh ref={plateRef} args={[geometry.plate, material.plate, plates.length]} receiveShadow />
      ) : null}
    </group>
  );
}
