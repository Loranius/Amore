import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TreeBarkSurfaceState } from '@/engine/barkSurface';
import type { TreeCanopyDepthState } from '@/engine/canopyDepth';
import type { TreeCanopyLightState } from '@/engine/canopyLight';
import type { TreeCrownSilhouetteState } from '@/engine/crownSilhouette';
import type { TreeGroundDetailState } from '@/engine/groundDetail';
import type { TreeLeafGeometryState } from '@/engine/leafGeometry';
import type { TreeLeafOrientationState } from '@/engine/leafOrientation';
import type { OrganicSweepMesh } from '@/engine/labs/organic';
import type { TreePhenologyState } from '@/engine/phenology';
import type { TreeRootGeometryState } from '@/engine/rootGeometry';
import type { TreeSoilSurfaceState } from '@/engine/soilSurface';
import {
  sampleTreeLifeFrame,
  type TreeLifeState,
} from '@/engine/treeLife';
import type { TreeMaterialState } from '@/engine/treeMaterial';
import {
  applyThreeTreeLifeFrame,
  createThreeOrganicSweepGeometry,
  createThreeTreeGroundDetailInstancedMesh,
  createThreeTreeLeafInstancedMesh,
  createThreeTreeLifeBinding,
  createThreeTreeMaterialPair,
  createThreeTreeRootGeometry,
  type ThreeTreeLifeBinding,
} from '@/engine/renderer/three';

interface TreeLabObjectProps {
  mesh: OrganicSweepMesh;
  rootGeometry: TreeRootGeometryState;
  soilSurface: TreeSoilSurfaceState;
  barkSurface: TreeBarkSurfaceState;
  canopyDepth: TreeCanopyDepthState;
  canopyLight: TreeCanopyLightState;
  phenology: TreePhenologyState;
  leafOrientation: TreeLeafOrientationState;
  crownSilhouette: TreeCrownSilhouetteState;
  groundDetails: TreeGroundDetailState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  life: TreeLifeState;
  reducedMotion: boolean;
  showGroundDetails?: boolean;
}

export function TreeLabObject({
  mesh,
  rootGeometry,
  soilSurface,
  barkSurface,
  canopyDepth,
  canopyLight,
  phenology,
  leafOrientation,
  crownSilhouette,
  groundDetails,
  leaves,
  materials,
  life,
  reducedMotion,
  showGroundDetails = true,
}: TreeLabObjectProps) {
  const motionRoot = useRef<THREE.Group>(null);
  const lifeBinding = useRef<ThreeTreeLifeBinding | null>(null);
  const branchGeometry = useMemo(
    () => createThreeOrganicSweepGeometry(mesh, barkSurface),
    [mesh, barkSurface],
  );
  const rootsGeometry = useMemo(
    () => createThreeTreeRootGeometry(rootGeometry, soilSurface, barkSurface),
    [rootGeometry, soilSurface, barkSurface],
  );
  const materialPair = useMemo(
    () => createThreeTreeMaterialPair(materials, barkSurface),
    [materials, barkSurface],
  );
  const leafMesh = useMemo(
    () => createThreeTreeLeafInstancedMesh(
      leaves,
      materialPair.foliage,
      canopyDepth,
      canopyLight,
      phenology,
      leafOrientation,
      crownSilhouette,
    ),
    [
      leaves,
      materialPair,
      canopyDepth,
      canopyLight,
      phenology,
      leafOrientation,
      crownSilhouette,
    ],
  );
  const groundDetailMesh = useMemo(
    () => createThreeTreeGroundDetailInstancedMesh(groundDetails),
    [groundDetails],
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
    rootsGeometry.dispose();
    leafMesh.geometry.dispose();
    groundDetailMesh.geometry.dispose();
    if (Array.isArray(groundDetailMesh.material)) {
      for (const material of groundDetailMesh.material) material.dispose();
    } else {
      groundDetailMesh.material.dispose();
    }
    materialPair.bark.dispose();
    materialPair.foliage.dispose();
  }, [branchGeometry, rootsGeometry, leafMesh, groundDetailMesh, materialPair]);

  return (
    <group>
      {rootGeometry.diagnostics.vertexCount > 0 && (
        <mesh
          geometry={rootsGeometry}
          material={materialPair.bark}
          castShadow={false}
          receiveShadow={false}
          userData={{
            treeRootAnchored: true,
            treeTerrainMerged: rootGeometry.diagnostics.terrainMergedIntoStaticMesh,
            treeSoilTintApplied: true,
            treeBarkSurfaceApplied: true,
          }}
        />
      )}
      {showGroundDetails && groundDetails.instances.length > 0 && <primitive object={groundDetailMesh} />}
      <group ref={motionRoot}>
        <mesh
          geometry={branchGeometry}
          material={materialPair.bark}
          castShadow={false}
          receiveShadow={false}
          userData={{ treeBarkSurfaceApplied: true }}
        />
        {leaves.instances.length > 0 && <primitive object={leafMesh} />}
      </group>
    </group>
  );
}
