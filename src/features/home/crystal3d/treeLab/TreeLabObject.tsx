import { useEffect, useMemo } from 'react';
import type { TreeLeafGeometryState } from '@/engine/leafGeometry';
import type { OrganicSweepMesh } from '@/engine/labs/organic';
import type { TreeMaterialState } from '@/engine/treeMaterial';
import {
  createThreeOrganicSweepGeometry,
  createThreeTreeLeafInstancedMesh,
  createThreeTreeMaterialPair,
} from '@/engine/renderer/three';

interface TreeLabObjectProps {
  mesh: OrganicSweepMesh;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
}

export function TreeLabObject({ mesh, leaves, materials }: TreeLabObjectProps) {
  const branchGeometry = useMemo(() => createThreeOrganicSweepGeometry(mesh), [mesh]);
  const materialPair = useMemo(
    () => createThreeTreeMaterialPair(materials),
    [materials],
  );
  const leafMesh = useMemo(
    () => createThreeTreeLeafInstancedMesh(leaves, materialPair.foliage),
    [leaves, materialPair],
  );

  useEffect(() => () => {
    branchGeometry.dispose();
    leafMesh.geometry.dispose();
    materialPair.bark.dispose();
    materialPair.foliage.dispose();
  }, [branchGeometry, leafMesh, materialPair]);

  return (
    <group>
      <mesh
        geometry={branchGeometry}
        material={materialPair.bark}
        castShadow={false}
        receiveShadow={false}
      />
      {leaves.instances.length > 0 && <primitive object={leafMesh} />}
    </group>
  );
}
