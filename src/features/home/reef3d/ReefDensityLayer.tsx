import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { collectReefSupportMeshes, raycastReefSupport } from './reefSupportPlacement';

type SupportBed = {
  center: readonly [number, number];
  radius: readonly [number, number];
};

type BushCandidate = {
  seedIndex: number;
  bedIndex: number;
  rotation: number;
  scale: number;
  tone: number;
  spread: number;
};

type CushionCandidate = {
  seedIndex: number;
  bedIndex: number;
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  tone: number;
};

type OccupiedFootprint = {
  kind: 'cushion' | 'bush';
  x: number;
  z: number;
  baseY: number;
  radius: number;
  isCrown: boolean;
};

const BUSH_COUNT = 18;
const BUSH_ARMS = 5;
const CUSHION_COUNT = 12;
const MAX_PLACEMENT_ATTEMPTS = 18;
const CROWN_MIN_Y = 0.82;
const CROWN_CUSHION_LIMIT = 2;
const CROWN_BUSH_LIMIT = 1;
const BUSH_HEIGHT_PROFILE = [0.5, 0.66, 0.88, 0.64, 0.48] as const;

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

// Fewer colonies than before, but each one now reads as an actual five-stalk
// coral cluster instead of a single antenna. The tiny crown still gets one.
const BUSH_BED_INDICES = [2, 3, 2, 3, 1, 3, 2, 0, 3, 2, 4, 2, 3] as const;
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

function pointInBedRange(
  index: number,
  salt: number,
  attempt: number,
  bed: SupportBed,
  minRadius: number,
  maxRadius: number,
): readonly [number, number] {
  const retryIndex = index + attempt * 97;
  const angle = seededUnit(retryIndex, salt + attempt * 3) * Math.PI * 2;
  const radialSeed = Math.sqrt(seededUnit(retryIndex, salt + 1 + attempt * 5));
  const radius = THREE.MathUtils.lerp(minRadius, maxRadius, radialSeed);

  return [
    bed.center[0] + Math.cos(angle) * bed.radius[0] * radius,
    bed.center[1] + Math.sin(angle) * bed.radius[1] * radius,
  ];
}

function terraceScaleForBed(bedIndex: number): number {
  if (bedIndex === 4) return 0.62;
  if (bedIndex === 2 || bedIndex === 3) return 0.82;
  return 0.88;
}

function buildBushCandidates(): BushCandidate[] {
  return Array.from({ length: BUSH_COUNT }, (_, index) => {
    const bedIndex = BUSH_BED_INDICES[index % BUSH_BED_INDICES.length]!;

    return {
      seedIndex: index,
      bedIndex,
      rotation: seededUnit(index, 5) * Math.PI * 2,
      scale: heightBand(seededUnit(index, 3)) * terraceScaleForBed(bedIndex),
      tone: seededUnit(index, 6),
      spread: THREE.MathUtils.lerp(0.15, 0.24, seededUnit(index, 7)),
    };
  });
}

function buildCushionCandidates(): CushionCandidate[] {
  return Array.from({ length: CUSHION_COUNT }, (_, index) => {
    const bedIndex = CUSHION_BED_INDICES[index % CUSHION_BED_INDICES.length]!;
    const crownScale = bedIndex === 4 ? 0.62 : 0.9;
    const squash = THREE.MathUtils.lerp(0.13, 0.2, seededUnit(index, 13)) * crownScale;
    const width = THREE.MathUtils.lerp(0.21, 0.34, seededUnit(index, 14)) * crownScale;

    return {
      seedIndex: index,
      bedIndex,
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

function placementRadii(kind: 'cushion' | 'bush', bedIndex: number): readonly [number, number] {
  if (bedIndex === 4) {
    return kind === 'cushion' ? [0.12, 0.68] : [0.82, 0.99];
  }

  return kind === 'cushion' ? [0.08, 0.72] : [0.14, 0.82];
}

function verticalTolerance(a: OccupiedFootprint, b: OccupiedFootprint): number {
  if (a.kind !== b.kind) return 0.34;
  return a.kind === 'cushion' ? 0.28 : 0.24;
}

function horizontalClearance(a: OccupiedFootprint, b: OccupiedFootprint): number {
  let gap = 0.055;
  if (a.kind !== b.kind) gap = 0.115;
  else if (a.kind === 'cushion') gap = 0.04;

  if (a.isCrown || b.isCrown) gap += 0.045;
  return gap;
}

function canOccupy(candidate: OccupiedFootprint, occupied: readonly OccupiedFootprint[]): boolean {
  for (const item of occupied) {
    if (Math.abs(candidate.baseY - item.baseY) > verticalTolerance(candidate, item)) continue;

    const dx = candidate.x - item.x;
    const dz = candidate.z - item.z;
    const minimumDistance = candidate.radius + item.radius + horizontalClearance(candidate, item);
    if (dx * dx + dz * dz < minimumDistance * minimumDistance) return false;
  }

  return true;
}

function DensityCorals() {
  const bushMeshRef = useRef<THREE.InstancedMesh>(null);
  const footingRef = useRef<THREE.InstancedMesh>(null);
  const cushionMeshRef = useRef<THREE.InstancedMesh>(null);
  const scene = useThree((state) => state.scene);
  const bushes = useMemo(buildBushCandidates, []);
  const cushions = useMemo(buildCushionCandidates, []);
  const armCapacity = bushes.length * BUSH_ARMS;

  useEffect(() => {
    const bushMesh = bushMeshRef.current;
    const footingMesh = footingRef.current;
    const cushionMesh = cushionMeshRef.current;
    if (!bushMesh || !footingMesh || !cushionMesh) return;

    const supportMeshes = collectReefSupportMeshes(scene);
    if (supportMeshes.length === 0) {
      bushMesh.count = 0;
      footingMesh.count = 0;
      cushionMesh.count = 0;
      return;
    }

    const dummy = new THREE.Object3D();
    const occupied: OccupiedFootprint[] = [];

    const cushionDark = new THREE.Color('#596d59');
    const cushionLight = new THREE.Color('#91836a');
    const branchDark = new THREE.Color('#584a76');
    const branchLight = new THREE.Color('#b67d9f');
    const footingDark = new THREE.Color('#3d5854');
    const footingLight = new THREE.Color('#65736a');
    const color = new THREE.Color();
    const footingColor = new THREE.Color();

    let cushionInstanceIndex = 0;
    let bushInstanceIndex = 0;
    let footingInstanceIndex = 0;
    let crownCushions = 0;
    let crownBushes = 0;

    for (const cushion of cushions) {
      const bed = SUPPORT_BEDS[cushion.bedIndex]!;
      const [minimumRadius, maximumRadius] = placementRadii('cushion', cushion.bedIndex);
      const footprintRadius = Math.max(cushion.scale[0], cushion.scale[2]) * 0.98;

      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
        const [x, z] = pointInBedRange(
          cushion.seedIndex,
          11,
          attempt,
          bed,
          minimumRadius,
          maximumRadius,
        );
        const hit = raycastReefSupport(supportMeshes, x, z, 0.34);
        if (!hit) continue;

        const isCrown = hit.point.y >= CROWN_MIN_Y;
        if (isCrown && crownCushions >= CROWN_CUSHION_LIMIT) continue;

        const footprint: OccupiedFootprint = {
          kind: 'cushion',
          x,
          z,
          baseY: hit.point.y,
          radius: footprintRadius,
          isCrown,
        };
        if (!canOccupy(footprint, occupied)) continue;

        dummy.position.set(x, hit.point.y + cushion.scale[1] * 0.82, z);
        dummy.rotation.set(cushion.rotation[0], cushion.rotation[1], cushion.rotation[2]);
        dummy.scale.set(cushion.scale[0], cushion.scale[1], cushion.scale[2]);
        dummy.updateMatrix();
        cushionMesh.setMatrixAt(cushionInstanceIndex, dummy.matrix);
        color.copy(cushionDark).lerp(cushionLight, cushion.tone * 0.72);
        cushionMesh.setColorAt(cushionInstanceIndex, color);
        cushionInstanceIndex += 1;
        occupied.push(footprint);
        if (isCrown) crownCushions += 1;
        break;
      }
    }

    for (const bush of bushes) {
      const bed = SUPPORT_BEDS[bush.bedIndex]!;
      const [minimumRadius, maximumRadius] = placementRadii('bush', bush.bedIndex);
      const footprintRadius = 0.12 + bush.spread * 0.28;

      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
        const [x, z] = pointInBedRange(
          bush.seedIndex,
          1,
          attempt,
          bed,
          minimumRadius,
          maximumRadius,
        );
        const hit = raycastReefSupport(supportMeshes, x, z, 0.3);
        if (!hit) continue;

        const isCrown = hit.point.y >= CROWN_MIN_Y;
        if (isCrown && crownBushes >= CROWN_BUSH_LIMIT) continue;

        const footprint: OccupiedFootprint = {
          kind: 'bush',
          x,
          z,
          baseY: hit.point.y,
          radius: footprintRadius,
          isCrown,
        };
        if (!canOccupy(footprint, occupied)) continue;

        const footingWidth = 0.1 + bush.scale * 0.025;
        dummy.position.set(x, hit.point.y + 0.024, z);
        dummy.rotation.set(0.02, bush.rotation * 0.38, -0.015);
        dummy.scale.set(footingWidth * 1.25, 0.04, footingWidth);
        dummy.updateMatrix();
        footingMesh.setMatrixAt(footingInstanceIndex, dummy.matrix);
        footingColor.copy(footingDark).lerp(footingLight, bush.tone * 0.58);
        footingMesh.setColorAt(footingInstanceIndex, footingColor);
        footingInstanceIndex += 1;

        for (let armIndex = 0; armIndex < BUSH_ARMS; armIndex += 1) {
          const armOffset = armIndex - 2;
          const height = bush.scale * (BUSH_HEIGHT_PROFILE[armIndex]! + bush.tone * 0.06);
          const localAngle = bush.rotation + armOffset * bush.spread * 1.9;
          const outward = Math.abs(armOffset) * bush.spread * 0.72;
          const sideBias = armOffset === 0 ? 0 : armOffset > 0 ? 1 : -1;

          dummy.position.set(
            x + Math.cos(localAngle) * outward * 0.34,
            hit.point.y + 0.008 + height * 0.31,
            z + Math.sin(localAngle) * outward * 0.34,
          );
          dummy.rotation.set(
            Math.sin(localAngle) * sideBias * 0.18,
            localAngle,
            -Math.cos(localAngle) * armOffset * 0.14,
          );
          dummy.scale.set(
            0.66 + bush.tone * 0.14,
            height,
            0.66 + bush.tone * 0.14,
          );
          dummy.updateMatrix();
          bushMesh.setMatrixAt(bushInstanceIndex, dummy.matrix);
          color.copy(branchDark).lerp(
            branchLight,
            Math.min(1, 0.2 + bush.tone * 0.62 + (2 - Math.abs(armOffset)) * 0.08),
          );
          bushMesh.setColorAt(bushInstanceIndex, color);
          bushInstanceIndex += 1;
        }

        occupied.push(footprint);
        if (isCrown) crownBushes += 1;
        break;
      }
    }

    cushionMesh.count = cushionInstanceIndex;
    bushMesh.count = bushInstanceIndex;
    footingMesh.count = footingInstanceIndex;

    cushionMesh.instanceMatrix.needsUpdate = true;
    bushMesh.instanceMatrix.needsUpdate = true;
    footingMesh.instanceMatrix.needsUpdate = true;
    if (cushionMesh.instanceColor) cushionMesh.instanceColor.needsUpdate = true;
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    if (footingMesh.instanceColor) footingMesh.instanceColor.needsUpdate = true;
  }, [bushes, cushions, scene]);

  return (
    <>
      <instancedMesh ref={cushionMeshRef} args={[undefined, undefined, cushions.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.97} metalness={0} />
      </instancedMesh>

      <instancedMesh ref={footingRef} args={[undefined, undefined, bushes.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
      </instancedMesh>

      <instancedMesh ref={bushMeshRef} args={[undefined, undefined, armCapacity]}>
        <cylinderGeometry args={[0.03, 0.065, 0.62, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
      </instancedMesh>
    </>
  );
}

/**
 * Density pass: fewer but richer coral colonies, shared collision-aware placement
 * and a deliberately sparse crown around the authored hero coral.
 */
export function ReefDensityLayer() {
  return (
    <group name="reef-density-inner-growth">
      <DensityCorals />
    </group>
  );
}
