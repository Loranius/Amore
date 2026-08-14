import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_SEABED_Y } from './reefTerracedFoundation';

type Vec3 = readonly [number, number, number];

const SPONGES = [
  { position: [-5.05, 0, 2.05] as Vec3, scale: [0.24, 0.42, 0.24] as Vec3, color: '#bd7652' },
  { position: [-4.55, 0, -0.45] as Vec3, scale: [0.18, 0.34, 0.18] as Vec3, color: '#d39a64' },
  { position: [4.75, 0, 1.9] as Vec3, scale: [0.22, 0.38, 0.22] as Vec3, color: '#c57b5e' },
  { position: [5.25, 0, -2.1] as Vec3, scale: [0.2, 0.31, 0.2] as Vec3, color: '#d0a05f' },
  { position: [-3.45, 0, -4.0] as Vec3, scale: [0.17, 0.27, 0.17] as Vec3, color: '#b86d62' },
  { position: [3.55, 0, -4.1] as Vec3, scale: [0.18, 0.3, 0.18] as Vec3, color: '#cc8f68' },
] as const;

const SOFT_CORALS = [
  { position: [-4.1, 0, 2.75] as Vec3, rotation: -0.35, scale: 0.74, color: '#987aa6' },
  { position: [4.2, 0, 2.7] as Vec3, rotation: 0.28, scale: 0.68, color: '#b5798e' },
  { position: [-4.85, 0, -3.0] as Vec3, rotation: 0.15, scale: 0.62, color: '#8f789e' },
  { position: [4.85, 0, -3.05] as Vec3, rotation: -0.2, scale: 0.66, color: '#ad7e96' },
] as const;

const DOWN = new THREE.Vector3(0, -1, 0);
const GROUND_RAYCASTER = new THREE.Raycaster();
const GROUND_ORIGIN = new THREE.Vector3();

function visibleGroundMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const environment = scene.getObjectByName('reef-environment-light-terraces');
  if (!environment) return [];
  const meshes: THREE.Mesh[] = [];
  environment.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    if (object.userData.reefContactPatchCount !== undefined) return;
    if (object.userData.reefSupportSurfaceKind === 'arch') return;
    meshes.push(object);
  });
  return meshes;
}

function groundYAt(scene: THREE.Scene, x: number, z: number): number {
  const meshes = visibleGroundMeshes(scene);
  if (meshes.length === 0) return REEF_SEABED_Y;
  GROUND_ORIGIN.set(x, 5, z);
  GROUND_RAYCASTER.set(GROUND_ORIGIN, DOWN);
  GROUND_RAYCASTER.near = 0;
  GROUND_RAYCASTER.far = 8;
  const hit = GROUND_RAYCASTER.intersectObjects(meshes, false)[0];
  return hit?.point.y ?? REEF_SEABED_Y;
}

function useGroundedGroup(
  ref: React.RefObject<THREE.Group | null>,
  x: number,
  z: number,
): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    scene.updateMatrixWorld(true);
    group.position.y = groundYAt(scene, x, z) + 0.012;
    group.updateMatrixWorld(true);
    invalidate();
  }, [invalidate, ref, scene, x, z]);
}

function Sponge({ position, scale, color }: { position: Vec3; scale: Vec3; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useGroundedGroup(groupRef, position[0], position[2]);

  return (
    <group ref={groupRef} position={[position[0], REEF_SEABED_Y, position[2]]}>
      <mesh position={[0, scale[1] * 0.5, 0]} scale={[scale[0], scale[1], scale[2]]}>
        <cylinderGeometry args={[0.52, 0.72, 1, 8, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
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
  useGroundedGroup(groupRef, position[0], position[2]);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.48 + phase) * 0.045;
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], REEF_SEABED_Y, position[2]]}
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
