import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ReefCoreManifest, ReefYearStructure, ReefYearStructuresManifest } from '@/engine/species/reef';

function rockGeometry(structure: ReefYearStructure) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const phase = (structure.seed % 8192) / 8192 * Math.PI * 2;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const noise = Math.sin(angle * 3 + phase + y * 2) * 0.65 + Math.cos(angle * 5 - phase) * 0.35;
    const radial = 1 + structure.shape.irregularity * noise;
    position.setXYZ(i, x * radial, y * (1 + structure.shape.erosion * 0.05 * noise), z * radial);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function columnGeometry(structure: ReefYearStructure) {
  const geometry = new THREE.CylinderGeometry(0.72, 1, 1, 18, 8);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const phase = (structure.seed % 4096) / 4096 * Math.PI * 2;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const y01 = y + 0.5;
    const angle = Math.atan2(z, x);
    const radial = 1 + structure.shape.irregularity * Math.sin(angle * 4 + phase + y01 * 2.4);
    position.setXYZ(i, x * radial + structure.shape.leanX * y01, y, z * radial + structure.shape.leanZ * y01);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function ridgeGeometry(structure: ReefYearStructure) {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 10, 6, 7);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const phase = (structure.seed % 6000) / 6000 * Math.PI * 2;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const crest = 1 - Math.abs(x) * 0.72;
    position.setXYZ(i, x, y * (0.7 + crest * 0.45) + Math.sin(x * 7 + phase) * 0.08, z + structure.shape.skew * x * 0.15);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function archGeometry(structure: ReefYearStructure) {
  const s = structure.shape;
  const points = [
    new THREE.Vector3(-s.width * 0.5, 0, 0),
    new THREE.Vector3(-s.width * 0.35, s.height * (0.48 - s.openingAsymmetry * 0.08), s.depth * 0.08),
    new THREE.Vector3(s.skew * s.width * 0.18, s.height, s.curveDepth * s.depth),
    new THREE.Vector3(s.width * 0.34, s.height * (0.56 + s.openingAsymmetry * 0.08), -s.depth * 0.06),
    new THREE.Vector3(s.width * 0.5, 0, 0),
  ];
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45),
    44,
    Math.max(0.12, s.depth * 0.33),
    8,
    false,
  );
}

function geometryFor(structure: ReefYearStructure) {
  switch (structure.archetype) {
    case 'BOULDER': return rockGeometry(structure);
    case 'COLUMN': return columnGeometry(structure);
    case 'RIDGE': return ridgeGeometry(structure);
    case 'ARCH': return archGeometry(structure);
  }
}

function YearMesh({ structure, material }: { structure: ReefYearStructure; material: THREE.Material }) {
  const geometry = useMemo(() => geometryFor(structure), [structure]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const growth = 0.12 + structure.growth * 0.88;
  const isArch = structure.archetype === 'ARCH';
  const isBoulder = structure.archetype === 'BOULDER';
  const scaleY = isBoulder ? structure.shape.height * 0.5 * growth : structure.shape.height * growth;
  const scale: [number, number, number] = isArch
    ? [growth, growth, growth]
    : [structure.shape.width * 0.5 * growth, scaleY, structure.shape.depth * 0.5 * growth];
  const y = isArch ? 0 : isBoulder ? structure.shape.height * 0.42 * growth : structure.shape.height * 0.5 * growth;
  return <mesh geometry={geometry} material={material} position={[structure.center.x, y, structure.center.z]} rotation={[0, structure.rotationY, 0]} scale={scale} castShadow={structure.yearIndex <= 18} receiveShadow />;
}

export function ReefYearStructuresObject({ core, manifest }: { core: ReefCoreManifest; manifest: ReefYearStructuresManifest }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5d6157', roughness: 0.96, metalness: 0.01 }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group position={[0, -core.platform.thickness * 0.52, 0]}>
      {manifest.structures.map((structure) => <YearMesh key={structure.id} structure={structure} material={material} />)}
    </group>
  );
}
