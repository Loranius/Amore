import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_ROCK_TEXTURE_PATHS } from './reefAssetManifest';

interface ReefRockMaterials {
  distant: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
}

/** One cached 1K PBR texture set and two shared materials for all world rocks. */
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
      color: '#718079',
    });
    const distant = new THREE.MeshStandardMaterial({
      ...common,
      name: 'reef-coral-stone-distant',
      color: '#466c68',
      emissive: '#123a3b',
      emissiveIntensity: 0.06,
    });
    return { distant, rock };
  }, [map, normalMap, roughnessMap]);

  useEffect(() => () => {
    materials.rock.dispose();
    materials.distant.dispose();
  }, [materials]);

  return materials;
}
