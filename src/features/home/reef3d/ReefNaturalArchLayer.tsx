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

export const REEF_NATURAL_ARCH_PASS = 'irregular-overlapping-limestone-chain-v1';
const MIN_MASSES_PER_ARCH = 12;
const MAX_MASSES_PER_ARCH = 18;
const TAU = Math.PI * 2;

type RockInstance = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
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

function buildArchInstances(
  arch: ReefGrowthArchPlacement,
  profile: ReefTerracedFoundationProfile,
): RockInstance[] {
  const [leftFoot, rightFoot] = reefArchFootPoints(arch);
  const leftY = sampleReefTerracedFoundation(profile, leftFoot.x, leftFoot.z).height;
  const rightY = sampleReefTerracedFoundation(profile, rightFoot.x, rightFoot.z).height;
  const massCount = THREE.MathUtils.clamp(
    Math.round(arch.span / Math.max(0.05, arch.thickness * 0.55)),
    MIN_MASSES_PER_ARCH,
    MAX_MASSES_PER_ARCH,
  );
  const crownDirection = stableUnit(arch.seed, 'natural-arch:crown-direction') < 0.5 ? -1 : 1;
  const phase = stableUnit(arch.seed, 'natural-arch:phase') * TAU;
  const depthPhase = stableUnit(arch.seed, 'natural-arch:depth-phase') * TAU;
  const crownSkew = crownDirection * arch.span * (
    0.07 + stableUnit(arch.seed, 'natural-arch:crown-skew') * 0.11
  );
  const heightScale = 0.84 + stableUnit(arch.seed, 'natural-arch:height') * 0.1;

  return Array.from({ length: massCount }, (_value, index) => {
    const t = massCount <= 1 ? 0.5 : index / (massCount - 1);
    const interior = Math.sin(Math.PI * t);
    const footWeight = Math.pow(Math.abs(t - 0.5) * 2, 1.28);
    const xNoise = Math.sin(t * TAU * 2.15 + phase) * arch.thickness * 0.42 * interior;
    const localX = THREE.MathUtils.lerp(-arch.span * 0.5, arch.span * 0.5, t)
      + crownSkew * interior * interior
      + xNoise;
    const localZ = arch.curveDepth * interior
      + Math.sin(t * TAU * 2.7 + depthPhase) * arch.thickness * 0.72 * interior
      + (stableUnit(arch.seed, `natural-arch:${index}:depth`) - 0.5)
        * arch.thickness
        * 0.5
        * interior;
    const world = localToWorld(arch, localX, localZ);
    const baseY = THREE.MathUtils.lerp(leftY, rightY, t);
    const crown = Math.pow(interior, 0.78) * arch.height * heightScale;
    const verticalNoise = Math.sin(t * TAU * 3.35 + phase * 0.7)
      * arch.thickness
      * 0.62
      * interior;
    const radius = arch.thickness
      * (1.03 + footWeight * 0.7)
      * (0.82 + stableUnit(arch.seed, `natural-arch:${index}:radius`) * 0.42);

    return {
      position: new THREE.Vector3(world.x, baseY + crown + verticalNoise, world.z),
      rotation: new THREE.Euler(
        (stableUnit(arch.seed, `natural-arch:${index}:rx`) - 0.5) * 0.42,
        arch.rotationY
          + (stableUnit(arch.seed, `natural-arch:${index}:ry`) - 0.5) * 0.72,
        (stableUnit(arch.seed, `natural-arch:${index}:rz`) - 0.5) * 0.5,
      ),
      scale: new THREE.Vector3(
        radius * (0.92 + stableUnit(arch.seed, `natural-arch:${index}:sx`) * 0.44),
        radius * (0.84 + stableUnit(arch.seed, `natural-arch:${index}:sy`) * 0.5),
        radius * (0.9 + stableUnit(arch.seed, `natural-arch:${index}:sz`) * 0.46),
      ),
    };
  });
}

/**
 * Visual year-arch layer made from overlapping eroded limestone masses.
 * The accepted arch mesh remains in the scene as an invisible support/raycast
 * surface, while this layer removes the continuous engineered-tunnel look.
 */
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
      }}
    >
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}
