import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReefGrowthArchPlacement } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  createReefTerracedFoundationProfile,
  sampleReefTerracedFoundation,
  type ReefTerracedFoundationProfile,
} from './reefTerracedFoundation';
import { reefArchFootPoints } from './reefLimestoneArch';
import { useReefRockMaterials } from './useReefRockMaterials';

export const REEF_NATURAL_ARCH_PASS = 'fused-eroded-limestone-ribs-v5';
const MIN_MASSES_PER_ARCH = 6;
const MAX_MASSES_PER_ARCH = 9;
const TAU = Math.PI * 2;

type RockInstance = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  supportsCoral: boolean;
};

type ArchSample = {
  world: { x: number; z: number };
  baseY: number;
  interior: number;
};

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

function localToWorld(
  arch: ReefGrowthArchPlacement,
  localX: number,
  localZ: number,
): { x: number; z: number } {
  const cosine = Math.cos(arch.rotationY);
  const sine = Math.sin(arch.rotationY);
  return {
    x: arch.center.x + localX * cosine + localZ * sine,
    z: arch.center.z - localX * sine + localZ * cosine,
  };
}

function moveArchBesideVolcano(
  source: ReefGrowthArchPlacement,
  profile: ReefTerracedFoundationProfile,
): ReefGrowthArchPlacement {
  const originalRadius = Math.hypot(source.center.x, source.center.z);
  const baseAngle = originalRadius > 0.08
    ? Math.atan2(source.center.z, source.center.x)
    : stableUnit(source.seed, 'volcano-arch:fallback-angle') * TAU;
  const angle = baseAngle
    + (stableUnit(source.seed, 'volcano-arch:angle-jitter') - 0.5) * 0.3;
  const targetRadius = profile.radius * (
    1.14 + stableUnit(source.seed, 'volcano-arch:radius') * 0.16
  );

  return {
    ...source,
    center: {
      ...source.center,
      x: Math.cos(angle) * Math.max(originalRadius, targetRadius),
      z: Math.sin(angle) * Math.max(originalRadius, targetRadius),
    },
    rotationY: angle
      + Math.PI * 0.5
      + (stableUnit(source.seed, 'volcano-arch:tangent-jitter') - 0.5) * 0.24,
  };
}

function archSample({
  arch,
  leftY,
  rightY,
  t,
  phase,
  depthPhase,
  crownSkew,
}: {
  arch: ReefGrowthArchPlacement;
  leftY: number;
  rightY: number;
  t: number;
  phase: number;
  depthPhase: number;
  crownSkew: number;
}): ArchSample {
  const interior = Math.sin(Math.PI * t);
  const localX = THREE.MathUtils.lerp(-arch.span * 0.5, arch.span * 0.5, t)
    + crownSkew * interior * interior
    + Math.sin(t * TAU * 1.55 + phase) * arch.thickness * 0.22 * interior;
  const localZ = arch.curveDepth * interior
    + Math.sin(t * TAU * 1.7 + depthPhase) * arch.thickness * 0.34 * interior;

  return {
    world: localToWorld(arch, localX, localZ),
    baseY: THREE.MathUtils.lerp(leftY, rightY, t),
    interior,
  };
}

function buildArchInstances(
  sourceArch: ReefGrowthArchPlacement,
  profile: ReefTerracedFoundationProfile,
): RockInstance[] {
  const arch = moveArchBesideVolcano(sourceArch, profile);
  const [leftFoot, rightFoot] = reefArchFootPoints(arch);
  const leftY = sampleReefTerracedFoundation(profile, leftFoot.x, leftFoot.z).height;
  const rightY = sampleReefTerracedFoundation(profile, rightFoot.x, rightFoot.z).height;
  const massCount = THREE.MathUtils.clamp(
    Math.round(arch.span / Math.max(0.08, arch.thickness * 1.12)),
    MIN_MASSES_PER_ARCH,
    MAX_MASSES_PER_ARCH,
  );
  const phase = stableUnit(arch.seed, 'natural-arch:phase') * TAU;
  const depthPhase = stableUnit(arch.seed, 'natural-arch:depth-phase') * TAU;
  const crownDirection = stableUnit(arch.seed, 'natural-arch:crown-direction') < 0.5 ? -1 : 1;
  const crownSkew = crownDirection * arch.span * (
    0.06 + stableUnit(arch.seed, 'natural-arch:crown-skew') * 0.08
  );
  const heightScale = 0.84 + stableUnit(arch.seed, 'natural-arch:height') * 0.12;
  const coralSlotPhase = stableUnit(arch.seed, 'natural-arch:coral-slot-phase') < 0.5 ? 0 : 1;

  const samples = Array.from({ length: massCount }, (_value, index) => archSample({
    arch,
    leftY,
    rightY,
    t: massCount <= 1 ? 0.5 : index / (massCount - 1),
    phase,
    depthPhase,
    crownSkew,
  }));

  const chain = samples.map((sample, index): RockInstance => {
    const t = massCount <= 1 ? 0.5 : index / (massCount - 1);
    const footWeight = Math.pow(Math.abs(t - 0.5) * 2, 1.5);
    const previous = samples[Math.max(0, index - 1)] ?? sample;
    const next = samples[Math.min(samples.length - 1, index + 1)] ?? sample;
    const tangentX = next.world.x - previous.world.x;
    const tangentZ = next.world.z - previous.world.z;
    const tangentYaw = Math.atan2(-tangentZ, tangentX);
    const radius = arch.thickness
      * (1.02 + footWeight * 0.54)
      * (0.94 + stableUnit(arch.seed, `natural-arch:${index}:radius`) * 0.18);
    const crown = Math.pow(sample.interior, 0.6) * arch.height * heightScale;
    const verticalNoise = Math.sin(t * TAU * 1.8 + phase * 0.7)
      * arch.thickness
      * 0.22
      * sample.interior;
    const insideLivingBand = sample.interior > 0.18;
    const sparseSlot = index % 2 === coralSlotPhase;

    return {
      position: new THREE.Vector3(
        sample.world.x,
        sample.baseY + crown + verticalNoise - radius * (0.2 + sample.interior * 0.08),
        sample.world.z,
      ),
      rotation: new THREE.Euler(
        (stableUnit(arch.seed, `natural-arch:${index}:rx`) - 0.5) * 0.18,
        tangentYaw + (stableUnit(arch.seed, `natural-arch:${index}:ry`) - 0.5) * 0.14,
        (stableUnit(arch.seed, `natural-arch:${index}:rz`) - 0.5) * 0.2,
      ),
      scale: new THREE.Vector3(
        radius * (2.05 + stableUnit(arch.seed, `natural-arch:${index}:sx`) * 0.34),
        radius * (0.68 + footWeight * 0.36 + stableUnit(arch.seed, `natural-arch:${index}:sy`) * 0.16),
        radius * (1.02 + stableUnit(arch.seed, `natural-arch:${index}:sz`) * 0.18),
      ),
      // Only alternating interior masses publish a coral slot. The phase is
      // deterministic per arch, leaving large stretches of readable bare rock
      // while still guaranteeing several viable attachment points on long ribs.
      supportsCoral: insideLivingBand && sparseSlot,
    };
  });

  const buttresses = [
    { foot: leftFoot, y: leftY, side: -1 },
    { foot: rightFoot, y: rightY, side: 1 },
  ].map(({ foot, y, side }, footIndex): RockInstance => {
    const inward = localToWorld(
      arch,
      side * arch.span * 0.36,
      arch.curveDepth * 0.1,
    );
    const inwardDirection = new THREE.Vector3(
      inward.x - foot.x,
      0,
      inward.z - foot.z,
    ).normalize();
    const yaw = Math.atan2(-inwardDirection.z, inwardDirection.x);
    const baseScale = arch.thickness * (
      1.75 + stableUnit(arch.seed, `buttress:${footIndex}:scale`) * 0.18
    );

    return {
      position: new THREE.Vector3(
        foot.x + inwardDirection.x * arch.thickness * 0.7,
        y + baseScale * 0.22,
        foot.z + inwardDirection.z * arch.thickness * 0.7,
      ),
      rotation: new THREE.Euler(
        (stableUnit(arch.seed, `buttress:${footIndex}:rx`) - 0.5) * 0.12,
        yaw,
        side * 0.07,
      ),
      scale: new THREE.Vector3(
        baseScale * 1.8,
        baseScale * 0.72,
        baseScale * 1.08,
      ),
      supportsCoral: false,
    };
  });

  return [...buttresses, ...chain];
}

export function ReefNaturalArchLayer({ build }: { build: ReefPreviewBuild }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rockMaterials = useReefRockMaterials();
  const profile = useMemo(() => createReefTerracedFoundationProfile({
    radius: build.structures.visibleFoundationRadius,
    verticalScale: build.structures.foundationScaleY,
    seed: build.species.moduleEvolution.identitySeed,
  }), [
    build.species.moduleEvolution.identitySeed,
    build.structures.foundationScaleY,
    build.structures.visibleFoundationRadius,
  ]);
  const instances = useMemo(
    () => build.structures.arches.flatMap((arch) => buildArchInstances(arch, profile)),
    [build.structures.arches, profile],
  );
  const attachmentSlots = useMemo(() => instances
    .filter((instance) => instance.supportsCoral)
    .map((instance, index) => ({
      id: `reef:natural-arch:coral-slot:${index}`,
      position: {
        x: instance.position.x,
        y: instance.position.y + instance.scale.y * 0.66,
        z: instance.position.z,
      },
      radius: Math.max(0.09, Math.min(instance.scale.x, instance.scale.z) * 0.34),
    })), [instances]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();

    instances.forEach((instance, index) => {
      quaternion.setFromEuler(instance.rotation);
      matrix.compose(instance.position, quaternion, instance.scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      name="reef-natural-year-arches"
      args={[undefined, undefined, instances.length]}
      material={rockMaterials.arch}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      userData={{
        reefNaturalArchPass: REEF_NATURAL_ARCH_PASS,
        reefNaturalArchMassCount: instances.length,
        reefNaturalArchCoralSlotCount: attachmentSlots.length,
        reefNaturalArchVolcanoOffset: true,
        reefSupportSurface: true,
        reefSupportSurfaceKind: 'arch',
        reefCoralAttachmentSlots: attachmentSlots,
      }}
    >
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}
