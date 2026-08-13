import * as THREE from 'three';

export type FishSwimUniform = { value: number };

export function createFishSwimMaterial(swimTime: FishSwimUniform): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: '#ffffff',
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFishTime = swimTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFishTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tailWeight = smoothstep(-0.08, 0.5, position.z);
        tailWeight *= tailWeight;
        float swimWave = sin(uFishTime * 3.25 + position.z * 8.5);
        transformed.x += swimWave * 0.085 * tailWeight;`,
      );
  };

  material.customProgramCacheKey = () => 'reef-fish-swim-v1';
  return material;
}
