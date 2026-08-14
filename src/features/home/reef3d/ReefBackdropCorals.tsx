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
  depth: number;
  drawCalls: 1;
  height: number;
  sourceMeshes: number;
  triangles: number;
  width: number;
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

    // The source is a straight catalogue row. Recompose its eight licensed
    // pieces into one asymmetric middle-distance arc before merging, keeping
    // the same triangle count and one final draw call.
    const worldPosition = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
    geometry.computeBoundingBox();
    const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? worldPosition;
    const edge = Math.min(1, Math.abs(worldPosition.x) / 3.5);
    const side = Math.sign(worldPosition.x);
    const pieceIndex = geometries.length;
    const pieceScale = 1.04 - edge * 0.08 + (pieceIndex % 3) * 0.025;
    const lift = 0.04 + (pieceIndex % 4) * 0.055 - edge * 0.03;
    const depth = -0.18 - edge * 0.58 - (pieceIndex % 2) * 0.12;

    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(pieceScale, 1 + (pieceIndex % 3) * 0.06, pieceScale);
    geometry.rotateY(-side * (0.08 + edge * 0.12));
    geometry.translate(
      center.x + worldPosition.x * 0.22,
      center.y + lift,
      center.z + depth,
    );
    geometries.push(geometry);
  });

  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((source) => source.dispose());
  if (!geometry) throw new Error('CC0 reef backdrop meshes could not be merged.');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();

  const material = sourceMaterials[0]
    ? sourceMaterials[0].clone()
    : new THREE.MeshStandardMaterial();
  material.name = 'reef-cc0-backdrop-shared-material';
  material.color.set('#91ad82');
  material.metalness = 0;
  material.roughness = 0.86;
  material.emissive.set('#1b5047');
  material.emissiveIntensity = 0.18;
  material.envMapIntensity = 0.32;

  return {
    geometry,
    material,
    metrics: {
      depth: Number(size.z.toFixed(3)),
      drawCalls: 1,
      height: Number(size.y.toFixed(3)),
      sourceMeshes: geometries.length,
      triangles: triangleCount(geometry),
      width: Number(size.x.toFixed(3)),
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
      position={[0, -0.34, -5.9]}
      rotation={[0, -0.025, 0]}
      scale={1.72}
      castShadow={false}
      receiveShadow={false}
      frustumCulled
    />
  );
}

useGLTF.preload(BACKDROP_MODEL_URL);
