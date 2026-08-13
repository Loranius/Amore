import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createFishSwimMaterialV2 } from './createFishSwimMaterialV2';
import { createKenneyFishGeometry } from './kenneyFishGeometry';
import { buildReefFish, REEF_FISH_TINTS, writeReefFishMatrices } from './reefFishMotion';

export function ReefFishSchool({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const swimTime = useRef({ value: 0 });
  const fish = useMemo(buildReefFish, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const next = createKenneyFishGeometry();
    next.computeVertexNormals();
    next.normalizeNormals();

    const swimParams = new Float32Array(fish.length * 3);
    fish.forEach((item, index) => {
      const speedT = THREE.MathUtils.clamp((item.speed - 0.12) / 0.11, 0, 1);
      const scaleT = THREE.MathUtils.clamp((item.scale - 0.34) / 0.2, 0, 1);
      swimParams[index * 3] = item.phase * 1.67 + index * 0.83;
      swimParams[index * 3 + 1] = THREE.MathUtils.lerp(2.2, 3.8, speedT);
      swimParams[index * 3 + 2] = THREE.MathUtils.lerp(0.05, 0.09, scaleT);
    });
    next.setAttribute('instanceSwimParams', new THREE.InstancedBufferAttribute(swimParams, 3));

    return next;
  }, [fish]);
  const material = useMemo(() => createFishSwimMaterialV2(swimTime.current), []);

  useEffect(() => () => {
    material.dispose();
    geometry.dispose();
  }, [geometry, material]);

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
    swimTime.current.value = reducedMotion ? 0 : state.clock.elapsedTime;
    if (!reducedMotion && meshRef.current) {
      writeReefFishMatrices(meshRef.current, dummy, fish, state.clock.elapsedTime);
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, fish.length]}
      frustumCulled={false}
      name="reef-local-kenney-fish-school"
    />
  );
}
