import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TreeLeafGeometryState } from '@/engine/leafGeometry';
import type { OrganicSweepMesh } from '@/engine/labs/organic';
import {
  sampleTreeLifeFrame,
  type TreeLifeState,
} from '@/engine/treeLife';
import type { TreeMaterialState } from '@/engine/treeMaterial';
import {
  applyThreeTreeLifeFrame,
  createThreeOrganicSweepGeometry,
  createThreeTreeLeafInstancedMesh,
  createThreeTreeLifeBinding,
  createThreeTreeMaterialPair,
  type ThreeTreeLifeBinding,
} from '@/engine/renderer/three';

interface TreeLabObjectProps {
  mesh: OrganicSweepMesh;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  life: TreeLifeState;
  reducedMotion: boolean;
}

export function TreeLabObject({
  mesh,
  leaves,
  materials,
  life,
  reducedMotion,
}: TreeLabObjectProps) {
  const motionRoot = useRef<THREE.Group>(null);
  const lifeBinding = useRef<ThreeTreeLifeBinding | null>(null);
  const branchGeometry = useMemo(() => createThreeOrganicSweepGeometry(mesh), [mesh]);
  const materialPair = useMemo(
    () => createThreeTreeMaterialPair(materials),
    [materials],
  );
  const leafMesh = useMemo(
    () => createThreeTreeLeafInstancedMesh(leaves, materialPair.foliage),
    [leaves, materialPair],
  );

  useEffect(() => {
    if (!motionRoot.current) return undefined;
    lifeBinding.current = createThreeTreeLifeBinding(motionRoot.current, leafMesh);
    return () => {
      lifeBinding.current = null;
    };
  }, [leafMesh]);

  useFrame(({ clock }) => {
    if (!lifeBinding.current) return;
    applyThreeTreeLifeFrame(
      lifeBinding.current,
      sampleTreeLifeFrame({
        life,
        elapsedSeconds: clock.getElapsedTime(),
        reducedMotion,
      }),
    );
  });

  useEffect(() => () => {
    branchGeometry.dispose();
    leafMesh.geometry.dispose();
    materialPair.bark.dispose();
    materialPair.foliage.dispose();
  }, [branchGeometry, leafMesh, materialPair]);

  return (
    <group ref={motionRoot}>
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
