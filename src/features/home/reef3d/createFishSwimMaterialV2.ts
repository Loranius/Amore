import * as THREE from 'three';

export type FishSwimUniform = { value: number };

/**
 * Stable unlit material for the module-driven fish.
 *
 * The tint is an explicit geometry attribute instead of InstancedMesh.instanceColor.
 * That attribute exists before the first WebGL program is compiled, avoiding the
 * stale no-instance-colour shader variant that rendered black silhouettes on the
 * Android production scene. The shader remains unlit and fog-free so the palette
 * stays readable in the darkest water while preserving the tail deformation.
 */
export function createFishSwimMaterialV2(swimTime: FishSwimUniform): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name: 'reef-fish-explicit-instance-colour-v5',
    uniforms: {
      uFishTime: swimTime,
    },
    vertexShader: /* glsl */ `
      uniform float uFishTime;
      attribute vec3 instanceSwimParams;
      attribute vec3 instanceFishColor;

      varying vec3 vFishColor;
      varying float vFishShade;

      void main() {
        vec3 transformed = position;
        float tailWeight = smoothstep(-0.08, 0.5, position.z);
        tailWeight *= tailWeight;
        float swimWave = sin(
          uFishTime * instanceSwimParams.y
          + instanceSwimParams.x
          + position.z * 8.5
        );
        transformed.x += swimWave * instanceSwimParams.z * tailWeight;

        vFishColor = instanceFishColor;
        vFishShade = mix(0.82, 1.12, smoothstep(-0.75, 0.85, normal.y));

        vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vFishColor;
      varying float vFishShade;

      void main() {
        vec3 readableColor = clamp(vFishColor * vFishShade, 0.0, 1.0);
        gl_FragColor = vec4(readableColor, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  material.customProgramCacheKey = () => 'reef-fish-swim-v5-explicit-instance-colour';
  return material;
}
