import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Vec3 = readonly [number, number, number];

type LifeInstance = {
  position: Vec3;
  rotation: number;
  scale: number;
  phase: number;
  tone: number;
};

const MAX_SEA_GRASS_COUNT = 52;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildSeaGrass(count: number): LifeInstance[] {
  const clusters = [
    { center: [-4.35, -0.18, 1.65] as Vec3, radius: 1.45 },
    { center: [4.15, -0.2, 1.1] as Vec3, radius: 1.35 },
    { center: [-4.5, -0.22, -2.65] as Vec3, radius: 1.55 },
    { center: [4.75, -0.24, -2.35] as Vec3, radius: 1.5 },
  ] as const;

  const safeCount = Math.max(0, Math.min(MAX_SEA_GRASS_COUNT, Math.floor(count)));
  return Array.from({ length: safeCount }, (_, index) => {
    const cluster = clusters[index % clusters.length]!;
    const angle = seededUnit(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(seededUnit(index, 2)) * cluster.radius;
    const x = cluster.center[0] + Math.cos(angle) * radius;
    const z = cluster.center[2] + Math.sin(angle) * radius;
    return {
      position: [x, cluster.center[1], z],
      rotation: seededUnit(index, 3) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.72, 1.35, seededUnit(index, 4)),
      phase: seededUnit(index, 5) * Math.PI * 2,
      tone: seededUnit(index, 6),
    };
  });
}

export function ReefSeaGrass({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const grass = useMemo(() => buildSeaGrass(count), [count]);
  const tickRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dark = new THREE.Color('#315f50');
    const light = new THREE.Color('#5e8f67');
    const color = new THREE.Color();

    grass.forEach((blade, index) => {
      dummy.position.set(blade.position[0], blade.position[1] + 0.22 * blade.scale, blade.position[2]);
      dummy.rotation.set(0, blade.rotation, 0);
      dummy.scale.set(0.85 * blade.scale, blade.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, blade.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy, grass]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tickRef.current += delta;
    if (tickRef.current < 0.055) return;
    tickRef.current = 0;

    const mesh = meshRef.current;
    if (!mesh) return;
    const time = state.clock.elapsedTime;
    grass.forEach((blade, index) => {
      const sway = Math.sin(time * 0.72 + blade.phase + blade.position[0] * 0.17) * 0.095;
      dummy.position.set(blade.position[0], blade.position[1] + 0.22 * blade.scale, blade.position[2]);
      dummy.rotation.set(sway * 0.22, blade.rotation, sway);
      dummy.scale.set(0.85 * blade.scale, blade.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, grass.length]} frustumCulled={false}>
      <planeGeometry args={[0.1, 0.44, 1, 3]} />
      <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
