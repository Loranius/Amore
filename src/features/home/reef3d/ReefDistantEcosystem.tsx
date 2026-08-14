import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
};

const DISTANT_RIDGE_MASSES = 22;
const DISTANT_VEGETATION_COUNT = 38;
const SCHOOL_SIZE = 22;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildRidge(): RidgeMass[] {
  return Array.from({ length: DISTANT_RIDGE_MASSES }, (_value, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor(index / 2);
    const x = side * (2.8 + seededUnit(index, 1) * 6.3);
    const z = -7.2 - lane * 0.48 - seededUnit(index, 2) * 2.2;
    const height = THREE.MathUtils.lerp(0.72, 2.1, seededUnit(index, 3));
    const width = THREE.MathUtils.lerp(1.05, 2.45, seededUnit(index, 4));
    const depth = THREE.MathUtils.lerp(0.8, 1.75, seededUnit(index, 5));

    return {
      position: [x, -0.52 + height * 0.32, z],
      rotation: [
        (seededUnit(index, 6) - 0.5) * 0.16,
        seededUnit(index, 7) * Math.PI,
        (seededUnit(index, 8) - 0.5) * 0.12,
      ],
      scale: [width, height, depth],
    };
  });
}

function buildVegetation(): VegetationInstance[] {
  return Array.from({ length: DISTANT_VEGETATION_COUNT }, (_value, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (3.2 + seededUnit(index, 11) * 5.4);
    const z = -6.4 - seededUnit(index, 12) * 5.6;
    const scale = THREE.MathUtils.lerp(0.52, 1.25, seededUnit(index, 13));

    return {
      position: [x, -0.26, z],
      rotation: seededUnit(index, 14) * Math.PI * 2,
      scale: [
        THREE.MathUtils.lerp(0.55, 1.05, seededUnit(index, 15)) * scale,
        scale,
        THREE.MathUtils.lerp(0.55, 0.9, seededUnit(index, 16)) * scale,
      ],
    };
  });
}

function buildSchool(seedOffset: number): SchoolFish[] {
  return Array.from({ length: SCHOOL_SIZE }, (_value, index) => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    const jitterX = (seededUnit(index + seedOffset, 21) - 0.5) * 0.42;
    const jitterY = (seededUnit(index + seedOffset, 22) - 0.5) * 0.24;
    const jitterZ = (seededUnit(index + seedOffset, 23) - 0.5) * 0.5;
    return {
      position: [
        column * 0.34 + jitterX,
        row * 0.23 + jitterY,
        jitterZ,
      ],
      rotation: (seededUnit(index + seedOffset, 24) - 0.5) * 0.2,
      scale: THREE.MathUtils.lerp(0.72, 1.18, seededUnit(index + seedOffset, 25)),
    };
  });
}

function DistantRidge() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const masses = useMemo(buildRidge, []);
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
      name="reef-distant-ridge"
      args={[undefined, undefined, masses.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        name="reef-distant-ecosystem-rock"
        color="#294f52"
        emissive="#12353a"
        emissiveIntensity={0.15}
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
      const sway = reducedMotion ? 0 : Math.sin(time * 0.3 + index * 0.73) * 0.07;
      dummy.position.set(...plant.position);
      dummy.rotation.set(sway * 0.18, plant.rotation, sway);
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
    if (tickRef.current < 0.09) return;
    tickRef.current = 0;
    applyMatrices(state.clock.elapsedTime);
  });

  return (
    <instancedMesh
      ref={ref}
      name="reef-distant-vegetation"
      args={[undefined, undefined, vegetation.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <coneGeometry args={[0.16, 0.72, 5]} />
      <meshStandardMaterial
        color="#376d61"
        emissive="#173f3a"
        emissiveIntensity={0.12}
        roughness={0.94}
        metalness={0}
      />
    </instancedMesh>
  );
}

function DistantFishSchool({
  seedOffset,
  position,
  direction,
  phase,
  reducedMotion,
}: {
  seedOffset: number;
  position: Vec3;
  direction: 1 | -1;
  phase: number;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fish = useMemo(() => buildSchool(seedOffset), [seedOffset]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    fish.forEach((item, index) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(0, direction > 0 ? item.rotation : Math.PI + item.rotation, 0);
      dummy.scale.set(1.65 * item.scale, 0.62 * item.scale, 0.48 * item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [direction, dummy, fish]);

  useFrame(({ clock }) => {
    if (reducedMotion || !groupRef.current) return;
    const time = clock.elapsedTime;
    const travel = Math.sin(time * 0.075 + phase);
    groupRef.current.position.x = position[0] + direction * travel * 1.55;
    groupRef.current.position.y = position[1] + Math.sin(time * 0.11 + phase) * 0.18;
    groupRef.current.position.z = position[2] + Math.cos(time * 0.065 + phase) * 0.24;
  });

  return (
    <group ref={groupRef} position={[...position]}>
      <instancedMesh
        ref={meshRef}
        name={`reef-distant-fish-school-${seedOffset}`}
        args={[undefined, undefined, fish.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      >
        <sphereGeometry args={[0.12, 6, 4]} />
        <meshStandardMaterial
          color="#4a7776"
          emissive="#17383b"
          emissiveIntensity={0.18}
          roughness={0.88}
          metalness={0}
        />
      </instancedMesh>
    </group>
  );
}

/**
 * Cheap middle/background ecosystem pass. It deliberately avoids detailed GLB
 * assets: one instanced ridge, one instanced vegetation field and two tiny fish
 * schools are enough to create parallax, motion and scale behind the hero reef.
 */
export function ReefDistantEcosystem({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="reef-distant-ecosystem-v1">
      <DistantRidge />
      <DistantVegetation reducedMotion={reducedMotion} />
      <DistantFishSchool
        seedOffset={100}
        position={[-5.6, 2.4, -7.4]}
        direction={1}
        phase={0.4}
        reducedMotion={reducedMotion}
      />
      <DistantFishSchool
        seedOffset={300}
        position={[3.7, 3.45, -9.3]}
        direction={-1}
        phase={2.2}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
