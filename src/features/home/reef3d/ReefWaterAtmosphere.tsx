import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  REEF_ATMOSPHERE_PROFILE,
  REEF_SCENE_PALETTE,
} from './reefSceneProfile';

type Vec3 = readonly [number, number, number];

type LightShaftDefinition = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  phase: number;
};

type CausticDefinition = {
  position: Vec3;
  scale: Vec3;
  rotation: number;
  phase: number;
};

const MATRIX_UPDATE_INTERVAL = 1 / 30;

const LIGHT_SHAFTS: readonly LightShaftDefinition[] = [
  { position: [-6.1, 3.7, -5.4], rotation: [0.05, 0, 0.24], scale: [1.9, 8.4, 1.4], phase: 3.9 },
  { position: [-3.2, 3.6, -1.8], rotation: [0.04, 0, 0.18], scale: [1.65, 7.2, 1.25], phase: 0.2 },
  { position: [0.3, 4.1, -2.8], rotation: [0.03, 0, -0.08], scale: [1.4, 8.1, 1.15], phase: 1.5 },
  { position: [3.7, 3.3, -1.2], rotation: [0.05, 0, -0.2], scale: [1.25, 6.4, 1.05], phase: 2.7 },
  { position: [6.5, 4.2, -6.2], rotation: [0.04, 0, -0.27], scale: [1.7, 8.8, 1.3], phase: 5.1 },
] as const;

const CAUSTICS: readonly CausticDefinition[] = [
  { position: [-2.2, -0.315, 1.6], scale: [1.75, 1.05, 1], rotation: 0.26, phase: 0.1 },
  { position: [1.7, -0.314, 1.1], scale: [1.3, 0.9, 1], rotation: -0.24, phase: 1.4 },
  { position: [0.25, -0.313, -2.2], scale: [2.1, 1.18, 1], rotation: 0.08, phase: 2.2 },
  { position: [3.5, -0.312, -0.5], scale: [1.05, 0.72, 1], rotation: 0.38, phase: 3.1 },
] as const;

function boundedCount(count: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.floor(count)));
}

function InstancedLightShafts({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const accumulatorRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const shafts = useMemo(
    () => LIGHT_SHAFTS.slice(0, boundedCount(count, LIGHT_SHAFTS.length)),
    [count],
  );

  const writeMatrices = (time: number, animated: boolean) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    shafts.forEach((shaft, index) => {
      const sway = animated ? Math.sin(time * 0.16 + shaft.phase) * 0.025 : 0;
      dummy.position.set(...shaft.position);
      dummy.rotation.set(
        shaft.rotation[0],
        shaft.rotation[1],
        shaft.rotation[2] + sway,
      );
      dummy.scale.set(...shaft.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeMatrices(0, false);
    mesh.computeBoundingSphere();
  }, [shafts]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    accumulatorRef.current += Math.min(Math.max(delta, 0), 0.05);
    if (accumulatorRef.current < MATRIX_UPDATE_INTERVAL) return;
    accumulatorRef.current %= MATRIX_UPDATE_INTERVAL;
    const elapsed = clock.elapsedTime;
    writeMatrices(elapsed, true);
    if (materialRef.current) {
      materialRef.current.opacity = 0.033 + Math.sin(elapsed * 0.3) * 0.006;
    }
  });

  if (shafts.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, shafts.length]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      name="reef-light-shafts-instanced"
      userData={{ reefLightShaftCount: shafts.length }}
    >
      <coneGeometry args={[1, 1, 16, 1, true]} />
      <meshBasicMaterial
        ref={materialRef}
        color={REEF_SCENE_PALETTE.lightShaft}
        transparent
        opacity={0.034}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function InstancedCaustics({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const accumulatorRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const caustics = useMemo(
    () => CAUSTICS.slice(0, boundedCount(count, CAUSTICS.length)),
    [count],
  );

  const writeMatrices = (time: number, animated: boolean) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    caustics.forEach((caustic, index) => {
      const pulse = animated ? 1 + Math.sin(time * 0.54 + caustic.phase) * 0.08 : 1;
      const turn = animated ? Math.sin(time * 0.22 + caustic.phase) * 0.12 : 0;
      dummy.position.set(...caustic.position);
      dummy.rotation.set(-Math.PI / 2, 0, caustic.rotation + turn);
      dummy.scale.set(
        caustic.scale[0] * pulse,
        caustic.scale[1] * (2 - pulse),
        caustic.scale[2],
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeMatrices(0, false);
    mesh.computeBoundingSphere();
  }, [caustics]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    accumulatorRef.current += Math.min(Math.max(delta, 0), 0.05);
    if (accumulatorRef.current < MATRIX_UPDATE_INTERVAL) return;
    accumulatorRef.current %= MATRIX_UPDATE_INTERVAL;
    const elapsed = clock.elapsedTime;
    writeMatrices(elapsed, true);
    if (materialRef.current) {
      materialRef.current.opacity = 0.045 + Math.sin(elapsed * 0.72) * 0.01;
    }
  });

  if (caustics.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, caustics.length]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      name="reef-caustics-instanced"
      userData={{ reefCausticCount: caustics.length }}
    >
      <ringGeometry args={[0.58, 1.05, 28]} />
      <meshBasicMaterial
        ref={materialRef}
        color={REEF_SCENE_PALETTE.caustic}
        transparent
        opacity={0.045}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function SuspendedParticles({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const safeCount = boundedCount(count, 120);
    const values = new Float32Array(safeCount * 3);
    for (let index = 0; index < safeCount; index += 1) {
      const offset = index * 3;
      values[offset] = (seededUnit(index, 1) - 0.5) * 20;
      values[offset + 1] = seededUnit(index, 2) * 7 - 0.15;
      values[offset + 2] = (seededUnit(index, 3) - 0.5) * 22 - 2.6;
    }
    return values;
  }, [count]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsed = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(elapsed * 0.08) * 0.18;
      groupRef.current.position.z = Math.cos(elapsed * 0.07) * 0.15;
      groupRef.current.position.y = Math.sin(elapsed * 0.11) * 0.06;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = Math.sin(elapsed * 0.035) * 0.025;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={REEF_SCENE_PALETTE.particles}
          size={0.034}
          transparent
          opacity={0.2}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/**
 * Underwater depth without post-processing. Repeated shafts and caustics are
 * instanced, so the full desktop look now costs two draws instead of nine.
 */
export function ReefWaterAtmosphere({
  causticCount,
  lightShaftCount,
  particleCount,
  reducedMotion,
}: {
  causticCount: number;
  lightShaftCount: number;
  particleCount: number;
  reducedMotion: boolean;
}) {
  return (
    <group name="reef-water-atmosphere-stage-7-living-depth">
      <mesh position={[0, 2.6, -10.5]} scale={[14, 7.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={REEF_SCENE_PALETTE.waterVeil}
          transparent
          opacity={REEF_ATMOSPHERE_PROFILE.veilOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <InstancedLightShafts count={lightShaftCount} reducedMotion={reducedMotion} />
      <InstancedCaustics count={causticCount} reducedMotion={reducedMotion} />
      <SuspendedParticles count={particleCount} reducedMotion={reducedMotion} />
    </group>
  );
}
