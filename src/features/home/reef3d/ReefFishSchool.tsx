import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createKenneyFishGeometry } from './kenneyFishGeometry';
import { buildReefFish, REEF_FISH_TINTS, writeReefFishMatrices } from './reefFishMotion';

export function ReefFishSchool({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fish = useMemo(buildReefFish, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(createKenneyFishGeometry, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.Color();
    fish.forEach((_, index) => {
      color.set(REEF_FISH_TINTS[index % REEF_FISH_TINTS.length]!);
      mesh.setColorAt(index, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    writeReefFishMatrices(mesh, dummy, fish, 0);
  }, [dummy, fish]);

  useFrame((state) => {
    if (!reducedMotion && meshRef.current) {
      writeReefFishMatrices(meshRef.current, dummy, fish, state.clock.elapsedTime);
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, fish.length]}
      frustumCulled={false}
      name="reef-local-kenney-fish-school"
    >
      <meshStandardMaterial vertexColors roughness={0.86} metalness={0} flatShading />
    </instancedMesh>
  );
}
