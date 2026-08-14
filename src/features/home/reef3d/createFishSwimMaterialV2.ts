import * as THREE from 'three';

export type FishSwimUniform = { value: number };

/**
 * Low-cost lit material for the roaming fish.
 *
 * The reef is intentionally dark and foggy, so a pure physically-lit material
 * can collapse small fish into black silhouettes on mobile. Lambert keeps the
 * low-poly shading while the restrained emissive floor preserves their colour
 * when they pass through the darker parts of the scene.
 */
export function createFishSwimMaterialV2(swimTime: FishSwimUniform): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    color: '#f4fffc',
    emissive: '#285b59',
    emissiveIntensity: 0.42,
    flatShading: true,
    side: THREE.DoubleSide,
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

  material.customProgramCacheKey = () => 'reef-fish-swim-v3-visible-lambert';
  return material;
}
