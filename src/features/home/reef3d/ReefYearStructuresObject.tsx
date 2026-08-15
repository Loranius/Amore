import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type {
  ReefCompositionManifest,
  ReefCoreManifest,
  ReefYearStructure,
} from '@/engine/species/reef';

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
    position.setXYZ(
      i,
      x,
      y * (0.7 + crest * 0.45) + Math.sin(x * 7 + phase) * 0.08,
      z + structure.shape.skew * x * 0.15,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function archGeometry(structure: ReefYearStructure) {
  const s = structure.shape;
  const phase = (structure.seed % 4096) / 4096 * Math.PI * 2;
  const leftLift = Math.sin(phase) * s.height * 0.045;
  const rightLift = Math.cos(phase * 1.7) * s.height * 0.04;
  const points = [
    new THREE.Vector3(-s.width * 0.5, -s.depth * 0.08, 0),
    new THREE.Vector3(-s.width * 0.35, s.height * (0.46 - s.openingAsymmetry * 0.09) + leftLift, s.depth * 0.08),
    new THREE.Vector3(s.skew * s.width * 0.18, s.height * 0.96, s.curveDepth * s.depth),
    new THREE.Vector3(s.width * 0.34, s.height * (0.54 + s.openingAsymmetry * 0.09) + rightLift, -s.depth * 0.06),
    new THREE.Vector3(s.width * 0.5, -s.depth * 0.10, 0),
  ];
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45),
    44,
    Math.max(0.12, s.depth * 0.31),
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
  const baseY = isArch
    ? -Math.max(0.035, structure.shape.depth * 0.08 * growth)
    : isBoulder
      ? structure.shape.height * 0.36 * growth
      : structure.shape.height * 0.43 * growth;
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[structure.center.x, baseY, structure.center.z]}
      rotation={[0, structure.rotationY, 0]}
      scale={scale}
      castShadow={structure.yearIndex <= 10 && structure.archetype !== 'ARCH'}
      receiveShadow
    />
  );
}

export function ReefYearStructuresObject({
  core,
  manifest,
}: {
  core: ReefCoreManifest;
  manifest: ReefCompositionManifest;
}) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#60665d', roughness: 0.98, metalness: 0.005 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group position={[0, -core.platform.thickness * 0.52, 0]}>
      {manifest.structures.map((structure) => (
        <YearMesh key={structure.id} structure={structure} material={material} />
      ))}
    </group>
  );
}
