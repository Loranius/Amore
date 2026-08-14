import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import { collectReefSupportMeshes, raycastReefSupport } from './reefSupportPlacement';

type SupportBed = {
  center: readonly [number, number];
  radius: readonly [number, number];
};

type BushCandidate = {
  seedIndex: number;
  bedIndex: number;
  morphotype: ReefColonyMorphotype;
  rotation: number;
  scale: number;
  tone: number;
  spread: number;
};

type CushionCandidate = {
  seedIndex: number;
  bedIndex: number;
  morphotype: ReefColonyMorphotype;
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

const BUSH_ARMS = 7;
const MAX_PLACEMENT_ATTEMPTS = 24;
const CROWN_MIN_Y = 0.82;
const CROWN_CUSHION_LIMIT = 3;
const CROWN_BUSH_LIMIT = 2;
const MAX_BUSH_CANDIDATES = 24;
const MAX_CUSHION_CANDIDATES = 20;
const BUSH_HEIGHT_PROFILE = [0.54, 0.7, 0.88, 1, 0.86, 0.68, 0.52] as const;

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

const FLEXIBLE_MORPHOTYPES = new Set<ReefColonyMorphotype>([
  'branching',
  'soft-coral',
  'sea-fan',
]);

export interface ReefDensityCandidateCounts {
  bushes: number;
  cushions: number;
  sourceColonies: number;
}

export function reefDensityCandidateCounts(build: ReefPreviewBuild): ReefDensityCandidateCounts {
  const flexible = build.layout.colonies.filter(
    (colony) => FLEXIBLE_MORPHOTYPES.has(colony.morphotype),
  ).length;
  return {
    bushes: Math.min(MAX_BUSH_CANDIDATES, flexible),
    cushions: Math.min(MAX_CUSHION_CANDIDATES, build.layout.colonies.length - flexible),
    sourceColonies: build.layout.colonies.length,
  };
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
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
  if (bedIndex === 4) return 0.78;
  if (bedIndex === 2 || bedIndex === 3) return 0.94;
  return 1;
}

function candidateBedIndex(
  colony: ReefPreviewBuild['layout']['colonies'][number],
  index: number,
): number {
  if ((colony.tier === 'anchor' || colony.emphasized) && index % 3 === 0) return 4;
  return Math.abs(colony.azimuthSectorIndex + colony.radialBand * 2 + index) % 4;
}

function buildBushCandidates(build: ReefPreviewBuild): BushCandidate[] {
  return build.layout.colonies
    .filter((colony) => FLEXIBLE_MORPHOTYPES.has(colony.morphotype))
    .slice(0, MAX_BUSH_CANDIDATES)
    .map((colony, index) => {
      const seedIndex = Math.abs(colony.seed) + index * 17;
      const bedIndex = candidateBedIndex(colony, index);
      const dataScale = 0.82
        + colony.maturity * 0.34
        + colony.weight * 0.18
        + (colony.emphasized ? 0.16 : 0);

      return {
        seedIndex,
        bedIndex,
        morphotype: colony.morphotype,
        rotation: colony.facingRad + seededUnit(seedIndex, 5) * 0.38,
        scale: THREE.MathUtils.clamp(
          dataScale * terraceScaleForBed(bedIndex),
          0.72,
          1.44,
        ),
        tone: seededUnit(seedIndex, 6),
        spread: THREE.MathUtils.lerp(0.2, 0.34, seededUnit(seedIndex, 7)),
      };
    });
}

function buildCushionCandidates(build: ReefPreviewBuild): CushionCandidate[] {
  return build.layout.colonies
    .filter((colony) => !FLEXIBLE_MORPHOTYPES.has(colony.morphotype))
    .slice(0, MAX_CUSHION_CANDIDATES)
    .map((colony, index) => {
      const seedIndex = Math.abs(colony.seed) + index * 23;
      const bedIndex = candidateBedIndex(colony, index);
      const crownScale = bedIndex === 4 ? 0.76 : 1;
      const dataScale = 0.88
        + colony.maturity * 0.28
        + colony.weight * 0.14
        + (colony.emphasized ? 0.12 : 0);
      const squash = THREE.MathUtils.lerp(0.2, 0.3, seededUnit(seedIndex, 13))
        * crownScale
        * dataScale;
      const width = THREE.MathUtils.lerp(0.36, 0.54, seededUnit(seedIndex, 14))
        * crownScale
        * dataScale;

      return {
        seedIndex,
        bedIndex,
        morphotype: colony.morphotype,
        rotation: [
          (seededUnit(seedIndex, 16) - 0.5) * 0.12,
          colony.facingRad,
          (seededUnit(seedIndex, 18) - 0.5) * 0.1,
        ],
        scale: [
          width,
          squash,
          width * THREE.MathUtils.lerp(0.84, 1.16, seededUnit(seedIndex, 19)),
        ],
        tone: seededUnit(seedIndex, 20),
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
  let gap = 0.025;
  if (a.kind !== b.kind) gap = 0.065;
  else if (a.kind === 'cushion') gap = 0.018;

  if (a.isCrown || b.isCrown) gap += 0.025;
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

function DensityCorals({ build }: { build: ReefPreviewBuild }) {
  const bushMeshRef = useRef<THREE.InstancedMesh>(null);
  const footingRef = useRef<THREE.InstancedMesh>(null);
  const cushionMeshRef = useRef<THREE.InstancedMesh>(null);
  const scene = useThree((state) => state.scene);
  const bushes = useMemo(() => buildBushCandidates(build), [build]);
  const cushions = useMemo(() => buildCushionCandidates(build), [build]);
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

    const cushionPalettes = {
      massive: [new THREE.Color('#a9584f'), new THREE.Color('#f3a36f')],
      plating: [new THREE.Color('#728f55'), new THREE.Color('#d4cf75')],
      encrusting: [new THREE.Color('#934d68'), new THREE.Color('#e58ca3')],
    } as const;
    const bushPalettes = {
      branching: [new THREE.Color('#b94f63'), new THREE.Color('#ffad98')],
      'soft-coral': [new THREE.Color('#7253ad'), new THREE.Color('#d8a4e5')],
      'sea-fan': [new THREE.Color('#466bb0'), new THREE.Color('#8bc8df')],
    } as const;
    const footingDark = new THREE.Color('#6f8151');
    const footingLight = new THREE.Color('#c4bc6f');
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
        const cushionPalette = cushionPalettes[cushion.morphotype as keyof typeof cushionPalettes]
          ?? cushionPalettes.massive;
        color.copy(cushionPalette[0]).lerp(cushionPalette[1], 0.24 + cushion.tone * 0.68);
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
      const footprintRadius = 0.16 + bush.spread * 0.42;

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

        const footingWidth = 0.18 + bush.scale * 0.045;
        dummy.position.set(x, hit.point.y + 0.035, z);
        dummy.rotation.set(0.02, bush.rotation * 0.38, -0.015);
        dummy.scale.set(footingWidth * 1.35, 0.075, footingWidth);
        dummy.updateMatrix();
        footingMesh.setMatrixAt(footingInstanceIndex, dummy.matrix);
        footingColor.copy(footingDark).lerp(footingLight, bush.tone * 0.58);
        footingMesh.setColorAt(footingInstanceIndex, footingColor);
        footingInstanceIndex += 1;

        for (let armIndex = 0; armIndex < BUSH_ARMS; armIndex += 1) {
          const armOffset = armIndex - 3;
          const height = bush.scale * (BUSH_HEIGHT_PROFILE[armIndex]! + bush.tone * 0.08);
          const localAngle = bush.rotation + armOffset * bush.spread * 1.42;
          const outward = Math.abs(armOffset) * bush.spread * 0.54;
          const sideBias = armOffset === 0 ? 0 : armOffset > 0 ? 1 : -1;

          dummy.position.set(
            x + Math.cos(localAngle) * outward * 0.46,
            hit.point.y + 0.018 + height * 0.38,
            z + Math.sin(localAngle) * outward * 0.46,
          );
          dummy.rotation.set(
            Math.sin(localAngle) * sideBias * 0.22,
            localAngle,
            -Math.cos(localAngle) * armOffset * 0.105,
          );
          dummy.scale.set(
            0.84 + bush.tone * 0.18,
            height,
            0.84 + bush.tone * 0.18,
          );
          dummy.updateMatrix();
          bushMesh.setMatrixAt(bushInstanceIndex, dummy.matrix);
          const bushPalette = bushPalettes[bush.morphotype as keyof typeof bushPalettes]
            ?? bushPalettes.branching;
          color.copy(bushPalette[0]).lerp(
            bushPalette[1],
            Math.min(1, 0.18 + bush.tone * 0.58 + (3 - Math.abs(armOffset)) * 0.07),
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
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.72} metalness={0} />
      </instancedMesh>

      <instancedMesh ref={footingRef} args={[undefined, undefined, bushes.length]}>
        <cylinderGeometry args={[1, 1.14, 1, 9]} />
        <meshStandardMaterial color="#ffffff" roughness={0.78} metalness={0} />
      </instancedMesh>

      <instancedMesh ref={bushMeshRef} args={[undefined, undefined, armCapacity]}>
        <cylinderGeometry args={[0.055, 0.115, 0.76, 7]} />
        <meshStandardMaterial color="#ffffff" roughness={0.68} metalness={0} />
      </instancedMesh>
    </>
  );
}

/**
 * Secondary canopy: portal-derived colonies are echoed as collision-aware
 * clusters on the artistic support. The accepted Reef Species meshes remain
 * the canonical data geometry; this pass only makes their density legible.
 */
export function ReefDensityLayer({ build }: { build: ReefPreviewBuild }) {
  return (
    <group name="reef-density-inner-growth">
      <DensityCorals build={build} />
    </group>
  );
}
