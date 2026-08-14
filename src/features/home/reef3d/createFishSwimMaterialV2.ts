import * as THREE from 'three';

export type FishSwimUniform = { value: number };

/**
 * Stable unlit material for the roaming fish.
 *
 * The reef uses strong depth fog and directional lighting. On mobile the tiny
 * low-poly fish were receiving almost no diffuse light, so even bright instance
 * colours collapsed into dark teal/black silhouettes. Fish colour is gameplay
 * readability, not a physically-lit surface, so keep the per-instance palette
 * independent from scene lighting and fog while preserving the swim deformation.
 */
export function createFishSwimMaterialV2(swimTime: FishSwimUniform): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    color: '#ffffff',
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFishTime = swimTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uFishTime;\nattribute vec3 instanceSwimParams;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tailWeight = smoothstep(-0.08, 0.5, position.z);
        tailWeight *= tailWeight;
        float swimWave = sin(
          uFishTime * instanceSwimParams.y
          + instanceSwimParams.x
          + position.z * 8.5
        );
        transformed.x += swimWave * instanceSwimParams.z * tailWeight;`,
      );
  };

  material.customProgramCacheKey = () => 'reef-fish-swim-v4-unlit-instance-colors';
  return material;
}
