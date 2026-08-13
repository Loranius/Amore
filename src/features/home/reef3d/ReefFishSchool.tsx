import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createFishSwimMaterialV2 } from './createFishSwimMaterialV2';
import { applyReefFishColors, createReefFishRenderGeometry } from './reefFishRenderKit';
import { buildDepthReefFish, createDepthRoamingState } from './reefFishDepthState';
import { writeDepthReefFishMatrices } from './reefFishDepthMotion';

export function ReefFishSchool({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const swimTime = useRef({ value: 0 });
  const fish = useMemo(buildDepthReefFish, []);
  const roaming = useMemo(() => createDepthRoamingState(fish), [fish]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => createReefFishRenderGeometry(fish), [fish]);
  const material = useMemo(() => createFishSwimMaterialV2(swimTime.current), []);

  useEffect(() => () => {
    material.dispose();
    geometry.dispose();
  }, [geometry, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    applyReefFishColors(mesh, fish);
    writeDepthReefFishMatrices(mesh, dummy, fish, roaming, 0, 0);
  }, [dummy, fish, roaming]);

  useFrame((state, delta) => {
    swimTime.current.value = reducedMotion ? 0 : state.clock.elapsedTime;
    if (!reducedMotion && meshRef.current) {
      writeDepthReefFishMatrices(
        meshRef.current,
        dummy,
        fish,
        roaming,
        state.clock.elapsedTime,
        delta,
      );
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, fish.length]}
      frustumCulled={false}
      name="reef-local-kenney-fish-school-depth-roaming"
    />
  );
}
