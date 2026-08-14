import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {
  REEF_BACKDROP_MODEL_PATH,
  REEF_BACKDROP_PRESENTATION,
} from './reefAssetManifest';

const BACKDROP_MODEL_URL = `${import.meta.env.BASE_URL}${REEF_BACKDROP_MODEL_PATH}`;

export interface ReefBackdropMetrics {
  drawCalls: 1;
  sourceMeshes: number;
  triangles: number;
}

interface MergedBackdrop {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  metrics: ReefBackdropMetrics;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const indexCount = geometry.index?.count;
  if (indexCount !== undefined) return Math.floor(indexCount / 3);
  return Math.floor((geometry.getAttribute('position')?.count ?? 0) / 3);
}

/**
 * Converts the source set into one distant, fog-softened draw call.
 *
 * The CC0 model is environmental context only. The central coral and every
 * colony that communicates portal history still come from Reef Species.
 */
function mergeBackdrop(scene: THREE.Group): MergedBackdrop {
  scene.updateWorldMatrix(true, true);
  const geometries: THREE.BufferGeometry[] = [];
  const sourceMaterials: THREE.MeshStandardMaterial[] = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) {
      return;
    }
    if (object.material instanceof THREE.MeshStandardMaterial) {
      sourceMaterials.push(object.material);
    }

    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);

    // Pull the outer pieces a little farther into the fog, replacing the
    // source asset's straight catalogue row with a shallow background arc.
    const worldPosition = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
    geometry.translate(0, 0, -Math.abs(worldPosition.x) * 0.13);
    geometries.push(geometry);
  });

  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((source) => source.dispose());
  if (!geometry) throw new Error('CC0 reef backdrop meshes could not be merged.');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = sourceMaterials[0]
    ? sourceMaterials[0].clone()
    : new THREE.MeshStandardMaterial();
  material.name = 'reef-cc0-backdrop-shared-material';
  material.color.set('#6f9b84');
  material.metalness = 0;
  material.roughness = 0.94;
  material.emissive.set('#153d3a');
  material.emissiveIntensity = 0.12;
  material.envMapIntensity = 0.25;

  return {
    geometry,
    material,
    metrics: {
      drawCalls: 1,
      sourceMeshes: geometries.length,
      triangles: triangleCount(geometry),
    },
  };
}

export function ReefBackdropCorals({
  onReady,
}: {
  onReady?: ((metrics: ReefBackdropMetrics) => void) | undefined;
}) {
  const { scene } = useGLTF(BACKDROP_MODEL_URL);
  const backdrop = useMemo(() => mergeBackdrop(scene), [scene]);

  useEffect(() => {
    onReady?.(backdrop.metrics);
  }, [backdrop.metrics, onReady]);

  useEffect(() => () => {
    backdrop.geometry.dispose();
    backdrop.material.dispose();
  }, [backdrop]);

  return (
    <mesh
      name={`reef-backdrop-${REEF_BACKDROP_PRESENTATION}`}
      geometry={backdrop.geometry}
      material={backdrop.material}
      position={[0, -0.34, -8.7]}
      rotation={[0, -0.04, 0]}
      scale={1.45}
      castShadow={false}
      receiveShadow={false}
      frustumCulled
    />
  );
}

useGLTF.preload(BACKDROP_MODEL_URL);
