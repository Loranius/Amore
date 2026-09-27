import { describe, expect, it } from 'vitest';
import { LINE_GAP_SHARE, LINE_SIDES, buildConstellationLines, legGaps } from './constellationLines';

// ============================================================
// Прямі лінії сузір'я (ADR-0214).
// ------------------------------------------------------------
// ВИМОГА ВЛАСНИКА: «зроби сузір'я схожим на реальні сузір'я з гострими
// геометричними з'єднаннями замість хвилястих».
// ============================================================

const CHAIN = [
  { x: 0, y: 0, z: 0, radius: 2.8 },
  { x: 10, y: 0, z: 0, radius: 1.15 },
  { x: 10, y: 12, z: 3, radius: 2 },
  { x: -4, y: 20, z: -2, radius: 1.55 },
];
const R = 0.12;

function vertices(mesh: ReturnType<typeof buildConstellationLines>) {
  const out: { p: [number, number, number]; u: number }[] = [];
  for (let v = 0; v < mesh.positions.length / 3; v += 1) {
    out.push({
      p: [mesh.positions[v * 3]!, mesh.positions[v * 3 + 1]!, mesh.positions[v * 3 + 2]!],
      u: mesh.uvs[v * 2]!,
    });
  }
  return out;
}

describe('прямі лінії сузір’я', () => {
  it('кожен проліт — ПРЯМА: усі вершини лежать на відстані радіуса від відрізка між зірками', () => {
    const mesh = buildConstellationLines(CHAIN, R);
    const all = vertices(mesh);
    const perLeg = LINE_SIDES * 2;
    for (let leg = 0; leg < CHAIN.length - 1; leg += 1) {
      const a = CHAIN[leg]!;
      const b = CHAIN[leg + 1]!;
      const d = [b.x - a.x, b.y - a.y, b.z - a.z];
      const len = Math.hypot(d[0]!, d[1]!, d[2]!);
      for (const { p } of all.slice(leg * perLeg, (leg + 1) * perLeg)) {
        const w = [p[0] - a.x, p[1] - a.y, p[2] - a.z];
        const along = (w[0]! * d[0]! + w[1]! * d[1]! + w[2]! * d[2]!) / len;
        const off = Math.sqrt(Math.max(0, w[0]! ** 2 + w[1]! ** 2 + w[2]! ** 2 - along * along));
        // Float32 у буфері вершин — п'ять знаків, а не шість.
        expect(off).toBeCloseTo(R, 5);
      }
    }
  });

  it('лінія зупиняється ДО зірки, як на зоряній карті', () => {
    const mesh = buildConstellationLines(CHAIN, R);
    const all = vertices(mesh);
    for (const star of CHAIN) {
      const closest = Math.min(...all.map(({ p }) => Math.hypot(p[0] - star.x, p[1] - star.y, p[2] - star.z)));
      expect(closest).toBeGreaterThan(star.radius * LINE_GAP_SHARE - R - 1e-6);
    }
  });

  it('uv.x — та сама угода, що була в сплайна: зірка i на i/(n−1), усередині прольоту зростає', () => {
    const mesh = buildConstellationLines(CHAIN, R);
    const all = vertices(mesh);
    const perLeg = LINE_SIDES * 2;
    const legs = CHAIN.length - 1;
    for (let leg = 0; leg < legs; leg += 1) {
      const own = all.slice(leg * perLeg, (leg + 1) * perLeg);
      const start = own[0]!.u;
      const end = own[LINE_SIDES]!.u;
      expect(start).toBeGreaterThan(leg / legs);
      expect(end).toBeLessThan((leg + 1) / legs);
      expect(end).toBeGreaterThan(start);
    }
  });

  it('проміжки ніколи не з’їдають проліт: між близькими зірками лінія лишається', () => {
    const gaps = legGaps({ x: 0, y: 0, z: 0, radius: 5 }, { x: 4, y: 0, z: 0, radius: 5 });
    expect(gaps.start + gaps.end).toBeLessThan(gaps.length * 0.75);
  });

  it('одна зірка — жодної лінії; індекси не виходять за вершини', () => {
    expect(buildConstellationLines([CHAIN[0]!], R).indices.length).toBe(0);
    const mesh = buildConstellationLines(CHAIN, R);
    const count = mesh.positions.length / 3;
    for (const index of mesh.indices) expect(index).toBeLessThan(count);
  });
});
