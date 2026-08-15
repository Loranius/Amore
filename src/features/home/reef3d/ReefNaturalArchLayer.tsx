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

export const REEF_NATURAL_ARCH_PASS = 'eroded-overlapping-limestone-backbone-v2';
const MIN_MASSES_PER_ARCH = 9;
const MAX_MASSES_PER_ARCH = 13;
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
    Math.round(arch.span / Math.max(0.06, arch.thickness * 0.74)),
    MIN_MASSES_PER_ARCH,
    MAX_MASSES_PER_ARCH,
  );
  const phase = stableUnit(arch.seed, 'natural-arch:phase') * TAU;
  const depthPhase = stableUnit(arch.seed, 'natural-arch:depth-phase') * TAU;
  const crownDirection = stableUnit(arch.seed, 'natural-arch:crown-direction') < 0.5 ? -1 : 1;
  const crownSkew = crownDirection * arch.span * (
    0.08 + stableUnit(arch.seed, 'natural-arch:crown-skew') * 0.1
  );
  const heightScale = 0.88 + stableUnit(arch.seed, 'natural-arch:height') * 0.12;

  const chain = Array.from({ length: massCount }, (_value, index): RockInstance => {
    const t = massCount <= 1 ? 0.5 : index / (massCount - 1);
    const interior = Math.sin(Math.PI * t);
    const footWeight = Math.pow(Math.abs(t - 0.5) * 2, 1.7);
    const xNoise = Math.sin(t * TAU * 1.7 + phase) * arch.thickness * 0.38 * interior;
    const localX = THREE.MathUtils.lerp(-arch.span * 0.5, arch.span * 0.5, t)
      + crownSkew * interior * interior
      + xNoise;
    const localZ = arch.curveDepth * interior
      + Math.sin(t * TAU * 1.9 + depthPhase) * arch.thickness * 0.62 * interior
      + (stableUnit(arch.seed, `natural-arch:${index}:depth`) - 0.5)
        * arch.thickness
        * 0.44
        * interior;
    const world = localToWorld(arch, localX, localZ);
    const baseY = THREE.MathUtils.lerp(leftY, rightY, t);
    const crown = Math.pow(interior, 0.72) * arch.height * heightScale;
    const verticalNoise = Math.sin(t * TAU * 2.2 + phase * 0.73)
      * arch.thickness
      * 0.48
      * interior;
    const radius = arch.thickness
      * (1.18 + footWeight * 0.92)
      * (0.9 + stableUnit(arch.seed, `natural-arch:${index}:radius`) * 0.28);

    return {
      position: new THREE.Vector3(world.x, baseY + crown + verticalNoise, world.z),
      rotation: new THREE.Euler(
        (stableUnit(arch.seed, `natural-arch:${index}:rx`) - 0.5) * 0.34,
        arch.rotationY
          + (stableUnit(arch.seed, `natural-arch:${index}:ry`) - 0.5) * 0.48,
        (stableUnit(arch.seed, `natural-arch:${index}:rz`) - 0.5) * 0.38,
      ),
      // Broad overlap along the arch tangent removes the bead-chain silhouette.
      scale: new THREE.Vector3(
        radius * (1.2 + stableUnit(arch.seed, `natural-arch:${index}:sx`) * 0.34),
        radius * (0.84 + footWeight * 0.34 + stableUnit(arch.seed, `natural-arch:${index}:sy`) * 0.28),
        radius * (0.92 + stableUnit(arch.seed, `natural-arch:${index}:sz`) * 0.28),
      ),
    };
  });

  // Two buried buttresses make each foot visually grow from the foundation
  // rather than balancing on a single polygonal rock.
  const buttresses = [
    { foot: leftFoot, y: leftY, side: -1 },
    { foot: rightFoot, y: rightY, side: 1 },
  ].flatMap(({ foot, y, side }, footIndex): RockInstance[] => {
    const inward = localToWorld(
      arch,
      side * arch.span * 0.38,
      arch.curveDepth * 0.08,
    );
    const towardCenter = new THREE.Vector3(inward.x - foot.x, 0, inward.z - foot.z).normalize();
    return [0, 1].map((layer) => {
      const scale = arch.thickness * (2.05 - layer * 0.42);
      return {
        position: new THREE.Vector3(
          foot.x + towardCenter.x * arch.thickness * (0.36 + layer * 0.48),
          y + scale * (0.34 + layer * 0.42),
          foot.z + towardCenter.z * arch.thickness * (0.36 + layer * 0.48),
        ),
        rotation: new THREE.Euler(
          (stableUnit(arch.seed, `buttress:${footIndex}:${layer}:rx`) - 0.5) * 0.22,
          arch.rotationY + side * (0.12 + layer * 0.08),
          side * (0.08 + layer * 0.05),
        ),
        scale: new THREE.Vector3(
          scale * (1.18 + layer * 0.08),
          scale * (0.78 + layer * 0.12),
          scale * 0.9,
        ),
      };
    });
  });

  return [...buttresses, ...chain];
}

/**
 * Visual year-arch layer made from broad, overlapping eroded limestone masses.
 * The accepted continuous arch remains invisible as support/raycast geometry;
 * the visible silhouette has heavier feet, an irregular crown and no repeated
 * bead-chain rhythm.
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
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  );
}
