import { describe, expect, it } from 'vitest';
import { buildReefHeadMesh } from '@/engine/species/reef/headMesh';
import { reefHeadSize } from '@/engine/species/reef/colonyFormations';
import { buildReefFishMesh } from '@/engine/species/reef/fishMesh';
import { reefGeometryOf } from './reefGeometry';

/*
 * ВИМОГА (ADR-0195): тон — число в рушії й колір у рендерері, і перекладає
 * їх рівно це місце.
 *
 * **ЦЕЙ ФАЙЛ СТЕРІГ ПРОТИЛЕЖНЕ, І ЦЕ НЕ ПЕРЕВЕРТАННЯ РАДИ ЗРУЧНОСТІ.**
 *
 * Доти тон лежав на ГРАНІ, тож геометрія мусила розшиватись: кожна грань
 * володіла своїми вершинами, інакше колір розмазався б між сусідами. Тести
 * тут вимагали саме розшивання, посилаючись на кристал: візерунок, що
 * перетинає ребро, каже оку, що дві площини — одна поверхня.
 *
 * Аргумент був про КРИСТАЛ, у якого грані справжні й пласкі. У рифа граней
 * немає — там гладкі тіла, — і сталий колір на трикутнику давав не грань, а
 * латку паперу з твердим краєм. Власник назвав результат «аплікацією дитини
 * з гострими кутками».
 *
 * Виміряно лінійкою твердості краю (ADR-0195, крок 0): щойно затінення стало
 * справжнім, ці латки лишились ЄДИНИМ джерелом твердих сходинок на голій
 * породі — 5.38 → 6.15 на сто пікселів. Тому тон переїхав на вершину, а
 * розшивання пішло разом із ним.
 */
describe('меш рушія → геометрія Three', () => {
  const mesh = buildReefHeadMesh(reefHeadSize(6 * 365, 5), 12345);

  it('геометрія лишається індексованою: грані ділять вершини', () => {
    const geometry = reefGeometryOf(mesh);
    expect(geometry.getIndex()).not.toBeNull();
    expect(geometry.getAttribute('position').count).toBe(mesh.positions.length / 3);
    /*
     * Ціна розшивання, названа числом: доти буфер був утричі більший за
     * кількість трикутників. Тепер вершин стільки, скільки їх у тілі.
     */
    expect(geometry.getAttribute('position').count).toBeLessThan(mesh.indices.length);
  });

  it('тон іде на ВЕРШИНУ, по одному значенню на кожну', () => {
    const colors = reefGeometryOf(mesh).getAttribute('color');
    expect(colors.count).toBe(mesh.positions.length / 3);
    for (let vertex = 0; vertex < colors.count; vertex += 1) {
      // Сірий множник: колір тону не несе, його дає матеріал.
      const value = colors.getX(vertex);
      expect(colors.getY(vertex)).toBeCloseTo(value, 6);
      expect(colors.getZ(vertex)).toBeCloseTo(value, 6);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('тон справді доходить до буфера, а не губиться дорогою', () => {
    const colors = reefGeometryOf(mesh).getAttribute('color');
    const tones = new Set<number>();
    for (let vertex = 0; vertex < colors.count; vertex += 1) {
      tones.add(Math.round(colors.getX(vertex) * 1000));
    }
    expect(tones.size).toBeGreaterThan(20);
  });

  it('меш без тону не отримує буфера кольору взагалі', () => {
    /*
     * Риба тону не публікує, і це не недогляд: вона завбільшки з ніготь,
     * весь час рухається й ніколи не стоїть до ока рельєфом. Вона має
     * малюватись рівно кольором свого матеріалу, а не платити зайвим
     * буфером за канал, якого їй нема куди подіти.
     */
    const fish = buildReefFishMesh();
    const geometry = reefGeometryOf(fish);
    expect(fish.tint).toBeUndefined();
    expect(geometry.getIndex()).not.toBeNull();
    expect(geometry.getAttribute('color')).toBeUndefined();
    expect(geometry.getAttribute('position').count).toBe(fish.positions.length / 3);
  });
});
