import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  applyReefRockBiofilmMaterial,
  buildReefRockBiofilmProfile,
  REEF_ROCK_BIOFILM_VERSION,
} from './reefRockBiofilm';

const TARGET_MATERIAL_NAMES = new Set([
  'reef-coral-stone-near',
  'reef-coral-stone-hero',
  'reef-limestone-terrace-top',
  'reef-limestone-terrace-side',
  'reef-limestone-year-arch',
]);

function collectRockMaterials(scene: THREE.Scene): THREE.MeshStandardMaterial[] {
  const materials = new Set<THREE.MeshStandardMaterial>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    source.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      if (!TARGET_MATERIAL_NAMES.has(material.name)) return;
      materials.add(material);
    });
  });

  return [...materials];
}

/**
 * Material-only ecological aging pass. It binds the same PBR limestone used by
 * the real terrain/arches to a pair-specific world-space biofilm shader.
 * No overlay meshes, decals or extra draw calls are created here.
 */
export function ReefRockBiofilmLayer({ build }: { build: ReefPreviewBuild }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const ecology = build.species.moduleEvolution.development.ecology;
  const profile = useMemo(() => buildReefRockBiofilmProfile({
    identitySeed: build.species.moduleEvolution.identitySeed,
    completedYears: build.species.moduleEvolution.facts.completedYears,
    colonization: ecology.colonization,
    biodiversity: ecology.biodiversity,
    substrateMaturity: build.species.state.substrateMaturity,
  }), [
    build.species.moduleEvolution.facts.completedYears,
    build.species.moduleEvolution.identitySeed,
    build.species.state.substrateMaturity,
    ecology.biodiversity,
    ecology.colonization,
  ]);

  useEffect(() => {
    scene.updateMatrixWorld(true);
    const materials = collectRockMaterials(scene);
    materials.forEach((material) => applyReefRockBiofilmMaterial(material, profile));
    invalidate();
  }, [invalidate, profile, scene]);

  return (
    <group
      name="reef-rock-biofilm-material-pass"
      userData={{
        reefRockBiofilmVersion: REEF_ROCK_BIOFILM_VERSION,
        reefRockBiofilmCoverage: profile.coverage,
        reefRockBiofilmTintStrength: profile.algaeTintStrength,
        reefRockBiofilmCreviceDarkening: profile.creviceDarkening,
        reefRockBiofilmRoughnessVariation: profile.roughnessVariation,
      }}
    />
  );
}
