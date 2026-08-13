import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Vec3 = readonly [number, number, number];

const SPONGES = [
  { position: [-5.05, 0.18, 2.05] as Vec3, scale: [0.24, 0.42, 0.24] as Vec3, color: '#bd7652' },
  { position: [-4.55, 0.1, -0.45] as Vec3, scale: [0.18, 0.34, 0.18] as Vec3, color: '#d39a64' },
  { position: [4.75, 0.16, 1.9] as Vec3, scale: [0.22, 0.38, 0.22] as Vec3, color: '#c57b5e' },
  { position: [5.25, 0.08, -2.1] as Vec3, scale: [0.2, 0.31, 0.2] as Vec3, color: '#d0a05f' },
  { position: [-3.45, -0.02, -4.0] as Vec3, scale: [0.17, 0.27, 0.17] as Vec3, color: '#b86d62' },
  { position: [3.55, -0.02, -4.1] as Vec3, scale: [0.18, 0.3, 0.18] as Vec3, color: '#cc8f68' },
] as const;

const SOFT_CORALS = [
  { position: [-4.1, 0.02, 2.75] as Vec3, rotation: -0.35, scale: 0.74, color: '#987aa6' },
  { position: [4.2, 0.0, 2.7] as Vec3, rotation: 0.28, scale: 0.68, color: '#b5798e' },
  { position: [-4.85, -0.04, -3.0] as Vec3, rotation: 0.15, scale: 0.62, color: '#8f789e' },
  { position: [4.85, -0.05, -3.05] as Vec3, rotation: -0.2, scale: 0.66, color: '#ad7e96' },
] as const;

function Sponge({ position, scale, color }: { position: Vec3; scale: Vec3; color: string }) {
  return (
    <mesh position={[position[0], position[1], position[2]]} scale={[scale[0], scale[1], scale[2]]}>
      <cylinderGeometry args={[0.52, 0.72, 1, 8, 1, true]} />
      <meshStandardMaterial color={color} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SoftCoral({
  position,
  rotation,
  scale,
  color,
  reducedMotion,
}: {
  position: Vec3;
  rotation: number;
  scale: number;
  color: string;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] * 0.71 + position[2] * 0.39, [position]);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.48 + phase) * 0.045;
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
      {[-0.18, 0, 0.19].map((offset, index) => (
        <mesh
          key={`soft-coral-arm-${index}`}
          position={[offset, 0.18 + index * 0.05, 0]}
          rotation={[0, 0, offset * 0.65]}
        >
          <cylinderGeometry args={[0.035, 0.07, 0.48 + index * 0.08, 6]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

export function ReefSessileLife({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {SPONGES.map((sponge, index) => (
        <Sponge key={`reef-sponge-${index}`} {...sponge} />
      ))}
      {SOFT_CORALS.map((coral, index) => (
        <SoftCoral key={`reef-soft-coral-${index}`} {...coral} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}
