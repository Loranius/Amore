import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import distantFishTextureUrl from './assets/distantFishTexture.svg';

type Vec3 = readonly [number, number, number];

type RidgeMass = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

type VegetationInstance = {
  position: Vec3;
  rotation: number;
  scale: Vec3;
};

type SchoolFish = {
  position: Vec3;
  rotation: number;
  scale: number;
  tint: string;
};

const TAU = Math.PI * 2;
const MIDGROUND_MASS_COUNT = 12;
const DISTANT_MASS_COUNT = 18;
const DISTANT_VEGETATION_COUNT = 48;
const SCHOOL_SIZE = 18;
const DISTANT_FISH_TINTS = [
  '#7fc9cf',
  '#8fc1a0',
  '#d7b968',
  '#c88670',
] as const;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildRingMasses({
  count,
  innerRadius,
  outerRadius,
  heightRange,
  seedOffset,
}: {
  count: number;
  innerRadius: number;
  outerRadius: number;
  heightRange: readonly [number, number];
  seedOffset: number;
}): RidgeMass[] {
  return Array.from({ length: count }, (_value, index) => {
    const seededIndex = index + seedOffset;
    const baseAngle = index / count * TAU;
    const angle = baseAngle + (seededUnit(seededIndex, 1) - 0.5) * (TAU / count) * 0.88;
    const radius = THREE.MathUtils.lerp(
      innerRadius,
      outerRadius,
      seededUnit(seededIndex, 2),
    );
    const height = THREE.MathUtils.lerp(
      heightRange[0],
      heightRange[1],
      seededUnit(seededIndex, 3),
    );
    const width = THREE.MathUtils.lerp(0.62, 1.35, seededUnit(seededIndex, 4));
    const depth = THREE.MathUtils.lerp(0.58, 1.12, seededUnit(seededIndex, 5));

    return {
      position: [
        Math.cos(angle) * radius,
        -0.54 + height * 0.27,
        Math.sin(angle) * radius,
      ],
      rotation: [
        (seededUnit(seededIndex, 6) - 0.5) * 0.18,
        -angle + seededUnit(seededIndex, 7) * 0.48,
        (seededUnit(seededIndex, 8) - 0.5) * 0.14,
      ],
      scale: [width, height, depth],
    };
  });
}

function buildVegetation(): VegetationInstance[] {
  const clusterCount = 10;
  return Array.from({ length: DISTANT_VEGETATION_COUNT }, (_value, index) => {
    const cluster = index % clusterCount;
    const clusterAngle = cluster / clusterCount * TAU + seededUnit(cluster, 31) * 0.28;
    const angle = clusterAngle + (seededUnit(index, 11) - 0.5) * 0.44;
    const radius = THREE.MathUtils.lerp(12.4, 17.2, seededUnit(index, 12));
    const scale = THREE.MathUtils.lerp(0.34, 0.78, seededUnit(index, 13));

    return {
      position: [
        Math.cos(angle) * radius,
        -0.3,
        Math.sin(angle) * radius,
      ],
      rotation: -angle + seededUnit(index, 14) * 0.5,
      scale: [
        THREE.MathUtils.lerp(0.52, 0.94, seededUnit(index, 15)) * scale,
        scale,
        THREE.MathUtils.lerp(0.5, 0.82, seededUnit(index, 16)) * scale,
      ],
    };
  });
}

function buildSchool(seedOffset: number): SchoolFish[] {
  return Array.from({ length: SCHOOL_SIZE }, (_value, index) => ({
    position: [
      (seededUnit(index + seedOffset, 21) - 0.5) * 1.95,
      (seededUnit(index + seedOffset, 22) - 0.5) * 0.72,
      (seededUnit(index + seedOffset, 23) - 0.5) * 0.24,
    ],
    rotation: (seededUnit(index + seedOffset, 24) - 0.5) * 0.2,
    scale: THREE.MathUtils.lerp(0.43, 0.63, seededUnit(index + seedOffset, 25)),
    tint: DISTANT_FISH_TINTS[(index + seedOffset) % DISTANT_FISH_TINTS.length]
      ?? DISTANT_FISH_TINTS[0],
  }));
}

function ReefRingMasses({
  name,
  masses,
  color,
  emissive,
}: {
  name: string;
  masses: readonly RidgeMass[];
  color: string;
  emissive: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    masses.forEach((mass, index) => {
      dummy.position.set(...mass.position);
      dummy.rotation.set(...mass.rotation);
      dummy.scale.set(...mass.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, masses]);

  return (
    <instancedMesh
      ref={ref}
      name={name}
      args={[undefined, undefined, masses.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.13}
        roughness={1}
        metalness={0}
      />
    </instancedMesh>
  );
}

function DistantVegetation({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const vegetation = useMemo(buildVegetation, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tickRef = useRef(0);

  const applyMatrices = (time: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    vegetation.forEach((plant, index) => {
      const sway = reducedMotion ? 0 : Math.sin(time * 0.28 + index * 0.61) * 0.065;
      dummy.position.set(...plant.position);
      dummy.rotation.set(sway * 0.16, plant.rotation, sway);
      dummy.scale.set(...plant.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    applyMatrices(0);
  }, []);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tickRef.current += delta;
    if (tickRef.current < 0.1) return;
    tickRef.current = 0;
    applyMatrices(state.clock.elapsedTime);
  });

  return (
    <instancedMesh
      ref={ref}
      name="reef-360-vegetation-patches"
      args={[undefined, undefined, vegetation.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <coneGeometry args={[0.14, 0.68, 5]} />
      <meshStandardMaterial
        color="#376d61"
        emissive="#173f3a"
        emissiveIntensity={0.11}
        roughness={0.96}
        metalness={0}
      />
    </instancedMesh>
  );
}

function DistantFishSchool({
  seedOffset,
  position,
  heading,
  phase,
  reducedMotion,
}: {
  seedOffset: number;
  position: Vec3;
  heading: number;
  phase: number;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fish = useMemo(() => buildSchool(seedOffset), [seedOffset]);
  const texture = useLoader(THREE.TextureLoader, distantFishTextureUrl);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const facingYaw = Math.atan2(position[0], position[2]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    fish.forEach((item, index) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(0, 0, item.rotation);
      dummy.scale.set(-item.scale, item.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, tint.set(item.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, fish, tint]);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const time = clock.elapsedTime;
    const tangentX = Math.cos(heading);
    const tangentZ = Math.sin(heading);
    const travel = Math.sin(time * 0.07 + phase) * 0.5;
    groupRef.current.position.x = position[0] + tangentX * travel;
    groupRef.current.position.y = position[1] + Math.sin(time * 0.105 + phase) * 0.08;
    groupRef.current.position.z = position[2] + tangentZ * travel;
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      rotation={[0, facingYaw, 0]}
    >
      <instancedMesh
        ref={meshRef}
        name={`reef-distant-textured-fish-school-${seedOffset}`}
        args={[undefined, undefined, fish.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
        renderOrder={3}
        userData={{
          reefDistantFishTexture: 'cc0-inspired-fish-card-v1',
          reefDistantFishCount: fish.length,
        }}
      >
        <planeGeometry args={[0.46, 0.25]} />
        <meshBasicMaterial
          map={texture}
          color="#ffffff"
          transparent
          opacity={0.82}
          alphaTest={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

export function ReefDistantEcosystem({ reducedMotion }: { reducedMotion: boolean }) {
  const midground = useMemo(() => buildRingMasses({
    count: MIDGROUND_MASS_COUNT,
    innerRadius: 11.8,
    outerRadius: 14.8,
    heightRange: [0.35, 0.95],
    seedOffset: 1000,
  }), []);
  const distant = useMemo(() => buildRingMasses({
    count: DISTANT_MASS_COUNT,
    innerRadius: 15.5,
    outerRadius: 20.5,
    heightRange: [0.6, 1.55],
    seedOffset: 3000,
  }), []);

  return (
    <group name="reef-distant-ecosystem-360-v5-clear-orbit">
      <ReefRingMasses
        name="reef-midground-satellite-patches"
        masses={midground}
        color="#386263"
        emissive="#163c40"
      />
      <ReefRingMasses
        name="reef-distant-ridge-ring"
        masses={distant}
        color="#294f52"
        emissive="#12353a"
      />
      <DistantVegetation reducedMotion={reducedMotion} />

      <DistantFishSchool
        seedOffset={100}
        position={[12.8, 2.8, 10.4]}
        heading={2.25}
        phase={0.4}
        reducedMotion={reducedMotion}
      />
      <DistantFishSchool
        seedOffset={300}
        position={[-13.8, 3.3, 8.2]}
        heading={-2.2}
        phase={1.6}
        reducedMotion={reducedMotion}
      />
      <DistantFishSchool
        seedOffset={500}
        position={[-9.4, 2.9, -15.7]}
        heading={-0.45}
        phase={2.8}
        reducedMotion={reducedMotion}
      />
      <DistantFishSchool
        seedOffset={700}
        position={[10.7, 4, -16.2]}
        heading={0.55}
        phase={4.1}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
