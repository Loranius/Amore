import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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

export const REEF_NATURAL_ARCH_PASS = 'eroded-overlapping-limestone-backbone-v3';
const MIN_MASSES_PER_ARCH = 7;
const MAX_MASSES_PER_ARCH = 10;
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

/**
 * One deliberately asymmetric low-poly limestone mass. Instance rotation and
 * strongly non-uniform scale do the remaining variation without adding draw
 * calls or loading another hero-rock asset on mobile.
 */
function buildErodedRockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.getAttribute('position');

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const broadWave = Math.sin(x * 3.1 + z * 2.4) * 0.09;
    const crossWave = Math.cos(y * 4.3 - x * 2.7 + z * 1.8) * 0.065;
    const radial = 1 + broadWave + crossWave;
    const upperChip = y > 0.42
      ? 0.93 + Math.sin(x * 5.7 - z * 3.2) * 0.035
      : 1;

    positions.setXYZ(
      index,
      x * radial + y * z * 0.085,
      y * radial * upperChip + x * z * 0.045,
      z * radial - x * y * 0.07,
    );
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
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
    Math.round(arch.span / Math.max(0.06, arch.thickness * 0.94)),
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
    const xNoise = Math.sin(t * TAU * 1.7 + phase) * arch.thickness * 0.32 * interior;
    const localX = THREE.MathUtils.lerp(-arch.span * 0.5, arch.span * 0.5, t)
      + crownSkew * interior * interior
      + xNoise;
    const localZ = arch.curveDepth * interior
      + Math.sin(t * TAU * 1.9 + depthPhase) * arch.thickness * 0.54 * interior
      + (stableUnit(arch.seed, `natural-arch:${index}:depth`) - 0.5)
        * arch.thickness
        * 0.38
        * interior;
    const world = localToWorld(arch, localX, localZ);
    const baseY = THREE.MathUtils.lerp(leftY, rightY, t);
    const crown = Math.pow(interior, 0.72) * arch.height * heightScale;
    const verticalNoise = Math.sin(t * TAU * 2.2 + phase * 0.73)
      * arch.thickness
      * 0.38
      * interior;
    const radius = arch.thickness
      * (1.24 + footWeight * 0.84)
      * (0.92 + stableUnit(arch.seed, `natural-arch:${index}:radius`) * 0.24);
    const shapeRoll = stableUnit(arch.seed, `natural-arch:${index}:shape`);

    // Three scale families break the repeated round-boulder rhythm while all
    // masses still use the same instanced geometry and material.
    const shape = shapeRoll < 0.34
      ? { tangent: 1.78, vertical: 0.66, depth: 1.02 } // low slab
      : shapeRoll < 0.68
        ? { tangent: 1.38, vertical: 1.02, depth: 0.84 } // compact shoulder
        : { tangent: 1.54, vertical: 0.78, depth: 1.3 }; // broad weathered block
    const burial = radius * (
      0.15
      + stableUnit(arch.seed, `natural-arch:${index}:burial`) * 0.13
      + footWeight * 0.06
    );
    const slopeTilt = (0.5 - t) * (0.38 + interior * 0.16);

    return {
      // Sink every visible lobe into the accepted continuous support. This is
      // what makes the formation read as one eroded mass instead of stacked
      // stones while preserving the year-arch topology for the next pass.
      position: new THREE.Vector3(
        world.x,
        baseY + crown + verticalNoise - burial,
        world.z,
      ),
      rotation: new THREE.Euler(
        (stableUnit(arch.seed, `natural-arch:${index}:rx`) - 0.5) * 0.58,
        arch.rotationY
          + (stableUnit(arch.seed, `natural-arch:${index}:ry`) - 0.5) * 0.78,
        slopeTilt
          + (stableUnit(arch.seed, `natural-arch:${index}:rz`) - 0.5) * 0.42,
      ),
      scale: new THREE.Vector3(
        radius
          * shape.tangent
          * (0.94 + stableUnit(arch.seed, `natural-arch:${index}:sx`) * 0.22),
        radius
          * shape.vertical
          * (0.92 + stableUnit(arch.seed, `natural-arch:${index}:sy`) * 0.2),
        radius
          * shape.depth
          * (0.92 + stableUnit(arch.seed, `natural-arch:${index}:sz`) * 0.22),
      ),
    };
  });

  // Broad, partially buried buttresses erase the two tell-tale "end stones"
  // and make both sides emerge from the same limestone substrate.
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
      const scale = arch.thickness * (2.18 - layer * 0.46);
      const rx = (stableUnit(arch.seed, `buttress:${footIndex}:${layer}:rx`) - 0.5)
        * 0.36;
      return {
        position: new THREE.Vector3(
          foot.x + towardCenter.x * arch.thickness * (0.42 + layer * 0.5),
          y + scale * (0.22 + layer * 0.34),
          foot.z + towardCenter.z * arch.thickness * (0.42 + layer * 0.5),
        ),
        rotation: new THREE.Euler(
          rx,
          arch.rotationY + side * (0.15 + layer * 0.11),
          side * (0.13 + layer * 0.08),
        ),
        scale: new THREE.Vector3(
          scale * (1.4 + layer * 0.08),
          scale * (0.62 + layer * 0.1),
          scale * (1.02 - layer * 0.08),
        ),
      };
    });
  });

  return [...buttresses, ...chain];
}

/**
 * Visual year-arch layer made from broad, overlapping eroded limestone masses.
 * The accepted continuous arch remains the support/raycast backbone; this pass
 * only removes the repeated spherical "boulder pile" silhouette.
 */
export function ReefNaturalArchLayer({ build }: { build: ReefPreviewBuild }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rockMaterials = useReefRockMaterials();
  const rockGeometry = useMemo(() => buildErodedRockGeometry(), []);
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

  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);

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
      geometry={rockGeometry}
      material={rockMaterials.arch}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      userData={{
        reefNaturalArchPass: REEF_NATURAL_ARCH_PASS,
        reefNaturalArchMassCount: instances.length,
      }}
    />
  );
}
