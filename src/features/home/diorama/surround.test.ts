import { describe, expect, it } from 'vitest';
import type { IslandMesh } from '../crystal3d/v2/crystalIsland';
import { SURROUND_BELOW, SURROUND_CLEAR, buildCrystalSurround, buildReefSurround, buildTreeSurround } from './surround';

// ============================================================
// Оточення на 360° (ADR-0224). Власник: «фонові структури лише з одного
// боку, треба щоб вони були на 360 градусів». Тести тримають саме це — і
// правило, без якого 360° зіпсували б кадр: між найдальшою камерою й
// островом не стоїть нічого.
// ============================================================

const SEED = '2022-12-26';
const cases: [string, IslandMesh][] = [
  ['кристал — храм у підземеллі', buildCrystalSurround(SEED)],
  ['дерево — небо з острівцями', buildTreeSurround(SEED)],
  ['риф — глибина зі скелями', buildReefSurround(SEED)],
];

describe.each(cases)('оточення: %s', (_, mesh) => {
  it('оточує острів з усіх боків: у кожному з 12 секторів по 30° є далеке тіло', () => {
    const sectors = new Set<number>();
    for (let v = 0; v < mesh.positions.length / 3; v += 1) {
      const x = mesh.positions[v * 3]!;
      const z = mesh.positions[v * 3 + 2]!;
      if (Math.hypot(x, z) < SURROUND_CLEAR) continue;
      sectors.add(Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 12);
    }
    expect(sectors.size).toBe(12);
  });

  it('нічого не стоїть між найдальшою камерою й островом: ближче за межу — лише внизу', () => {
    for (let v = 0; v < mesh.positions.length / 3; v += 1) {
      const x = mesh.positions[v * 3]!;
      const y = mesh.positions[v * 3 + 1]!;
      const z = mesh.positions[v * 3 + 2]!;
      if (Math.hypot(x, z) < SURROUND_CLEAR) expect(y).toBeLessThan(SURROUND_BELOW);
    }
  });

  it('числа скінченні, трикутники цілі, атрибути на кожну вершину', () => {
    expect(mesh.positions.length % 9).toBe(0);
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
    expect(mesh.paint.length * 3).toBe(mesh.positions.length);
  });

  it('не важче за 16 тисяч трикутників: оточення — тло, а не сцена', () => {
    expect(mesh.positions.length / 9).toBeLessThan(16000);
  });
});

it('детерміновано: та сама дата — побітово те саме оточення', () => {
  expect(Array.from(buildCrystalSurround(SEED).positions)).toEqual(Array.from(cases[0]![1].positions));
  expect(Array.from(buildReefSurround(SEED).positions)).toEqual(Array.from(cases[2]![1].positions));
});
