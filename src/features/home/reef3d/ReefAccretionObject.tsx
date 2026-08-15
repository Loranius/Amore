import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReefAccretionKind, ReefAccretionLayer, ReefAccretionManifest } from '@/engine/species/reef';

const UP = new THREE.Vector3(0, 1, 0);

const TONES: Record<ReefAccretionKind, readonly string[]> = {
  ENCRUSTING_SHEET: ['#68715f', '#737761', '#646e5f', '#7a7560'],
  SKELETON_BASE: ['#8c8977', '#817f70', '#96917d', '#77776b'],
  PLATE_STACK: ['#a86f78', '#9c7476', '#ad7c72', '#936d77'],
  STRUCTURE_SKIRT: ['#53594e', '#5b5f52', '#4d554c', '#626157'],
  MINERAL_TRANSITION: ['#746f5d', '#6e7460', '#7d7660', '#696b5c'],
};

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
  const radialGrowth = 0.22 + growth * 0.78;
  const verticalGrowth = Math.max(0.08, growth);
  const burialScale = 1 - Math.min(0.36, layer.burial * 0.22);
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
    sheet: new THREE.IcosahedronGeometry(1, 2),
    skeleton: new THREE.IcosahedronGeometry(1, 1),
    plate: new THREE.CylinderGeometry(1, 0.82, 1, 14, 1, false),
    skirt: new THREE.SphereGeometry(1, 18, 9),
    mineral: new THREE.IcosahedronGeometry(1, 1),
  }), []);

  const material = useMemo(() => ({
    sheet: new THREE.MeshStandardMaterial({ color: '#68715f', roughness: 0.97, metalness: 0 }),
    skeleton: new THREE.MeshStandardMaterial({ color: '#8c8977', roughness: 0.98, metalness: 0 }),
    plate: new THREE.MeshStandardMaterial({ color: '#a86f78', roughness: 0.94, metalness: 0 }),
    skirt: new THREE.MeshStandardMaterial({ color: '#53594e', roughness: 0.99, metalness: 0 }),
    mineral: new THREE.MeshStandardMaterial({ color: '#746f5d', roughness: 0.98, metalness: 0 }),
  }), []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(material).forEach((item) => item.dispose());
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = sheetRef.current;
    if (!mesh) return;
    sheets.forEach((layer, index) => setLayerInstance(mesh, index, layer, 0.72));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sheets]);

  useLayoutEffect(() => {
    const mesh = skeletonRef.current;
    if (!mesh) return;
    skeletons.forEach((layer, index) => setLayerInstance(mesh, index, layer, 1.16));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skeletons]);

  useLayoutEffect(() => {
    const mesh = plateRef.current;
    if (!mesh) return;
    plates.forEach((layer, index) => setLayerInstance(mesh, index, layer, 1));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plates]);

  useLayoutEffect(() => {
    const mesh = skirtRef.current;
    if (!mesh) return;
    skirts.forEach((layer, index) => setLayerInstance(mesh, index, layer, 0.68));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [skirts]);

  useLayoutEffect(() => {
    const mesh = mineralRef.current;
    if (!mesh) return;
    minerals.forEach((layer, index) => setLayerInstance(mesh, index, layer, 0.5));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [minerals]);

  return (
    <group
      name="reef-phase-6-accretion"
      userData={{
        renderer: 'phase-6-instanced',
        visibleLayerCount: sheets.length + skeletons.length + plates.length + skirts.length + minerals.length,
      }}
    >
      {skirts.length > 0 ? (
        <instancedMesh
          ref={skirtRef}
          args={[geometry.skirt, material.skirt, skirts.length]}
          castShadow
          receiveShadow
        />
      ) : null}
      {minerals.length > 0 ? (
        <instancedMesh
          ref={mineralRef}
          args={[geometry.mineral, material.mineral, minerals.length]}
          receiveShadow
        />
      ) : null}
      {sheets.length > 0 ? (
        <instancedMesh
          ref={sheetRef}
          args={[geometry.sheet, material.sheet, sheets.length]}
          receiveShadow
        />
      ) : null}
      {skeletons.length > 0 ? (
        <instancedMesh
          ref={skeletonRef}
          args={[geometry.skeleton, material.skeleton, skeletons.length]}
          castShadow
          receiveShadow
        />
      ) : null}
      {plates.length > 0 ? (
        <instancedMesh
          ref={plateRef}
          args={[geometry.plate, material.plate, plates.length]}
          castShadow
          receiveShadow
        />
      ) : null}
    </group>
  );
}
