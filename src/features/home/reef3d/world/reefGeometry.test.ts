import { describe, expect, it } from 'vitest';
import { buildReefHeadMesh } from '@/engine/species/reef/headMesh';
import { reefHeadSize } from '@/engine/species/reef/colonyFormations';
import { buildReefFishMesh } from '@/engine/species/reef/fishMesh';
import { reefGeometryOf } from './reefGeometry';

/*
 * ВИМОГА (ADR-0190): тон грані — число в рушії й колір у рендерері, і
 * перекладає їх рівно це місце.
 *
 * Перевірки тут про ОДНУ річ, яку легко втратити не помітивши:
 * розшивання граней. Тон лежить на грані, а колір у Three — на вершині;
 * при спільних вершинах він розмазався б між сусідами плавним
 * градієнтом, тобто візерунок ПЕРЕТИНАВ БИ РЕБРО. Кристал уже платив за
 * цей урок: візерунок, що перетинає ребро, каже оку, що дві площини —
 * одна поверхня, і саме це й робить тіло пласким.
 */
describe('меш рушія → геометрія Three', () => {
  const mesh = buildReefHeadMesh(reefHeadSize(6 * 365, 5), 12345);

  it('меш із тоном розшивається: кожна грань володіє своїми вершинами', () => {
    const geometry = reefGeometryOf(mesh);
    const faces = mesh.indices.length / 3;
    expect(geometry.getAttribute('position').count).toBe(faces * 3);
    expect(geometry.getIndex()).toBeNull();
  });

  it('усі три вершини грані несуть ОДИН тон — інакше це градієнт, а не грань', () => {
    const colors = reefGeometryOf(mesh).getAttribute('color');
    for (let face = 0; face < 24; face += 1) {
      const first = colors.getX(face * 3);
      expect(colors.getX(face * 3 + 1)).toBeCloseTo(first, 6);
      expect(colors.getX(face * 3 + 2)).toBeCloseTo(first, 6);
      // Сірий множник: колір тону не несе, його дає матеріал.
      expect(colors.getY(face * 3)).toBeCloseTo(first, 6);
      expect(colors.getZ(face * 3)).toBeCloseTo(first, 6);
    }
  });

  it('тон справді доходить до буфера, а не губиться дорогою', () => {
    const colors = reefGeometryOf(mesh).getAttribute('color');
    const tones = new Set<number>();
    for (let face = 0; face < mesh.indices.length / 3; face += 1) {
      tones.add(Math.round(colors.getX(face * 3) * 1000));
    }
    expect(tones.size).toBeGreaterThan(20);
  });

  it('меш без тону лишається таким, яким був — зі спільними вершинами', () => {
    /*
     * Риба тону не публікує, і це не недогляд: вона завбільшки з ніготь,
     * весь час рухається й ніколи не стоїть до ока рельєфом. Вона має
     * малюватись рівно кольором свого матеріалу, а не платити втричі
     * більшим буфером за канал, якого їй нема куди подіти.
     *
     * (Тут стояла трава — доти, доки ADR-0191 не дав тон і їй.)
     */
    const fish = buildReefFishMesh();
    const geometry = reefGeometryOf(fish);
    expect(fish.faceShade).toBeUndefined();
    expect(geometry.getIndex()).not.toBeNull();
    expect(geometry.getAttribute('color')).toBeUndefined();
    expect(geometry.getAttribute('position').count).toBe(fish.positions.length / 3);
  });
});
