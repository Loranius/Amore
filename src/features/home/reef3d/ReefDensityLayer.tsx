import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { collectReefSupportMeshes, raycastReefSupport } from './reefSupportPlacement';

type SupportBed = {
  center: readonly [number, number];
  radius: readonly [number, number];
};

type BushCandidate = {
  x: number;
  z: number;
  rotation: number;
  scale: number;
  tone: number;
  spread: number;
};

type CushionCandidate = {
  x: number;
  z: number;
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  tone: number;
};

const BUSH_COUNT = 26;
const CUSHION_COUNT = 12;

/**
 * These are candidate domains only. Final Y placement still requires a real
 * downward ray hit on reef-hero-support, so no candidate can float in air.
 */
const SUPPORT_BEDS: readonly SupportBed[] = [
  { center: [-0.82, 0.47], radius: [0.9, 0.58] },
  { center: [0.62, 0.22], radius: [0.82, 0.54] },
  { center: [-0.23, -0.36], radius: [0.68, 0.46] },
  { center: [0.38, 0.01], radius: [0.56, 0.4] },
  { center: [-0.12, 0.06], radius: [0.42, 0.31] },
] as const;

// Stage 4 deliberately biases branching growth toward the middle/crown beds.
// Beds 0/1 still receive a few accents so the silhouette does not collapse into
// one central bouquet, but most cheap branch props now live on 2/3/4.
const BUSH_BED_INDICES = [2, 3, 4, 3, 4, 2, 3, 4, 1, 3, 4, 2, 0] as const;
const CUSHION_BED_INDICES = [0, 1, 2, 3, 4, 2, 3] as const;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function heightBand(seed: number): number {
  if (seed < 0.3) return THREE.MathUtils.lerp(0.55, 0.72, seed / 0.3);
  if (seed < 0.8) return THREE.MathUtils.lerp(0.74, 1.02, (seed - 0.3) / 0.5);
  return THREE.MathUtils.lerp(1.04, 1.26, (seed - 0.8) / 0.2);
}

function pointInBed(
  index: number,
  salt: number,
  bed: SupportBed,
  inset: number,
): readonly [number, number] {
  const angle = seededUnit(index, salt) * Math.PI * 2;
  const radius = Math.sqrt(seededUnit(index, salt + 1)) * inset;
  return [
    bed.center[0] + Math.cos(angle) * bed.radius[0] * radius,
    bed.center[1] + Math.sin(angle) * bed.radius[1] * radius,
  ];
}

function terraceScaleForBed(bedIndex: number): number {
  if (bedIndex === 4) return 0.76;
  if (bedIndex === 2 || bedIndex === 3) return 0.82;
  return 0.88;
}

function buildBushCandidates(): BushCandidate[] {
  return Array.from({ length: BUSH_COUNT }, (_, index) => {
    const bedIndex = BUSH_BED_INDICES[index % BUSH_BED_INDICES.length]!;
    const bed = SUPPORT_BEDS[bedIndex]!;
    const inset = bedIndex === 4 ? 0.42 : bedIndex === 2 || bedIndex === 3 ? 0.5 : 0.56;
    const [x, z] = pointInBed(index, 1, bed, inset);

    return {
      x,
      z,
      rotation: seededUnit(index, 5) * Math.PI * 2,
      scale: heightBand(seededUnit(index, 3)) * terraceScaleForBed(bedIndex),
      tone: seededUnit(index, 6),
      spread: THREE.MathUtils.lerp(0.14, 0.22, seededUnit(index, 7)),
    };
  });
}

function buildCushionCandidates(): CushionCandidate[] {
  return Array.from({ length: CUSHION_COUNT }, (_, index) => {
    const bedIndex = CUSHION_BED_INDICES[index % CUSHION_BED_INDICES.length]!;
    const bed = SUPPORT_BEDS[bedIndex]!;
    const inset = bedIndex === 4 ? 0.46 : 0.54;
    const [x, z] = pointInBed(index, 11, bed, inset);
    const crownScale = bedIndex === 4 ? 0.72 : 0.9;
    const squash = THREE.MathUtils.lerp(0.13, 0.2, seededUnit(index, 13)) * crownScale;
    const width = THREE.MathUtils.lerp(0.21, 0.34, seededUnit(index, 14)) * crownScale;

    return {
      x,
      z,
      rotation: [
        (seededUnit(index, 16) - 0.5) * 0.1,
        seededUnit(index, 17) * Math.PI * 2,
        (seededUnit(index, 18) - 0.5) * 0.08,
      ],
      scale: [width, squash, width * THREE.MathUtils.lerp(0.84, 1.14, seededUnit(index, 19))],
      tone: seededUnit(index, 20),
    };
  });
}

function BushCorals() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scene = useThree((state) => state.scene);
  const candidates = useMemo(buildBushCandidates, []);
  const armCapacity = candidates.length * 3;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const supportMeshes = collectReefSupportMeshes(scene);
    if (supportMeshes.length === 0) {
      mesh.count = 0;
      return;
    }

    const dummy = new THREE.Object3D();
    const dark = new THREE.Color('#645982');
    const light = new THREE.Color('#9a718d');
    const color = new THREE.Color();
    let instanceIndex = 0;

    for (const bush of candidates) {
      const hit = raycastReefSupport(supportMeshes, bush.x, bush.z, 0.3);
      if (!hit) continue;

      for (let armIndex = 0; armIndex < 3; armIndex += 1) {
        const armOffset = armIndex - 1;
        const height = bush.scale * (0.56 + armIndex * 0.09);
        const localAngle = bush.rotation + armOffset * bush.spread * 2.8;
        const outward = Math.abs(armOffset) * bush.spread;

        dummy.position.set(
          bush.x + Math.cos(localAngle) * outward * 0.3,
          hit.point.y + 0.008 + height * 0.31,
          bush.z + Math.sin(localAngle) * outward * 0.3,
        );
        dummy.rotation.set(
          Math.sin(localAngle) * armOffset * 0.15,
          localAngle,
          -Math.cos(localAngle) * armOffset * 0.18,
        );
        dummy.scale.set(
          0.82 + bush.tone * 0.2,
          height,
          0.82 + bush.tone * 0.2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(instanceIndex, dummy.matrix);

        color.copy(dark).lerp(light, Math.min(1, bush.tone * 0.72 + armIndex * 0.12));
        mesh.setColorAt(instanceIndex, color);
        instanceIndex += 1;
      }
    }

    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [candidates, scene]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, armCapacity]}>
      <cylinderGeometry args={[0.032, 0.072, 0.62, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
    </instancedMesh>
  );
}

function CushionCorals() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scene = useThree((state) => state.scene);
  const candidates = useMemo(buildCushionCandidates, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const supportMeshes = collectReefSupportMeshes(scene);
    if (supportMeshes.length === 0) {
      mesh.count = 0;
      return;
    }

    const dummy = new THREE.Object3D();
    const dark = new THREE.Color('#667866');
    const light = new THREE.Color('#8f816d');
    const color = new THREE.Color();
    let instanceIndex = 0;

    for (const cushion of candidates) {
      const hit = raycastReefSupport(supportMeshes, cushion.x, cushion.z, 0.34);
      if (!hit) continue;

      dummy.position.set(
        cushion.x,
        hit.point.y + cushion.scale[1] * 0.82,
        cushion.z,
      );
      dummy.rotation.set(cushion.rotation[0], cushion.rotation[1], cushion.rotation[2]);
      dummy.scale.set(cushion.scale[0], cushion.scale[1], cushion.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(instanceIndex, dummy.matrix);
      color.copy(dark).lerp(light, cushion.tone * 0.72);
      mesh.setColorAt(instanceIndex, color);
      instanceIndex += 1;
    }

    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [candidates, scene]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, candidates.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.97} metalness={0} />
    </instancedMesh>
  );
}

/**
 * Stage 4 density pass: branching accents are concentrated toward the inner
 * terraces, while every visible prop still requires a real hero-support hit.
 */
export function ReefDensityLayer() {
  return (
    <group name="reef-density-inner-growth">
      <CushionCorals />
      <BushCorals />
    </group>
  );
}
