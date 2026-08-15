import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ReefCoreManifest } from '@/engine/species/reef';

const VOLCANO_RADIAL_SEGMENTS = 72;
const VOLCANO_SLOPE_RINGS = 24;
const VOLCANO_CRATER_RINGS = 6;

function volcanoNoise(core: ReefCoreManifest, angle: number, t: number) {
  const { phaseA, phaseB, ruggedness } = core.morphology;
  const macro =
    Math.sin(angle * 3 + phaseA + t * 2.1) * 0.46
    + Math.cos(angle * 5 - phaseB - t * 1.4) * 0.32
    + Math.sin(angle * 8 + phaseB * 0.7 + t * 3.6) * 0.22;
  const terraces = Math.sin(t * Math.PI * 5.4 + phaseA) * 0.22
    + Math.cos(t * Math.PI * 8.2 - phaseB) * 0.12;
  return macro * (0.82 + ruggedness * 0.65) + terraces;
}

function volcanoRimRadius(core: ReefCoreManifest) {
  return 0.21 + core.morphology.shoulderBias * 0.018;
}

function volcanoOuterPoint(
  core: ReefCoreManifest,
  angle: number,
  t: number,
): THREE.Vector3 {
  const {
    ruggedness,
    asymmetry,
    phaseA,
    leanX,
    leanZ,
  } = core.morphology;
  const rimRadius = volcanoRimRadius(core);
  const noise = volcanoNoise(core, angle, t);
  const baseY = -core.platform.thickness * 0.14;
  const summitHeight = core.dimensions.height * 0.92;

  // Broad shield-like foot that tightens into an uneven volcanic cone.
  const coneProfile = rimRadius + (1 - rimRadius) * Math.pow(1 - t, 0.68);
  const lowerShoulder = 1 + Math.sin(Math.PI * Math.min(1, t / 0.42)) * 0.075 * (1 - t);
  const asymmetryBias = 1 + asymmetry * 0.72 * Math.cos(angle - phaseA);
  const roughness = 1 + noise * (0.035 + ruggedness * 0.11) * (0.72 + (1 - t) * 0.28);
  const radial = Math.max(rimRadius * 0.78, coneProfile * lowerShoulder * asymmetryBias * roughness);

  const localHeight = Math.pow(t, 0.9) * summitHeight;
  const ridgeHeight = noise * core.dimensions.height * (0.008 + ruggedness * 0.018) * (0.35 + t * 0.65);
  const leanFactor = t * t * 0.52;

  return new THREE.Vector3(
    Math.cos(angle) * core.dimensions.radiusX * radial
      + leanX * core.dimensions.height * leanFactor,
    baseY + localHeight + ridgeHeight,
    Math.sin(angle) * core.dimensions.radiusZ * radial
      + leanZ * core.dimensions.height * leanFactor,
  );
}

function createVolcanoOuterGeometry(core: ReefCoreManifest): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const stride = VOLCANO_RADIAL_SEGMENTS + 1;

  for (let ring = 0; ring <= VOLCANO_SLOPE_RINGS; ring += 1) {
    const t = ring / VOLCANO_SLOPE_RINGS;
    for (let segment = 0; segment <= VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const angle = segment / VOLCANO_RADIAL_SEGMENTS * Math.PI * 2;
      const point = volcanoOuterPoint(core, angle, t);
      positions.push(point.x, point.y, point.z);
    }
  }

  for (let ring = 0; ring < VOLCANO_SLOPE_RINGS; ring += 1) {
    for (let segment = 0; segment < VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const a = ring * stride + segment;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createVolcanoCraterGeometry(core: ReefCoreManifest): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const stride = VOLCANO_RADIAL_SEGMENTS + 1;
  const rimRadius = volcanoRimRadius(core);
  const craterDepth = core.dimensions.height * (0.17 + core.morphology.ruggedness * 0.035);

  for (let ring = 0; ring <= VOLCANO_CRATER_RINGS; ring += 1) {
    const u = ring / VOLCANO_CRATER_RINGS;
    for (let segment = 0; segment <= VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const angle = segment / VOLCANO_RADIAL_SEGMENTS * Math.PI * 2;
      const rim = volcanoOuterPoint(core, angle, 1);
      const noise = volcanoNoise(core, angle, 1 - u * 0.28);
      const innerRadius = rimRadius * (1 - u * 0.78) * (1 + noise * 0.035);
      const rimRadial = Math.max(0.0001, Math.hypot(
        rim.x - core.morphology.leanX * core.dimensions.height * 0.52,
        rim.z - core.morphology.leanZ * core.dimensions.height * 0.52,
      ));
      const targetX = Math.cos(angle) * core.dimensions.radiusX * innerRadius
        + core.morphology.leanX * core.dimensions.height * 0.52;
      const targetZ = Math.sin(angle) * core.dimensions.radiusZ * innerRadius
        + core.morphology.leanZ * core.dimensions.height * 0.52;
      const blend = Math.min(1, u * 1.08);
      const x = THREE.MathUtils.lerp(rim.x, targetX, blend);
      const z = THREE.MathUtils.lerp(rim.z, targetZ, blend);
      const bowl = Math.pow(u, 0.72);
      const y = rim.y - craterDepth * bowl - Math.min(0.025 * core.dimensions.height, rimRadial * 0.002) * u;
      positions.push(x, y, z);
    }
  }

  for (let ring = 0; ring < VOLCANO_CRATER_RINGS; ring += 1) {
    for (let segment = 0; segment < VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const a = ring * stride + segment;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const centerIndex = positions.length / 3;
  const centerLeanX = core.morphology.leanX * core.dimensions.height * 0.52;
  const centerLeanZ = core.morphology.leanZ * core.dimensions.height * 0.52;
  const averageRimY = volcanoOuterPoint(core, 0, 1).y;
  positions.push(centerLeanX, averageRimY - craterDepth * 1.04, centerLeanZ);
  const lastRingStart = VOLCANO_CRATER_RINGS * stride;
  for (let segment = 0; segment < VOLCANO_RADIAL_SEGMENTS; segment += 1) {
    indices.push(lastRingStart + segment, centerIndex, lastRingStart + segment + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCorePlatformGeometry(core: ReefCoreManifest): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 64, 5, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const phaseA = (core.platform.seed % 10_000) / 10_000 * Math.PI * 2;
  const phaseB = ((core.platform.seed >>> 8) % 10_000) / 10_000 * Math.PI * 2;

  for (let index = 0; index < position.count; index += 1) {
    const sourceX = position.getX(index);
    const sourceY = position.getY(index);
    const sourceZ = position.getZ(index);
    const angle = Math.atan2(sourceZ, sourceX);
    const y01 = sourceY + 0.5;
    const edgeNoise = 1 + core.platform.irregularity * (
      Math.sin(angle * 3 + phaseA) * 0.55
      + Math.cos(angle * 5 - phaseB) * 0.3
      + Math.sin(angle * 7 + phaseB) * 0.15
    );
    const verticalRoughness = core.platform.irregularity * 0.09 * (
      Math.cos(angle * 4 + phaseA) + Math.sin(angle * 6 - phaseB)
    );
    const lowerTaper = 0.88 + y01 * 0.12;

    position.setXYZ(
      index,
      sourceX * core.platform.radiusX * edgeNoise * lowerTaper,
      sourceY * core.platform.thickness + verticalRoughness,
      sourceZ * core.platform.radiusZ * edgeNoise * lowerTaper,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Persistent Phase 1 presentation: a deterministic underwater volcano and its growth platform. */
export function ReefCoreObject({ core }: { core: ReefCoreManifest }) {
  const volcanoGeometry = useMemo(() => createVolcanoOuterGeometry(core), [core]);
  const craterGeometry = useMemo(() => createVolcanoCraterGeometry(core), [core]);
  const platformGeometry = useMemo(() => createCorePlatformGeometry(core), [core]);

  useEffect(() => () => {
    volcanoGeometry.dispose();
    craterGeometry.dispose();
    platformGeometry.dispose();
  }, [craterGeometry, platformGeometry, volcanoGeometry]);

  return (
    <group>
      <mesh geometry={platformGeometry} rotation={[0, core.platform.rotationRadians, 0]} receiveShadow>
        <meshStandardMaterial color="#474d47" roughness={0.99} metalness={0.005} />
      </mesh>
      <mesh geometry={volcanoGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#454b44" roughness={0.98} metalness={0.005} />
      </mesh>
      <mesh geometry={craterGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#252c27" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
