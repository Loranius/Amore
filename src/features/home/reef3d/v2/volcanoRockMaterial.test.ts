import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { REEF_PALETTES, createVolcanoRockMaterial } from './reefV2Materials';

// ============================================================
// Базальт вулкана (ADR-0246): зерно й світло рік — лише на прохання.
// Без опцій шейдер той самий, що й до ADR-0246.
// ============================================================

const make = (options?: Parameters<typeof createVolcanoRockMaterial>[3]) =>
  createVolcanoRockMaterial(REEF_PALETTES.dark, '#2a2238', -1, options);

describe('матеріал базальту вулкана', () => {
  it('без опцій — без зерна, без світла рік і без атрибута `lava`', () => {
    const plain = make();
    expect(Object.keys(plain.defines)).toEqual([]);
    expect(plain.lights).toBe(false);
  });

  it('зерно вмикається лише з картою', () => {
    expect(make({ grain: null }).defines).not.toHaveProperty('USE_BASALT_GRAIN');
    const grained = make({ grain: new THREE.Texture() });
    expect(grained.defines).toHaveProperty('USE_BASALT_GRAIN');
    expect(grained.uniforms.uGrain!.value).toBeInstanceOf(THREE.Texture);
  });

  it('світло рік читає атрибут `lava` і той самий фронт, що й ріка', () => {
    const lit = make({ lavaLight: true });
    expect(Object.keys(lit.defines)).toEqual(['USE_LAVA_LIGHT']);
    expect(lit.vertexShader).toContain('attribute vec2 lava;');
    expect(lit.uniforms.uFront!.value).toBe(0);
    expect(lit.uniforms.uRest!.value).toBe(0);
  });
});
