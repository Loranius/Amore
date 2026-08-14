import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFishSwimMaterialV2 } from './createFishSwimMaterialV2';
import { buildReefFish } from './reefFishMotion';
import {
  createReefFishRenderGeometry,
  REEF_FISH_COLOR_ATTRIBUTE,
} from './reefFishRenderKit';

describe('reef fish colour rendering', () => {
  it('binds a bright explicit tint before the first WebGL frame', () => {
    const fish = buildReefFish(6, 26122022);
    const geometry = createReefFishRenderGeometry(fish);
    const tint = geometry.getAttribute(REEF_FISH_COLOR_ATTRIBUTE);

    expect(tint).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(tint.count).toBe(fish.length);

    const luminances = Array.from({ length: tint.count }, (_, index) => {
      const red = tint.getX(index);
      const green = tint.getY(index);
      const blue = tint.getZ(index);
      return red * 0.2126 + green * 0.7152 + blue * 0.0722;
    });

    expect(Math.min(...luminances)).toBeGreaterThan(0.35);
    expect(new Set(luminances.map((value) => value.toFixed(3))).size).toBeGreaterThan(3);
    geometry.dispose();
  });

  it('uses the explicit tint in a fog-free, unlit mobile shader', () => {
    const swimTime = { value: 0 };
    const material = createFishSwimMaterialV2(swimTime);

    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(material.uniforms.uFishTime?.value).toBe(0);
    expect(material.vertexShader).toContain('attribute vec3 instanceFishColor');
    expect(material.vertexShader).toContain('vFishColor = instanceFishColor');
    expect(material.fragmentShader).toContain('vFishColor * vFishShade');
    expect(material.fragmentShader).toContain('#include <colorspace_fragment>');
    expect(material.fog).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    material.dispose();
  });
});
