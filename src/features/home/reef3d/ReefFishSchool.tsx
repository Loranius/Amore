import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createFishSwimMaterialV2 } from './createFishSwimMaterialV2';
import { buildReefFish, writeReefFishMatrices } from './reefFishMotion';
import { createReefFishRenderGeometry } from './reefFishRenderKit';

export interface ReefFishSchoolMetrics {
  animatedRoutes: number;
  depth: number;
  height: number;
  meshes: number;
  routes: number;
  scale: number;
  tracks: number;
  width: number;
}

interface ReefFishSchoolProps {
  count: number;
  identitySeed: number;
  onReady?: ((metrics: ReefFishSchoolMetrics) => void) | undefined;
  reducedMotion: boolean;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * One instanced, genuinely moving fish per completed Plan.
 *
 * The compact Kenney CC0 mesh shares one geometry and one material across the
 * whole school. Pair DNA changes route radii, phase, height and colour while a
 * later completed plan appends one route without reseeding the previous fish.
 */
export function ReefFishSchool({
  count,
  identitySeed,
  onReady,
  reducedMotion,
}: ReefFishSchoolProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const swimTime = useMemo(() => ({ value: 0 }), []);
  const fish = useMemo(
    () => buildReefFish(count, identitySeed),
    [count, identitySeed],
  );
  const geometry = useMemo(() => createReefFishRenderGeometry(fish), [fish]);
  const material = useMemo(() => createFishSwimMaterialV2(swimTime), [swimTime]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeReefFishMatrices(mesh, dummy, fish, 0);
  }, [dummy, fish]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reducedMotion) return;
    const elapsed = state.clock.getElapsedTime();
    swimTime.value = elapsed;
    writeReefFishMatrices(mesh, dummy, fish, elapsed);
  });

  useEffect(() => {
    if (!onReady) return;
    const maximumX = fish.reduce(
      (maximum, item) => Math.max(maximum, Math.abs(item.center[0]) + item.radiusX + item.scale),
      0,
    );
    const maximumZ = fish.reduce(
      (maximum, item) => Math.max(maximum, Math.abs(item.center[2]) + item.radiusZ + item.scale),
      0,
    );
    const minimumY = fish.reduce(
      (minimum, item) => Math.min(minimum, item.center[1] - item.heightDrift - item.scale),
      Number.POSITIVE_INFINITY,
    );
    const maximumY = fish.reduce(
      (maximum, item) => Math.max(maximum, item.center[1] + item.heightDrift + item.scale),
      Number.NEGATIVE_INFINITY,
    );
    const routes = fish.length;
    onReady({
      animatedRoutes: routes,
      depth: roundMetric(maximumZ * 2),
      height: routes > 0 ? roundMetric(maximumY - minimumY) : 0,
      meshes: routes > 0 ? 1 : 0,
      routes,
      scale: 1,
      tracks: routes * 2,
      width: roundMetric(maximumX * 2),
    });
  }, [fish, onReady]);

  if (fish.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      name="reef-plan-fish-school"
      args={[geometry, material, fish.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
