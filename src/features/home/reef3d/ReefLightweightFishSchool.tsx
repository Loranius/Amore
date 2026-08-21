import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createFishSwimMaterialV2 } from './createFishSwimMaterialV2';
import { buildReefFish, writeReefFishMatrices } from './reefFishMotion';
import { createReefFishRenderGeometry } from './reefFishRenderKit';
import type { ReefFishSchoolMetrics } from './ReefFishSchool';

const MATRIX_UPDATE_INTERVAL = 1 / 30;

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * One draw-call mobile school. The relationship-driven visible count still
 * selects how many fish exist, while the local CC0 mesh avoids nine skinned
 * rigs, animation clips and per-route collision work on touch devices.
 */
export function ReefLightweightFishSchool({
  count,
  identitySeed,
  onReady,
  reducedMotion,
}: {
  count: number;
  identitySeed: number;
  onReady?: ((metrics: ReefFishSchoolMetrics) => void) | undefined;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const accumulatorRef = useRef(0);
  const swimTime = useRef({ value: 0 });
  const fish = useMemo(
    () => buildReefFish(count, identitySeed),
    [count, identitySeed],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => createReefFishRenderGeometry(fish), [fish]);
  const material = useMemo(() => createFishSwimMaterialV2(swimTime.current), []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeReefFishMatrices(mesh, dummy, fish, 0);
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();

    if (!onReady || !mesh.boundingBox) return;
    const size = mesh.boundingBox.getSize(new THREE.Vector3());
    onReady({
      animatedRoutes: fish.length,
      depth: roundMetric(size.z),
      height: roundMetric(size.y),
      meshes: 1,
      routes: fish.length,
      scale: 1,
      tracks: 0,
      width: roundMetric(size.x),
    });
  }, [dummy, fish, onReady]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    swimTime.current.value = state.clock.elapsedTime;
    accumulatorRef.current += Math.min(Math.max(delta, 0), 0.05);
    if (accumulatorRef.current < MATRIX_UPDATE_INTERVAL) return;
    accumulatorRef.current %= MATRIX_UPDATE_INTERVAL;
    if (meshRef.current) {
      writeReefFishMatrices(
        meshRef.current,
        dummy,
        fish,
        state.clock.elapsedTime,
      );
    }
  });

  if (fish.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, fish.length]}
      castShadow={false}
      receiveShadow={false}
      name="reef-lightweight-fish-school"
    />
  );
}
