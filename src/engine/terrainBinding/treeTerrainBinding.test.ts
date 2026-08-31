import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_TERRAIN_BINDING_CONFIG } from './config';
import { buildTreeTerrainBinding } from './treeTerrainBinding';

function build(lod: 'high' | 'medium' | 'low') {
  const preview = buildTreeLabPreview('medium');
  return buildTreeTerrainBinding({
    species: preview.species,
    contact: preview.groundContact,
    lod,
    config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
  });
}

describe('Tree Terrain Binding Lab', () => {
  it('is deterministic, fulfils the stable binding and preserves the contact plane', () => {
    const first = build('medium');
    const second = build('medium');

    expect(second).toEqual(first);
    expect(first.binding).toEqual({
      id: 'tree:terrain:binding',
      sourceBindingId: 'tree:terrain:future',
      surfaceId: 'tree:terrain:surface',
      heightfieldId: 'tree:terrain:heightfield',
      groundPlaneId: 'tree:ground:contact-plane',
    });
    expect(first.groundLevelY).toBe(buildTreeLabPreview('medium').groundContact.ground.levelY);
    expect(first.diagnostics.groundPlanePreserved).toBe(true);
    expect(first.diagnostics.rootCoveragePreserved).toBe(true);
    expect(first.plateauRadius).toBeGreaterThanOrEqual(first.diagnostics.rootCoverageRadius);
    expect(first.diagnostics.mergedIntoRootGeometry).toBe(true);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('keeps identity and footprint stable while reducing only mesh density by LOD', () => {
    const high = build('high');
    const medium = build('medium');
    const low = build('low');

    expect(high.binding).toEqual(medium.binding);
    expect(medium.binding).toEqual(low.binding);
    expect(high.groundLevelY).toBe(medium.groundLevelY);
    expect(medium.groundLevelY).toBe(low.groundLevelY);
    expect(high.surfaceRadius).toBe(medium.surfaceRadius);
    expect(medium.surfaceRadius).toBe(low.surfaceRadius);
    expect(high.plateauRadius).toBe(medium.plateauRadius);
    expect(medium.plateauRadius).toBe(low.plateauRadius);
    expect(high.diagnostics.vertexCount).toBeGreaterThan(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThan(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThan(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThan(low.diagnostics.triangleCount);
  });

  /*
   * КРАЙ ҐРУНТУ НЕ КОЛО, І ПРИ ЦЬОМУ КІЛЬЦЯ НЕ МІНЯЮТЬСЯ МІСЦЯМИ.
   *
   * Три речі в одному вимірі, бо вони одна одну обмежують:
   *
   *   1. Обрис МУСИТЬ гуляти — рівне коло навколо стовбура читалось на
   *      знімку гумовим килимком, а не землею.
   *   2. Він не сміє виходити ЗА `surfaceRadius`: на цю межу спираються
   *      трава, каміння й UV.
   *   3. Кільця мусять іти строго назовні. Перша спроба ліпила край на 0.5
   *      радіуса, зовнішнє кільце заходило ВСЕРЕДИНУ сусіднього, і на знімку
   *      з'явилась чорна складка з вивернутою нормаллю.
   */
  it('shapes the soil rim without folding one ring inside another', () => {
    for (const lod of ['high', 'medium', 'low'] as const) {
      const state = build(lod);
      const { radialSegments, ringCount } = state.diagnostics;
      const radiusAt = (ring: number, segment: number) => {
        const index = (1 + ring * radialSegments + segment) * 3;
        return Math.hypot(
          state.mesh.positions[index]! - state.center.x,
          state.mesh.positions[index + 2]! - state.center.z,
        );
      };

      const rim: number[] = [];
      for (let segment = 0; segment < radialSegments; segment += 1) {
        rim.push(radiusAt(ringCount - 1, segment));
        for (let ring = 1; ring < ringCount; ring += 1) {
          expect(radiusAt(ring, segment)).toBeGreaterThan(radiusAt(ring - 1, segment));
        }
      }

      expect(Math.max(...rim) / Math.min(...rim)).toBeGreaterThan(1.04);
      expect(Math.max(...rim)).toBeLessThanOrEqual(state.surfaceRadius + 1e-6);
    }
  });

  /*
   * ПЛАТО НАКРИВАЄ КОРІННЯ З УСІХ БОКІВ — і міряти це треба по сітці, а не
   * по числу.
   *
   * Рушій перевіряє `plateauRadius >= rootCoverageRadius` на ЧИСЛІ, якого
   * ліплення краю не чіпає. Якби втягування діяло на всі кільця однаково,
   * число лишилось би тим самим, а РІВНА земля під корінням стягнулась би на
   * восьму частину — і кінці коренів опинились би на схилі рельєфу, тоді як
   * перевірка й далі казала б «усе гаразд».
   *
   * Тому тут для КОЖНОГО напрямку береться найдальша ще рівна вершина. Перша
   * спроба міряла найдальшу рівну вершину взагалі — і мутацію проґавила, бо
   * брала найкращий кут, а ламається найгірший.
   */
  it('keeps flat ground out to the roots in every direction', () => {
    const state = build('high');
    const { radialSegments, ringCount } = state.diagnostics;
    const flatReach: number[] = [];

    for (let segment = 0; segment < radialSegments; segment += 1) {
      let reach = 0;
      for (let ring = 0; ring < ringCount; ring += 1) {
        const index = (1 + ring * radialSegments + segment) * 3;
        const isFlat = Math.abs(state.mesh.positions[index + 1]! - state.groundLevelY) <= 1e-6;
        if (!isFlat) continue;
        reach = Math.max(reach, Math.hypot(
          state.mesh.positions[index]! - state.center.x,
          state.mesh.positions[index + 2]! - state.center.z,
        ));
      }
      flatReach.push(reach);
    }

    expect(Math.min(...flatReach)).toBeGreaterThanOrEqual(state.diagnostics.rootCoverageRadius);
  });

  it('does not mutate Tree Species or Ground Contact', () => {
    const preview = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(preview.species);
    const contactBefore = JSON.stringify(preview.groundContact);

    buildTreeTerrainBinding({
      species: preview.species,
      contact: preview.groundContact,
      lod: 'medium',
      config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
    });

    expect(JSON.stringify(preview.species)).toBe(speciesBefore);
    expect(JSON.stringify(preview.groundContact)).toBe(contactBefore);
  });

  it('rejects publication when a dedicated terrain budget is exceeded', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeTerrainBinding({
      species: preview.species,
      contact: preview.groundContact,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
        maximumVerticesByLod: {
          ...DEFAULT_TREE_TERRAIN_BINDING_CONFIG.maximumVerticesByLod,
          medium: 0,
        },
      },
    })).toThrow(/exceeded the medium mobile mesh budget/);
  });
});
