import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { OrganicSweepMesh } from '@/engine/labs/organic';
import { createThreeOrganicSweepGeometry } from '@/engine/renderer/three';

export function TreeLabObject({ mesh }: { mesh: OrganicSweepMesh }) {
  const geometry = useMemo(() => createThreeOrganicSweepGeometry(mesh), [mesh]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#79533f',
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
    }),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
