import { describe, expect, it } from 'vitest';
import { reefAnnualColonySize, reefColonyAnchor, reefHeadSize } from './colonyFormations';
import { reefColonyBodies } from './colonyBodies';
import { buildReefColonyMesh } from './bodyMesh';
import type { ReefMeshData } from './headMesh';

const VERTICES_PER_BODY = 42;
const TRIANGLES_PER_BODY = 80;

function colonyMesh(years: number, year: number, fill: number, seed: number): {
  mesh: ReefMeshData;
  bodies: ReturnType<typeof reefColonyBodies>;
  head: ReturnType<typeof reefHeadSize>;
  colony: ReturnType<typeof reefAnnualColonySize>;
} {
  const head = reefHeadSize(years * 365, 6);
  const colony = reefAnnualColonySize(head.radius, fill, seed);
  const bodies = reefColonyBodies(colony, seed, year);
  const anchor = reefColonyAnchor(head, year);
  return { mesh: buildReefColonyMesh(head, anchor, bodies, seed), bodies, head, colony };
}

/** Значення рівняння еліпсоїда: <1 усередині купола, >1 назовні. */
function domeValue(head: { radius: number; rise: number }, x: number, y: number, z: number): number {
  return (x * x + z * z) / (head.radius * head.radius) + (y * y) / (head.rise * head.rise);
}

describe('колонія — набір замкнених тіл', () => {
  const { mesh, bodies } = colonyMesh(12, 4, 0.8, 31);

  it('кожне ребро належить рівно двом трикутникам', () => {
    const edges = new Map<string, number>();
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const triangle = [mesh.indices[at]!, mesh.indices[at + 1]!, mesh.indices[at + 2]!];
      for (let corner = 0; corner < 3; corner += 1) {
        const a = triangle[corner]!;
        const b = triangle[(corner + 1) % 3]!;
        edges.set(a < b ? `${a}:${b}` : `${b}:${a}`, (edges.get(a < b ? `${a}:${b}` : `${b}:${a}`) ?? 0) + 1);
      }
    }
    expect([...edges.values()].filter((count) => count !== 2), 'тіло не замкнене').toHaveLength(0);
  });

  it('жоден трикутник не вироджений', () => {
    let smallest = Infinity;
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const corner = (k: number): [number, number, number] => {
        const v = mesh.indices[at + k]! * 3;
        return [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!];
      };
      const a = corner(0); const b = corner(1); const c = corner(2);
      const u: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      smallest = Math.min(smallest, Math.hypot(
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ) / 2);
    }
    const body = bodies[0]!;
    expect(smallest / (body.radius * body.radius), 'є трикутники без площі').toBeGreaterThan(1e-3);
  });

  it('усі числа скінченні, нормалі одиничні', () => {
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    for (let at = 0; at < mesh.normals.length; at += 3) {
      const length = Math.hypot(mesh.normals[at]!, mesh.normals[at + 1]!, mesh.normals[at + 2]!);
      expect(length).toBeCloseTo(1, 4);
    }
  });

  it('ціна колонії відома наперед', () => {
    // Бюджет — величина, яку треба бачити, а не дізнаватись на телефоні:
    // 80 трикутників на тіло, тож повна історія на 25 років коштує
    // близько 26 тисяч. Тест ловить будь-яку тиху зміну цієї ціни.
    expect(mesh.positions.length / 3).toBe(bodies.length * VERTICES_PER_BODY);
    expect(mesh.indices.length / 3).toBe(bodies.length * TRIANGLES_PER_BODY);
  });
});

describe('основа схована в куполі, маківка — назовні', () => {
  it('жодна базова вершина не виходить назовні', () => {
    /*
     * ВИМОГА ПРОФІЛЮ ЦІЛІСНОСТІ, і вона тут не декларація.
     *
     * Перша редакція топила кільце вздовж осі тіла на 0.85 його
     * радіуса — і на поясі 0.22, де купол найкрутіший, найгірша
     * вершина виходила НАЗОВНІ: 1.0083. Тепер кільце сідає на купол і
     * тоне вздовж місцевої нормалі, і по всьому діапазону (1–25 років,
     * чотири наповненості, обидва насіння) найгірше значення 0.9333.
     */
    /*
     * КОЖЕН рік, а не один із них. Перша редакція брала рік 5 і два
     * насіння — і мутація «топити вздовж осі, як було спершу» пройшла
     * всі десять тестів, хоч саме її цей тест і описує: вада сидить на
     * поясі 0.22, тобто на роках, у які перевірка не заглядала.
     * Розкладка кладе роки на різні пояси купола, тож пропустити рік
     * тут — те саме, що не перевірити нічого.
     */
    for (const years of [1, 3, 12, 25]) {
      for (const fill of [0, 0.35, 1]) {
        for (const seed of [1, 7, 99]) {
          for (let year = 0; year < years; year += 1) {
          const { mesh, bodies, head } = colonyMesh(years, year, fill, seed);
          for (let body = 0; body < bodies.length; body += 1) {
            for (let segment = 0; segment < 8; segment += 1) {
              const at = (body * VERTICES_PER_BODY + segment) * 3;
              expect(
                domeValue(head, mesh.positions[at]!, mesh.positions[at + 1]!, mesh.positions[at + 2]!),
                `${years}р, рік ${year}, наповненість ${fill}, насіння ${seed}, тіло ${body}`,
              ).toBeLessThan(0.99);
            }
          }
          }
        }
      }
    }
  });

  it('тіло сидить на куполі, а не висить над ним', () => {
    /*
     * Зсув розкладки заданий у ДОТИЧНІЙ площині, а купол під колонією
     * вигнутий. Якщо тіло не садити на поверхню, воно лишається на тій
     * площині — і що далі від центру шапки, то вище висить. Виміряно на
     * всьому діапазоні: із посадкою найгірша вершина основи стоїть на
     * 0.73 радіуса тіла над куполом (тобто корал далі торкається його),
     * без посадки — на 1.86, і шапка вже явно ширяє.
     */
    for (const years of [3, 12, 25]) {
      for (let year = 0; year < years; year += 1) {
        const { mesh, bodies, head } = colonyMesh(years, year, 1, 7);
        for (let body = 0; body < bodies.length; body += 1) {
          for (let segment = 8; segment < 16; segment += 1) {
            const at = (body * VERTICES_PER_BODY + segment) * 3;
            const x = mesh.positions[at]!;
            const y = mesh.positions[at + 1]!;
            const z = mesh.positions[at + 2]!;
            const length = Math.hypot(x, y, z);
            const surface = length / Math.sqrt(domeValue(head, x, y, z));
            expect((length - surface) / bodies[body]!.radius, `${years}р, рік ${year}, тіло ${body}`)
              .toBeLessThan(1.1);
          }
        }
      }
    }
  });

  it('тіло не гладкий кілочок', () => {
    /*
     * Поздовжні ребра — те, що відрізняє корал від виточеного кілочка:
     * на гладкому боці світло однакове по всьому обводу. Виміряно: з
     * ребрами найменший розкид радіуса по кільцю 0.21, без них рівно
     * нуль.
     */
    const { mesh, bodies } = colonyMesh(12, 4, 0.8, 31);
    for (let body = 0; body < bodies.length; body += 1) {
      const points: Array<[number, number, number]> = [];
      for (let segment = 16; segment < 24; segment += 1) {
        const at = (body * VERTICES_PER_BODY + segment) * 3;
        points.push([mesh.positions[at]!, mesh.positions[at + 1]!, mesh.positions[at + 2]!]);
      }
      const centre = points.reduce(
        (sum, p) => [sum[0] + p[0] / 8, sum[1] + p[1] / 8, sum[2] + p[2] / 8] as [number, number, number],
        [0, 0, 0] as [number, number, number],
      );
      const radii = points.map((p) => Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]));
      expect((Math.max(...radii) - Math.min(...radii)) / Math.max(...radii), `тіло ${body}`)
        .toBeGreaterThan(0.10);
    }
  });

  it('маківка кожного тіла — назовні купола', () => {
    // Зворотний бік тієї самої вимоги: корал росте З голови, а не в неї.
    for (const years of [1, 12, 25]) {
      const { mesh, bodies, head } = colonyMesh(years, Math.min(years - 1, 3), 0.6, 5);
      for (let body = 0; body < bodies.length; body += 1) {
        const at = (body * VERTICES_PER_BODY + 40) * 3;
        expect(
          domeValue(head, mesh.positions[at]!, mesh.positions[at + 1]!, mesh.positions[at + 2]!),
          `${years}р, тіло ${body}`,
        ).toBeGreaterThan(1.02);
      }
    }
  });

  it('колонія лишається біля своєї прив’язки', () => {
    const { mesh, bodies, head, colony } = colonyMesh(12, 6, 1, 21);
    const anchor = reefColonyAnchor(head, 6);
    const tallest = Math.max(...bodies.map((body) => body.height));
    const reach = colony.radius + tallest * 2;
    for (let at = 0; at < mesh.positions.length; at += 3) {
      const distance = Math.hypot(
        mesh.positions[at]! - anchor.point.x,
        mesh.positions[at + 1]! - anchor.point.y,
        mesh.positions[at + 2]! - anchor.point.z,
      );
      expect(distance, 'вершина втекла від колонії').toBeLessThan(reach);
    }
  });
});

describe('колонія належить своєму рокові', () => {
  it('той самий рік і та сама пара — той самий меш', () => {
    expect(colonyMesh(12, 4, 0.8, 31).mesh).toEqual(colonyMesh(12, 4, 0.8, 31).mesh);
  });

  it('різні пари — різні колонії', () => {
    expect(colonyMesh(12, 4, 0.8, 31).mesh.positions)
      .not.toEqual(colonyMesh(12, 4, 0.8, 32).mesh.positions);
  });

  it('колонія без тіл не ламає меш', () => {
    const head = reefHeadSize(3 * 365, 4);
    const mesh = buildReefColonyMesh(head, reefColonyAnchor(head, 0), [], 1);
    expect(mesh.positions).toHaveLength(0);
    expect(mesh.indices).toHaveLength(0);
    expect(mesh.bounds.min).toEqual({ x: 0, y: 0, z: 0 });
  });
});
