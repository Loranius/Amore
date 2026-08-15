import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ReefCoreManifest } from '@/engine/species/reef';

const VOLCANO_RADIAL_SEGMENTS = 72;
const VOLCANO_SLOPE_RINGS = 24;
const VOLCANO_CRATER_RINGS = 6;
const PLATFORM_SEGMENTS = 72;
const PLATFORM_RINGS = 10;
const PLATFORM_OUTER_RADIUS = 1.16;

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

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
  return 0.145 + core.morphology.shoulderBias * 0.014;
}

function volcanoOuterPoint(
  core: ReefCoreManifest,
  angle: number,
  t: number,
): THREE.Vector3 {
  const { ruggedness, asymmetry, phaseA, phaseB, leanX, leanZ } = core.morphology;
  const rimRadius = volcanoRimRadius(core);
  const noise = volcanoNoise(core, angle, t);
  const baseY = -core.platform.thickness * 0.14;
  const summitHeight = core.dimensions.height * 0.92;
  const coneProfile = rimRadius + (1 - rimRadius) * Math.pow(1 - t, 0.62);
  const lowerShoulder = 1 + Math.sin(Math.PI * Math.min(1, t / 0.44)) * 0.085 * (1 - t);
  const asymmetryBias = 1 + asymmetry * 0.72 * Math.cos(angle - phaseA);
  const roughness = 1 + noise * (0.038 + ruggedness * 0.115) * (0.72 + (1 - t) * 0.28);
  const radial = Math.max(rimRadius * 0.74, coneProfile * lowerShoulder * asymmetryBias * roughness);
  const localHeight = Math.pow(t, 0.88) * summitHeight;
  const ridgeHeight = noise * core.dimensions.height * (0.008 + ruggedness * 0.018) * (0.35 + t * 0.65);
  const rimBand = smoothstep(0.78, 0.96, t);
  const brokenRim = 0.70
    + Math.sin(angle * 3 + phaseA) * 0.18
    + Math.cos(angle * 5 - phaseB) * 0.12;
  const rimLift = rimBand * core.dimensions.height * (0.022 + ruggedness * 0.018) * brokenRim;
  const leanFactor = t * t * 0.52;

  return new THREE.Vector3(
    Math.cos(angle) * core.dimensions.radiusX * radial + leanX * core.dimensions.height * leanFactor,
    baseY + localHeight + ridgeHeight + rimLift,
    Math.sin(angle) * core.dimensions.radiusZ * radial + leanZ * core.dimensions.height * leanFactor,
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
  const craterDepth = core.dimensions.height * (0.10 + core.morphology.ruggedness * 0.026);

  for (let ring = 0; ring <= VOLCANO_CRATER_RINGS; ring += 1) {
    const u = ring / VOLCANO_CRATER_RINGS;
    for (let segment = 0; segment <= VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const angle = segment / VOLCANO_RADIAL_SEGMENTS * Math.PI * 2;
      const rim = volcanoOuterPoint(core, angle, 1);
      const noise = volcanoNoise(core, angle, 1 - u * 0.28);
      const innerRadius = rimRadius * (1 - u * 0.88) * (1 + noise * 0.042);
      const targetX = Math.cos(angle) * core.dimensions.radiusX * innerRadius
        + core.morphology.leanX * core.dimensions.height * 0.52;
      const targetZ = Math.sin(angle) * core.dimensions.radiusZ * innerRadius
        + core.morphology.leanZ * core.dimensions.height * 0.52;
      const blend = Math.min(1, u * 1.08);
      const x = THREE.MathUtils.lerp(rim.x, targetX, blend);
      const z = THREE.MathUtils.lerp(rim.z, targetZ, blend);
      const bowl = Math.pow(u, 0.82);
      const innerTerrace = Math.sin(u * Math.PI) * core.dimensions.height * 0.012
        * Math.sin(angle * 4 + core.morphology.phaseB);
      const y = rim.y - craterDepth * bowl + innerTerrace;
      positions.push(x, y, z);
    }
  }

  const centerIndex = positions.length / 3;
  const centerLeanX = core.morphology.leanX * core.dimensions.height * 0.52;
  const centerLeanZ = core.morphology.leanZ * core.dimensions.height * 0.52;
  const averageRimY = volcanoOuterPoint(core, 0, 1).y;
  positions.push(centerLeanX, averageRimY - craterDepth * 1.02, centerLeanZ);

  for (let ring = 0; ring < VOLCANO_CRATER_RINGS; ring += 1) {
    for (let segment = 0; segment < VOLCANO_RADIAL_SEGMENTS; segment += 1) {
      const a = ring * stride + segment;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

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
  const positions: number[] = [0, core.platform.thickness * 0.47, 0];
  const indices: number[] = [];
  const phaseA = (core.platform.seed % 10_000) / 10_000 * Math.PI * 2;
  const phaseB = ((core.platform.seed >>> 8) % 10_000) / 10_000 * Math.PI * 2;
  const topY = core.platform.thickness * 0.47;
  const groundY = -core.platform.thickness * 0.52;

  for (let ring = 1; ring <= PLATFORM_RINGS; ring += 1) {
    const radial01 = PLATFORM_OUTER_RADIUS * ring / PLATFORM_RINGS;
    const edgeDrop = smoothstep(0.98, PLATFORM_OUTER_RADIUS, radial01);
    for (let segment = 0; segment < PLATFORM_SEGMENTS; segment += 1) {
      const angle = segment / PLATFORM_SEGMENTS * Math.PI * 2;
      const lobe =
        Math.sin(angle * 3 + phaseA + radial01 * 1.6) * 0.52
        + Math.cos(angle * 5 - phaseB - radial01) * 0.30
        + Math.sin(angle * 8 + phaseB * 0.7) * 0.18;
      const radiusNoise = 1 + core.platform.irregularity * lobe * (0.08 + edgeDrop * 0.28);
      const plateauRelief = core.platform.irregularity * core.platform.thickness * (
        Math.sin(angle * 4 + radial01 * 7 + phaseA) * 0.15
        + Math.cos(angle * 7 - radial01 * 4 - phaseB) * 0.08
      ) * smoothstep(0.12, 0.94, radial01) * (1 - edgeDrop * 0.55);
      const outerRidge = Math.max(0, Math.sin(angle * 3 - phaseB + radial01 * 2.8))
        * core.platform.thickness * 0.10 * smoothstep(0.74, 1.03, radial01) * (1 - edgeDrop);
      const y = THREE.MathUtils.lerp(topY, groundY, edgeDrop) + plateauRelief + outerRidge;
      positions.push(
        Math.cos(angle) * core.platform.radiusX * radial01 * radiusNoise,
        y,
        Math.sin(angle) * core.platform.radiusZ * radial01 * radiusNoise,
      );
    }
  }

  for (let segment = 0; segment < PLATFORM_SEGMENTS; segment += 1) {
    const next = (segment + 1) % PLATFORM_SEGMENTS;
    indices.push(0, 1 + segment, 1 + next);
  }

  for (let ring = 1; ring < PLATFORM_RINGS; ring += 1) {
    const currentStart = 1 + (ring - 1) * PLATFORM_SEGMENTS;
    const nextStart = currentStart + PLATFORM_SEGMENTS;
    for (let segment = 0; segment < PLATFORM_SEGMENTS; segment += 1) {
      const next = (segment + 1) % PLATFORM_SEGMENTS;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
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

/** Persistent Phase 1 core rendered as a continuous Phase 6 geological shelf. */
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
        <meshStandardMaterial color="#505951" roughness={1} metalness={0} flatShading />
      </mesh>
      <mesh geometry={volcanoGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#485048" roughness={0.98} metalness={0.005} />
      </mesh>
      <mesh geometry={craterGeometry} receiveShadow>
        <meshStandardMaterial color="#343d36" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
