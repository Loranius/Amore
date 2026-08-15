import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import { REEF_SEABED_Y } from './reefTerracedFoundation';

const TAU = Math.PI * 2;
const MAX_RELATIONSHIP_DAYS = 50 * 365.2425;
const ERUPTION_START_SECONDS = [0, 6 * 60 * 60, 12 * 60 * 60, 18 * 60 * 60] as const;
const ERUPTION_DURATION_SECONDS = 5 * 60;
const VOLCANO_SEGMENTS = 72;
const VOLCANO_RINGS = 22;
const ERUPTION_PARTICLES = 18;

export interface ReefVolcanoGrowthState {
  ageProgress: number;
  moduleFill: number;
  growth: number;
}

interface ReefVolcanoProfile extends ReefVolcanoGrowthState {
  seed: number;
  floorY: number;
  baseRadius: number;
  coneHeight: number;
  craterRadius: number;
  crackStrength: number;
}

type Point = readonly [number, number, number];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

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

export function calculateReefVolcanoGrowth({
  daysTogether,
  moduleFill,
}: {
  daysTogether: number;
  moduleFill: number;
}): ReefVolcanoGrowthState {
  const ageProgress = clamp01(Math.max(0, daysTogether) / MAX_RELATIONSHIP_DAYS);
  const boundedModuleFill = clamp01(moduleFill);

  // Time is the hard ceiling: at 50 years the volcano is always fully formed.
  // Portal activity accelerates the route toward that ceiling without allowing
  // a young relationship to instantly jump to the final silhouette.
  const growth = clamp01(
    ageProgress + (1 - ageProgress) * boundedModuleFill * 0.42,
  );

  return {
    ageProgress,
    moduleFill: boundedModuleFill,
    growth,
  };
}

export function isReefVolcanoEruptionActive(now: Date): boolean {
  const seconds = now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds();
  return ERUPTION_START_SECONDS.some((start) => (
    seconds >= start && seconds < start + ERUPTION_DURATION_SECONDS
  ));
}

function moduleFillFromBuild(build: ReefPreviewBuild): number {
  const evolution = build.species.moduleEvolution;
  const zones = evolution.development.annualZones;
  const weighted = zones.reduce((total, zone) => total + Math.max(0.18, zone.progress), 0);
  const annualFill = weighted <= 0
    ? 0
    : zones.reduce(
      (total, zone) => total + zone.fill * Math.max(0.18, zone.progress),
      0,
    ) / weighted;
  const ecology = evolution.development.ecology;

  return clamp01(
    annualFill * 0.42
      + ecology.colonization * 0.25
      + ecology.biodiversity * 0.18
      + ecology.cohesion * 0.15,
  );
}

function buildVolcanoProfile(build: ReefPreviewBuild): ReefVolcanoProfile {
  const evolution = build.species.moduleEvolution;
  const growth = calculateReefVolcanoGrowth({
    daysTogether: evolution.facts.daysTogether,
    moduleFill: moduleFillFromBuild(build),
  });

  // The first pass made the centre read as a broad mound on mobile. Keep a
  // substantial submarine apron, but compress the footprint and spend more of
  // the growth budget vertically so even a young volcano has a clear cone.
  const baseRadius = Math.max(1.24, build.structures.visibleFoundationRadius * 0.84);

  return {
    ...growth,
    seed: evolution.identitySeed,
    floorY: REEF_SEABED_Y + 0.014,
    baseRadius,
    coneHeight: 1.52 + growth.growth * 4.45,
    craterRadius: baseRadius * (0.1 + growth.growth * 0.05),
    crackStrength: smoothstep(0.4, 1, growth.growth),
  };
}

function volcanoBoundaryRadius(profile: ReefVolcanoProfile, angle: number): number {
  const phaseA = stableUnit(profile.seed, 'volcano:boundary:a') * TAU;
  const phaseB = stableUnit(profile.seed, 'volcano:boundary:b') * TAU;
  const phaseC = stableUnit(profile.seed, 'volcano:boundary:c') * TAU;
  const phaseD = stableUnit(profile.seed, 'volcano:boundary:d') * TAU;

  // Deliberately use several low-frequency lobes. A perfect circular footprint
  // makes the object read as a manufactured cone when viewed from above.
  const broad = Math.sin(angle * 2 + phaseA) * 0.105;
  const shoulder = Math.sin(angle * 3 - phaseB) * 0.064;
  const ridge = Math.sin(angle * 5 + phaseC) * 0.034;
  const chip = Math.sin(angle * 9 + phaseD) * 0.017;
  return profile.baseRadius * (1 + broad + shoulder + ridge + chip);
}

function fissureMask(profile: ReefVolcanoProfile, angle: number): number {
  let strongest = 0;
  const fissureCount = 5 + Math.round(profile.growth * 3);
  for (let index = 0; index < fissureCount; index += 1) {
    const fissureAngle = stableUnit(profile.seed, `volcano:fissure:${index}:angle`) * TAU;
    const alignment = Math.max(0, Math.cos(angle - fissureAngle));
    strongest = Math.max(strongest, Math.pow(alignment, 30));
  }
  return strongest;
}

function volcanoSurfaceY(
  profile: ReefVolcanoProfile,
  radialDistance: number,
  angle: number,
): number {
  const boundary = volcanoBoundaryRadius(profile, angle);
  const radial = radialDistance / Math.max(1e-6, boundary);
  if (radial >= 1.08) return profile.floorY;

  const clamped = Math.max(0, radial);
  const craterRatio = profile.craterRadius / profile.baseRadius;
  const tiltAngle = stableUnit(profile.seed, 'volcano:tilt') * TAU;
  const tilt = Math.cos(angle - tiltAngle);

  // Steep upper cone + broad low apron: this keeps the base grounded while
  // creating the recognisable volcanic silhouette that was missing before.
  const upperCone = profile.coneHeight * Math.pow(Math.max(0, 1 - clamped), 1.54);
  const lowerMass = profile.coneHeight
    * 0.19
    * (1 - smoothstep(0.5, 1.02, clamped));

  // A small deterministic lean breaks the radial symmetry without moving the
  // volcano away from the logical centre of the reef.
  const asymmetry = profile.coneHeight
    * 0.085
    * tilt
    * Math.pow(Math.max(0, 1 - clamped), 1.1);

  const craterWidth = Math.max(0.034, craterRatio * 0.29);
  const rimPhase = stableUnit(profile.seed, 'volcano:rim:phase') * TAU;
  const rimNoise = 1
    + Math.sin(angle * 3 + rimPhase) * 0.18
    + Math.sin(angle * 7 - rimPhase * 0.7) * 0.07;
  let rim = profile.coneHeight
    * (0.12 + profile.growth * 0.055)
    * rimNoise
    * Math.exp(-Math.pow((clamped - craterRatio) / craterWidth, 2));

  // One side of the crater is collapsed. This is intentionally stable per
  // couple so the profile has an identity instead of looking procedural each run.
  const breachAngle = tiltAngle + Math.PI * 0.34;
  const breachMask = Math.pow(Math.max(0, Math.cos(angle - breachAngle)), 8);
  rim -= profile.coneHeight
    * 0.095
    * breachMask
    * Math.exp(-Math.pow((clamped - craterRatio) / (craterWidth * 1.35), 2));

  const bowl = profile.coneHeight
    * (0.44 + profile.growth * 0.11)
    * Math.exp(-Math.pow(clamped / Math.max(0.05, craterRatio * 0.82), 4.2));

  // One secondary shoulder gives the silhouette a geological buttress instead
  // of a single mathematical slope.
  const shoulderAngle = tiltAngle - Math.PI * 0.72;
  const shoulderMask = Math.pow(Math.max(0, Math.cos(angle - shoulderAngle)), 4);
  const sideShoulder = profile.coneHeight
    * 0.105
    * shoulderMask
    * Math.exp(-Math.pow((clamped - 0.42) / 0.24, 2));

  const roughPhase = stableUnit(profile.seed, 'volcano:roughness') * TAU;
  const roughness = profile.coneHeight
    * 0.038
    * Math.sin(angle * 6.5 + clamped * 13 + roughPhase)
    * Math.max(0, 1 - clamped);
  const fissure = profile.coneHeight
    * 0.058
    * profile.crackStrength
    * fissureMask(profile, angle)
    * Math.pow(Math.max(0, 1 - clamped), 0.92);

  const edgeFade = 1 - smoothstep(0.93, 1.07, clamped);
  const relief = Math.max(
    0,
    upperCone
      + lowerMass
      + asymmetry
      + rim
      + sideShoulder
      - bowl
      + roughness
      - fissure,
  );

  return profile.floorY + relief * edgeFade;
}

function surfacePoint(
  profile: ReefVolcanoProfile,
  radialRatio: number,
  angle: number,
): Point {
  const boundary = volcanoBoundaryRadius(profile, angle);
  const radialDistance = boundary * radialRatio;
  return [
    Math.cos(angle) * radialDistance,
    volcanoSurfaceY(profile, radialDistance, angle),
    Math.sin(angle) * radialDistance,
  ];
}

function appendVertex(
  positions: number[],
  colors: number[],
  point: Point,
  profile: ReefVolcanoProfile,
): void {
  positions.push(point[0], point[1], point[2]);
  const normalizedHeight = clamp01(
    (point[1] - profile.floorY) / Math.max(0.01, profile.coneHeight),
  );

  // Keep volcanic basalt dark, but not crushed to black by the underwater
  // lighting/tone-mapping stack. The material below stays white so these
  // vertex colours are not multiplied by a second dark tint.
  const base = new THREE.Color('#56615d');
  const summit = new THREE.Color('#756257');
  base.lerp(summit, normalizedHeight * 0.72);
  const mineralVariation = 0.94 + Math.sin(point[0] * 2.9 + point[2] * 3.7) * 0.07;
  colors.push(
    clamp01(base.r * mineralVariation),
    clamp01(base.g * mineralVariation),
    clamp01(base.b * mineralVariation),
  );
}

function appendTriangle(
  positions: number[],
  colors: number[],
  a: Point,
  b: Point,
  c: Point,
  profile: ReefVolcanoProfile,
): void {
  appendVertex(positions, colors, a, profile);
  appendVertex(positions, colors, b, profile);
  appendVertex(positions, colors, c, profile);
}

function buildVolcanoGeometry(profile: ReefVolcanoProfile): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const outerRatio = 1.075;
  const firstRatio = outerRatio / VOLCANO_RINGS;
  const centerY = volcanoSurfaceY(profile, 0, 0);

  for (let segment = 0; segment < VOLCANO_SEGMENTS; segment += 1) {
    const angle = segment / VOLCANO_SEGMENTS * TAU;
    const nextAngle = (segment + 1) / VOLCANO_SEGMENTS * TAU;
    appendTriangle(
      positions,
      colors,
      [0, centerY, 0],
      surfacePoint(profile, firstRatio, nextAngle),
      surfacePoint(profile, firstRatio, angle),
      profile,
    );
  }

  for (let ring = 1; ring < VOLCANO_RINGS; ring += 1) {
    const innerRatio = ring / VOLCANO_RINGS * outerRatio;
    const outerRingRatio = (ring + 1) / VOLCANO_RINGS * outerRatio;
    for (let segment = 0; segment < VOLCANO_SEGMENTS; segment += 1) {
      const angle = segment / VOLCANO_SEGMENTS * TAU;
      const nextAngle = (segment + 1) / VOLCANO_SEGMENTS * TAU;
      const innerA = surfacePoint(profile, innerRatio, angle);
      const innerB = surfacePoint(profile, innerRatio, nextAngle);
      const outerA = surfacePoint(profile, outerRingRatio, angle);
      const outerB = surfacePoint(profile, outerRingRatio, nextAngle);
      appendTriangle(positions, colors, innerA, innerB, outerB, profile);
      appendTriangle(positions, colors, innerA, outerB, outerA, profile);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefVolcanoGrowth = profile.growth;
  geometry.userData.reefVolcanoModuleFill = profile.moduleFill;
  geometry.userData.reefVolcanoAgeProgress = profile.ageProgress;
  return geometry;
}

function buildCrackGeometry(profile: ReefVolcanoProfile): THREE.BufferGeometry {
  const positions: number[] = [];
  const fissureCount = 5 + Math.round(profile.growth * 3);

  for (let fissure = 0; fissure < fissureCount; fissure += 1) {
    const baseAngle = stableUnit(profile.seed, `volcano:fissure:${fissure}:angle`) * TAU;
    const reach = 0.5 + stableUnit(profile.seed, `volcano:fissure:${fissure}:reach`) * 0.24;
    let previous: Point | null = null;

    for (let step = 0; step <= 7; step += 1) {
      const t = step / 7;
      const radial = THREE.MathUtils.lerp(
        profile.craterRadius * 0.86,
        profile.baseRadius * reach,
        t,
      );
      const angle = baseAngle
        + Math.sin(t * Math.PI * 2 + fissure) * (0.018 + t * 0.035);
      const point: Point = [
        Math.cos(angle) * radial,
        volcanoSurfaceY(profile, radial, angle) + 0.022,
        Math.sin(angle) * radial,
      ];
      if (previous) positions.push(...previous, ...point);
      previous = point;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function EruptionParticles({
  profile,
  active,
  reducedMotion,
}: {
  profile: ReefVolcanoProfile;
  active: boolean;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: ERUPTION_PARTICLES }, (_value, index) => ({
    angle: stableUnit(profile.seed, `volcano:particle:${index}:angle`) * TAU,
    offset: stableUnit(profile.seed, `volcano:particle:${index}:offset`),
    speed: 0.34 + stableUnit(profile.seed, `volcano:particle:${index}:speed`) * 0.5,
    spin: (stableUnit(profile.seed, `volcano:particle:${index}:spin`) - 0.5) * 2.4,
  })), [profile.seed]);
  const originY = volcanoSurfaceY(profile, 0, 0) + 0.08;

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || !active || reducedMotion) return;
    const elapsed = state.clock.elapsedTime;

    particles.forEach((particle, index) => {
      const phase = (elapsed * particle.speed + particle.offset) % 1;
      const spread = profile.craterRadius * (0.08 + phase * 0.82);
      const angle = particle.angle + particle.spin * phase;
      const height = phase * (0.72 + profile.growth * 1.18);
      dummy.position.set(
        Math.cos(angle) * spread,
        originY + height,
        Math.sin(angle) * spread,
      );
      dummy.rotation.set(phase * 3.1, angle, phase * 2.4);
      dummy.scale.setScalar(
        (0.045 + profile.growth * 0.025) * (1 - phase * 0.42),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, ERUPTION_PARTICLES]}
      visible={active && !reducedMotion}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#ff7a2f" toneMapped={false} />
    </instancedMesh>
  );
}

export function ReefVolcano({
  build,
  reducedMotion,
}: {
  build: ReefPreviewBuild;
  reducedMotion: boolean;
}) {
  const profile = useMemo(() => buildVolcanoProfile(build), [build]);
  const geometry = useMemo(() => buildVolcanoGeometry(profile), [profile]);
  const crackGeometry = useMemo(() => buildCrackGeometry(profile), [profile]);
  const [eruptionActive, setEruptionActive] = useState(
    () => isReefVolcanoEruptionActive(new Date()),
  );

  useEffect(() => () => {
    geometry.dispose();
    crackGeometry.dispose();
  }, [crackGeometry, geometry]);

  useEffect(() => {
    const refresh = () => setEruptionActive(isReefVolcanoEruptionActive(new Date()));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const craterFloorY = volcanoSurfaceY(profile, 0, 0) + 0.026;
  const crackOpacity = eruptionActive
    ? 0.94
    : 0.035 + profile.crackStrength * 0.3;
  const lavaOpacity = eruptionActive
    ? 0.92
    : 0.08 + profile.growth * 0.12;

  return (
    <group
      name="reef-submarine-volcano"
      userData={{
        reefVolcanoGrowth: profile.growth,
        reefVolcanoModuleFill: profile.moduleFill,
        reefVolcanoAgeProgress: profile.ageProgress,
        reefVolcanoEruptionActive: eruptionActive,
        reefVolcanoSchedule: '00:00-00:05,06:00-06:05,12:00-12:05,18:00-18:05',
      }}
    >
      <mesh
        name="reef-volcano-support-surface"
        geometry={geometry}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
        userData={{
          reefSupportSurface: true,
          reefSupportSurfaceKind: 'volcano',
          reefVolcano: true,
        }}
      >
        <meshStandardMaterial
          color="#ffffff"
          vertexColors
          roughness={0.92}
          metalness={0}
          flatShading
          emissive="#1d2523"
          emissiveIntensity={0.08 + profile.growth * 0.035}
        />
      </mesh>

      <mesh
        position={[0, craterFloorY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={4}
      >
        <circleGeometry args={[profile.craterRadius * 0.82, 40]} />
        <meshBasicMaterial
          color={eruptionActive ? '#ff6a22' : '#6d2418'}
          transparent
          opacity={lavaOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <lineSegments geometry={crackGeometry} renderOrder={5}>
        <lineBasicMaterial
          color={eruptionActive ? '#ff8a36' : '#a43a24'}
          transparent
          opacity={crackOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      <pointLight
        color="#ff6c2d"
        position={[0, craterFloorY + 0.18, 0]}
        intensity={eruptionActive ? 3.1 : 0.08 + profile.growth * 0.16}
        distance={eruptionActive ? 5.4 : 2.1}
        decay={2}
      />

      <EruptionParticles
        profile={profile}
        active={eruptionActive}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
