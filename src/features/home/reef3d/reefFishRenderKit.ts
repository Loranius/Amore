import * as THREE from 'three';
import { createKenneyFishGeometry } from './kenneyFishGeometry';
import { REEF_FISH_TINTS } from './reefFishRoaming';

export const REEF_FISH_COLOR_ATTRIBUTE = 'instanceFishColor';

interface ReefRenderableFish {
  speed: number;
  phase: number;
  scale: number;
}

export function createReefFishRenderGeometry(fish: readonly ReefRenderableFish[]) {
  const geometry = createKenneyFishGeometry();
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  const params = new Float32Array(fish.length * 3);
  const colors = new Float32Array(fish.length * 3);
  const color = new THREE.Color();

  fish.forEach((item, index) => {
    const speedT = THREE.MathUtils.clamp((item.speed - 0.12) / 0.11, 0, 1);
    const scaleT = THREE.MathUtils.clamp((item.scale - 0.34) / 0.2, 0, 1);
    params[index * 3] = item.phase * 1.67 + index * 0.83;
    params[index * 3 + 1] = THREE.MathUtils.lerp(2.2, 3.8, speedT);
    params[index * 3 + 2] = THREE.MathUtils.lerp(0.05, 0.09, scaleT);

    color.set(REEF_FISH_TINTS[index % REEF_FISH_TINTS.length]!);
    color.multiplyScalar(1.08 + scaleT * 0.12);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });

  geometry.setAttribute('instanceSwimParams', new THREE.InstancedBufferAttribute(params, 3));
  geometry.setAttribute(
    REEF_FISH_COLOR_ATTRIBUTE,
    new THREE.InstancedBufferAttribute(colors, 3),
  );
  return geometry;
}
