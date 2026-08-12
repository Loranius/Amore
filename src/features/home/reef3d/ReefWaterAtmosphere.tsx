import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial, Points } from 'three';

type Vec3 = readonly [number, number, number];

type AnimatedCausticProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: number;
  phase: number;
  reducedMotion: boolean;
};

function AnimatedCaustic({
  position,
  scale,
  rotation = 0,
  phase,
  reducedMotion,
}: AnimatedCausticProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsed = clock.getElapsedTime();
    const pulse = 1 + Math.sin(elapsed * 0.54 + phase) * 0.08;
    const mesh = meshRef.current;
    if (mesh) {
      mesh.rotation.z = rotation + Math.sin(elapsed * 0.22 + phase) * 0.12;
      mesh.scale.set(scale[0] * pulse, scale[1] * (2 - pulse), scale[2]);
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.035 + (Math.sin(elapsed * 0.72 + phase) + 1) * 0.012;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      scale={[scale[0], scale[1], scale[2]]}
    >
      <ringGeometry args={[0.58, 1.05, 28]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#c7fff6"
        transparent
        opacity={0.045}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function LightShaft({
  position,
  rotation,
  scale,
  phase,
  reducedMotion,
}: {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  phase: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsed = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.z = rotation[2] + Math.sin(elapsed * 0.16 + phase) * 0.025;
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.028 + (Math.sin(elapsed * 0.3 + phase) + 1) * 0.008;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      scale={[scale[0], scale[1], scale[2]]}
    >
      <coneGeometry args={[1, 1, 16, 1, true]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#bffbf3"
        transparent
        opacity={0.034}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function SuspendedParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);
  const positions = useMemo(() => {
    const count = 64;
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      values[offset] = (seededUnit(index, 1) - 0.5) * 15;
      values[offset + 1] = seededUnit(index, 2) * 6.4 - 0.15;
      values[offset + 2] = (seededUnit(index, 3) - 0.5) * 15 - 1.2;
    }
    return values;
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsed = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(elapsed * 0.08) * 0.16;
      groupRef.current.position.z = Math.cos(elapsed * 0.07) * 0.12;
      groupRef.current.position.y = Math.sin(elapsed * 0.11) * 0.05;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = Math.sin(elapsed * 0.035) * 0.025;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#d8fffa"
          size={0.035}
          transparent
          opacity={0.22}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

/**
 * Lightweight underwater atmosphere.
 *
 * Stage 4 keeps the Stage 2 composition but lowers geometry density and a little
 * particle opacity. Fog and transparency provide the volume impression; no
 * texture downloads, post-processing or expensive volumetrics are introduced.
 */
export function ReefWaterAtmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="reef-water-atmosphere-stage-4">
      {/* A translucent back veil strengthens depth separation behind the reef. */}
      <mesh position={[0, 2.6, -10.5]} scale={[14, 7.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#1c7080"
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Surface shafts stay broad and faint. Coarse geometry is enough because
          fog and transparency hide the silhouette of the cones. */}
      <LightShaft
        position={[-3.2, 3.6, -1.8]}
        rotation={[0.04, 0, 0.18]}
        scale={[1.65, 7.2, 1.25]}
        phase={0.2}
        reducedMotion={reducedMotion}
      />
      <LightShaft
        position={[0.3, 4.1, -2.8]}
        rotation={[0.03, 0, -0.08]}
        scale={[1.4, 8.1, 1.15]}
        phase={1.5}
        reducedMotion={reducedMotion}
      />
      <LightShaft
        position={[3.7, 3.3, -1.2]}
        rotation={[0.05, 0, -0.2]}
        scale={[1.25, 6.4, 1.05]}
        phase={2.7}
        reducedMotion={reducedMotion}
      />

      <AnimatedCaustic
        position={[-2.2, -0.315, 1.6]}
        scale={[1.75, 1.05, 1]}
        rotation={0.26}
        phase={0.1}
        reducedMotion={reducedMotion}
      />
      <AnimatedCaustic
        position={[1.7, -0.314, 1.1]}
        scale={[1.3, 0.9, 1]}
        rotation={-0.24}
        phase={1.4}
        reducedMotion={reducedMotion}
      />
      <AnimatedCaustic
        position={[0.25, -0.313, -2.2]}
        scale={[2.1, 1.18, 1]}
        rotation={0.08}
        phase={2.2}
        reducedMotion={reducedMotion}
      />
      <AnimatedCaustic
        position={[3.5, -0.312, -0.5]}
        scale={[1.05, 0.72, 1]}
        rotation={0.38}
        phase={3.1}
        reducedMotion={reducedMotion}
      />

      <SuspendedParticles reducedMotion={reducedMotion} />
    </group>
  );
}
