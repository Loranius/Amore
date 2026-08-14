import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_ROCK_TEXTURE_PATHS } from './reefAssetManifest';
import { REEF_SCENE_PALETTE } from './reefSceneProfile';

interface ReefRockMaterials {
  arch: THREE.MeshStandardMaterial;
  distant: THREE.MeshStandardMaterial;
  foundationSide: THREE.MeshStandardMaterial;
  foundationTop: THREE.MeshStandardMaterial;
  hero: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
}

/** One cached 1K PBR texture set and shared materials for all world limestone. */
export function useReefRockMaterials(): ReefRockMaterials {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const [map, normalMap, roughnessMap] = useTexture([
    `${import.meta.env.BASE_URL}${REEF_ROCK_TEXTURE_PATHS.color}`,
    `${import.meta.env.BASE_URL}${REEF_ROCK_TEXTURE_PATHS.normal}`,
    `${import.meta.env.BASE_URL}${REEF_ROCK_TEXTURE_PATHS.roughness}`,
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture];

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.colorSpace = THREE.NoColorSpace;
    [map, normalMap, roughnessMap].forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.4, 2.4);
      texture.anisotropy = Math.min(4, maxAnisotropy);
      texture.needsUpdate = true;
    });
  }, [map, maxAnisotropy, normalMap, roughnessMap]);

  const materials = useMemo<ReefRockMaterials>(() => {
    const common = {
      map,
      normalMap,
      roughnessMap,
      metalness: 0,
      roughness: 0.96,
      normalScale: new THREE.Vector2(0.32, 0.32),
    };
    const rock = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-coral-stone-near',
      color: REEF_SCENE_PALETTE.rockNear,
      emissive: REEF_SCENE_PALETTE.rockEmissive,
      emissiveIntensity: 0.025,
    });
    const foundationTop = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-limestone-terrace-top',
      color: REEF_SCENE_PALETTE.foundationTop,
      roughness: 0.9,
      normalScale: new THREE.Vector2(0.28, 0.28),
      emissive: REEF_SCENE_PALETTE.rockEmissive,
      emissiveIntensity: 0.045,
    });
    const foundationSide = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-limestone-terrace-side',
      color: REEF_SCENE_PALETTE.foundationSide,
      roughness: 0.97,
      normalScale: new THREE.Vector2(0.4, 0.4),
      emissive: REEF_SCENE_PALETTE.rockEmissive,
      emissiveIntensity: 0.025,
    });
    const arch = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-limestone-year-arch',
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.94,
      normalScale: new THREE.Vector2(0.34, 0.34),
      emissive: REEF_SCENE_PALETTE.rockEmissive,
      emissiveIntensity: 0.035,
      flatShading: true,
    });
    const hero = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-coral-stone-hero',
      color: REEF_SCENE_PALETTE.rockHero,
      roughness: 0.92,
      normalScale: new THREE.Vector2(0.24, 0.24),
      emissive: REEF_SCENE_PALETTE.rockEmissive,
      emissiveIntensity: 0.02,
    });
    const distant = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-coral-stone-distant',
      color: REEF_SCENE_PALETTE.rockDistant,
      roughness: 1,
      normalScale: new THREE.Vector2(0.18, 0.18),
      emissive: REEF_SCENE_PALETTE.distantEmissive,
      emissiveIntensity: 0.018,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    return { arch, distant, foundationSide, foundationTop, hero, rock };
  }, [map, normalMap, roughnessMap]);

  useEffect(() => () => {
    materials.arch.dispose();
    materials.rock.dispose();
    materials.hero.dispose();
    materials.foundationTop.dispose();
    materials.foundationSide.dispose();
    materials.distant.dispose();
  }, [materials]);

  return materials;
}
