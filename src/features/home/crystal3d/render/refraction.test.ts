import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CrystalGeometryState } from '@/engine/geometry';
import { CRYSTAL_REFRACTION, applyCrystalRefraction, crystalBodyWidth } from './refraction';

/*
 * ВИМОГА (ADR-0178): заломлення вмикається й ВИМИКАЄТЬСЯ, і вимикається
 * повністю.
 *
 * Прапорець `?gfx=` існує заради бісекції на пристрої власника: він має
 * сенс лише тоді, коли стан «вимкнено» — це рівно той самий стан, що був
 * до нього. Половинчасте вимкнення (лишити `thickness` чи
 * `attenuationColor` на матеріалі) перетворило б перемикач на подорож в
 * один бік, і наступна відповідь власника описувала б кадр, якого ніхто
 * не просив.
 */

function meshWith(positions: number[]): CrystalGeometryState {
  return {
    meshes: [{
      bodyId: 'crystal:mother',
      positions: new Float32Array(positions),
    }],
  } as unknown as CrystalGeometryState;
}

describe('заломлення кристала', () => {
  it('міряє ширину монарха у власних одиницях меша', () => {
    // `three` рахує промінь як `thickness * modelScale`, тож число мусить
    // стояти в координатах геометрії, а не в одиницях сцени.
    const width = crystalBodyWidth(meshWith([
      -2, 0, -1, 2, 0, -1, 2, 5, 1, -2, 5, 1,
    ]));
    // Середнє з розмаху по X (4) і по Z (2).
    expect(width).toBeCloseTo(3, 6);
  });

  it('не падає на порожній геометрії', () => {
    expect(crystalBodyWidth(meshWith([]))).toBeGreaterThan(0);
    expect(crystalBodyWidth({ meshes: [] } as unknown as CrystalGeometryState)).toBeGreaterThan(0);
  });

  it('вмикає прозорість, товщину й поглинання власним кольором', () => {
    const material = new THREE.MeshPhysicalMaterial({ color: '#c0508a' });
    applyCrystalRefraction([material], { on: true, width: 2 });
    expect(material.transmission).toBe(CRYSTAL_REFRACTION.transmission);
    expect(material.thickness).toBeCloseTo(2 * CRYSTAL_REFRACTION.thicknessShare, 6);
    expect(material.attenuationDistance).toBeCloseTo(2 * CRYSTAL_REFRACTION.attenuationShare, 6);
    // Те, що густішає в товщі, — це заслужений колір пари (ADR-0004), а
    // не окремий відтінок, який довелося б узгоджувати ще десь.
    expect(material.attenuationColor.getHex()).toBe(material.color.getHex());
  });

  it('прозорість не зʼїдає власний колір тіла цілком', () => {
    // При 1.0 дифузна складова зникає, і разом із нею колір, який пара
    // заслужила: лишилось би безбарвне скло з рожевим поглинанням.
    expect(CRYSTAL_REFRACTION.transmission).toBeLessThan(1);
    expect(CRYSTAL_REFRACTION.transmission).toBeGreaterThan(0.5);
  });

  it('дисперсія вимкнена: вона коштує три вибірки буфера замість однієї', () => {
    expect(CRYSTAL_REFRACTION.dispersion).toBe(0);
  });

  it('знімається повністю, а не наполовину', () => {
    const material = new THREE.MeshPhysicalMaterial({ color: '#c0508a' });
    applyCrystalRefraction([material], { on: true, width: 2 });
    applyCrystalRefraction([material], { on: false, width: 2 });
    expect(material.transmission).toBe(0);
    expect(material.thickness).toBe(0);
    expect(material.attenuationDistance).toBe(Infinity);
    expect(material.attenuationColor.getHex()).toBe(0xffffff);
    expect(material.dispersion).toBe(0);
  });

  it('не чіпає матеріалів, які не є фізичними', () => {
    // Підкладка, іскри й оточення живуть у тій самій сцені; прозорість
    // каменю чи хмари не входила в прохання.
    const basic = new THREE.MeshBasicMaterial();
    expect(() => applyCrystalRefraction([basic], { on: true, width: 2 })).not.toThrow();
  });
});
