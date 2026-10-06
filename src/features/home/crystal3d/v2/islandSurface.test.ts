import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createIslandMaterial } from './CrystalIsland';
import { castsShadows } from './CrystalHomeWorld';

// ============================================================
// Камінь, тіні й світло святилища (ADR-0243).
// Матеріал острова спільний для трьох видів: усе нове — лише на прохання,
// а без нього шейдер дерева й рифу мусить лишитись тим самим.
// ============================================================

const PAINTS = ['#ffffff', '#000000', '#888888'];

describe('поверхня острова', () => {
  it('без поверхні — той самий матеріал, що й до ADR-0243: без світла, без зерна, без тіней', () => {
    const plain = createIslandMaterial(PAINTS);
    expect(plain.lights).toBe(false);
    expect(Object.keys(plain.defines)).toEqual([]);
  });

  it('тіні беруть маску three: матеріал зі світлом і картами тіней у юніформах', () => {
    const shaded = createIslandMaterial(PAINTS, undefined, { shadows: true });
    expect(shaded.lights).toBe(true);
    expect(shaded.defines).toHaveProperty('USE_DIORAMA_SHADOWS');
    expect(shaded.uniforms).toHaveProperty('directionalShadowMap');
    expect(shaded.fragmentShader).toContain('getShadowMask()');
  });

  it('зерно вмикається лише з картою: без текстури шейдер її не семплює', () => {
    expect(createIslandMaterial(PAINTS, undefined, { grain: null }).defines).not.toHaveProperty('USE_STONE_GRAIN');
    const grained = createIslandMaterial(PAINTS, undefined, { grain: new THREE.Texture() });
    expect(grained.defines).toHaveProperty('USE_STONE_GRAIN');
  });

  it('світло кристала на храмі — окремо від тіней і зерна', () => {
    const lit = createIslandMaterial(PAINTS, undefined, { crystalLight: { colour: new THREE.Color(1, 0, 1), strength: 0.5 } });
    expect(Object.keys(lit.defines)).toEqual(['USE_CRYSTAL_LIGHT']);
    expect(lit.lights).toBe(false);
  });

  it('тіні — лише на сильних профілях пристрою', () => {
    expect(castsShadows('high')).toBe(true);
    expect(castsShadows('balanced')).toBe(true);
    expect(castsShadows('low')).toBe(false);
    expect(castsShadows('fallback')).toBe(false);
  });

  it('мох і зелень на руїнах — лише святилищу кристала: вулканічний острів не зеленіє (ADR-0246)', () => {
    const grain = new THREE.Texture();
    expect(createIslandMaterial(PAINTS, undefined, { grain, mossyRuins: true }).defines).toHaveProperty('USE_MOSSY_RUINS');
    expect(createIslandMaterial(PAINTS, undefined, { grain }).defines).not.toHaveProperty('USE_MOSSY_RUINS');
  });

  it('зерно лягає лише на фарби каменю: вулкан задає свої, корали й плющ лишаються чистими', () => {
    const grain = new THREE.Texture();
    const volcanic = createIslandMaterial(PAINTS, undefined, { grain, stonePaints: [0, 1, 2] });
    expect(volcanic.fragmentShader).toContain('bool stone = i == 0 || i == 1 || i == 2;');
    expect(createIslandMaterial(PAINTS, undefined, { grain, stonePaints: [] }).fragmentShader).toContain('bool stone = false;');
    expect(createIslandMaterial(PAINTS, undefined, { grain }).fragmentShader).toContain('bool stone = i != 3');
  });
});
