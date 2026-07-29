import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TreeLeafGeometryState } from '@/engine/leafGeometry';
import type { OrganicSweepMesh } from '@/engine/labs/organic';
import {
  createThreeOrganicSweepGeometry,
  createThreeTreeLeafInstancedMesh,
} from '@/engine/renderer/three';

interface TreeLabObjectProps {
  mesh: OrganicSweepMesh;
  leaves: TreeLeafGeometryState;
}

export function TreeLabObject({ mesh, leaves }: TreeLabObjectProps) {
  const branchGeometry = useMemo(() => createThreeOrganicSweepGeometry(mesh), [mesh]);
  const branchMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#79533f',
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
      // OrbitControls may expose the reverse side of terminal/base caps.
      // DoubleSide keeps the laboratory sweep visibly closed from every angle.
      side: THREE.DoubleSide,
    }),
    [],
  );
  const leafMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#668f58',
      roughness: 0.88,
      metalness: 0,
      flatShading: false,
      side: THREE.DoubleSide,
    }),
    [],
  );
  const leafMesh = useMemo(
    () => createThreeTreeLeafInstancedMesh(leaves, leafMaterial),
    [leafMaterial, leaves],
  );

  useEffect(() => () => {
    branchGeometry.dispose();
    branchMaterial.dispose();
    leafMesh.geometry.dispose();
    leafMaterial.dispose();
  }, [branchGeometry, branchMaterial, leafMaterial, leafMesh]);

  return (
    <group>
      <mesh
        geometry={branchGeometry}
        material={branchMaterial}
        castShadow={false}
        receiveShadow={false}
      />
      {leaves.instances.length > 0 && <primitive object={leafMesh} />}
    </group>
  );
}
