import { describe, expect, it } from 'vitest';
import { reefAnnualColonySize } from './colonyFormations';
import { reefColonyBodies, type ReefCoralBody } from './colonyBodies';

const HEAD_RADIUS = 1;

function colonyOf(fill: number, seed: number): ReturnType<typeof reefAnnualColonySize> {
  return reefAnnualColonySize(HEAD_RADIUS, fill, seed);
}

function distanceFromCentre(body: ReefCoralBody): number {
  return Math.hypot(body.offset.u, body.offset.v);
}

/** Скільки тіл торкається хоч одного сусіда — частка від усіх. */
function fusedShare(bodies: ReefCoralBody[]): number {
  const fused = new Set<number>();
  for (let a = 0; a < bodies.length; a += 1) {
    for (let b = a + 1; b < bodies.length; b += 1) {
      const gap = Math.hypot(
        bodies[a]!.offset.u - bodies[b]!.offset.u,
        bodies[a]!.offset.v - bodies[b]!.offset.v,
      );
      if (gap < bodies[a]!.radius + bodies[b]!.radius) { fused.add(a); fused.add(b); }
    }
  }
  return bodies.length === 0 ? 0 : fused.size / bodies.length;
}

describe('колонія лишається в оголошених межах', () => {
  it('жодне тіло не вилазить за радіус колонії', () => {
    /*
     * Оголошений радіус колонії — не опис, а зобов'язання: на нього
     * спирається зазор між роками на куполі. Якби тіла стояли по всьому
     * диску й ще й мали власну товщину, колонія була б ширшою за те, що
     * про неї сказано, і сусідні роки почали б налазити один на одного
     * там, де розкладка вважає, що місця вистачає.
     */
    for (const fill of [0, 0.3, 0.6, 1]) {
      for (const seed of [1, 77, 4242]) {
        const colony = colonyOf(fill, seed);
        for (const body of reefColonyBodies(colony, seed, 5)) {
          expect(distanceFromCentre(body) + body.radius, `fill ${fill}, насіння ${seed}`)
            .toBeLessThanOrEqual(colony.radius + 1e-6);
        }
      }
    }
  });

  it('тіл рівно стільки, скільки оголосив рік', () => {
    for (const fill of [0, 0.5, 1]) {
      const colony = colonyOf(fill, 9);
      expect(reefColonyBodies(colony, 9, 2)).toHaveLength(colony.bodies);
    }
  });
});

describe('наповненість року видно, а не оголошено', () => {
  it('бідний рік стоїть нарізно, повний зростається в шапку', () => {
    /*
     * ГОЛОВНЕ твердження цього файлу, і воно вимірюване.
     *
     * Перша редакція писала товщину як «база ± частка густини» з
     * розмахом ±31% — і при ньому зливались УСІ роки без винятку:
     * найближчі сусіди стояли на 0.50–0.60 діаметра при будь-якій
     * наповненості. Закон був оголошений у коментарі й не діяв у
     * жодному кадрі. Тепер кінці задані на справжніх кінцях густини, і
     * поріг «торкаються» лежить між ними: 1.34 діаметра в порожньому
     * році проти 0.59 у повному.
     */
    for (const seed of [1, 77, 4242]) {
      expect(fusedShare(reefColonyBodies(colonyOf(0, seed), seed, 1)), `порожній, насіння ${seed}`)
        .toBe(0);
      expect(fusedShare(reefColonyBodies(colonyOf(1, seed), seed, 1)), `повний, насіння ${seed}`)
        .toBe(1);
    }
  });

  it('повніший рік дає більше тіла, ніж бідніший', () => {
    // Порівняння НА ТОМУ САМОМУ насінні: інакше різницю дало б
    // тремтіння, а не рік.
    for (const seed of [3, 500]) {
      const volume = (fill: number): number => reefColonyBodies(colonyOf(fill, seed), seed, 4)
        .reduce((total, body) => total + body.radius * body.radius * body.height, 0);
      expect(volume(1)).toBeGreaterThan(volume(0.5));
      expect(volume(0.5)).toBeGreaterThan(volume(0));
    }
  });
});

describe('силует колонії — курган і віяло', () => {
  it('середина вища за край', () => {
    /*
     * Без цього двадцять тіл читаються щіткою однакових стовпчиків.
     * Виміряно на двохстах випадках: середина вища за край у
     * 1.32–1.96 раза; 1.15 стоїть нижче за весь діапазон і при цьому
     * далеко вище за одиницю, тобто ловить і «курган прибрано».
     */
    for (const fill of [0.3, 0.7, 1]) {
      for (const seed of [11, 222]) {
        const bodies = [...reefColonyBodies(colonyOf(fill, seed), seed, 6)]
          .sort((a, b) => distanceFromCentre(a) - distanceFromCentre(b));
        const half = Math.max(1, Math.floor(bodies.length / 2));
        const inner = bodies.slice(0, half).reduce((s, b) => s + b.height, 0) / half;
        const outer = bodies.slice(-half).reduce((s, b) => s + b.height, 0) / half;
        expect(inner / outer, `fill ${fill}, насіння ${seed}`).toBeGreaterThan(1.15);
      }
    }
  });

  it('крайні тіла нахилені назовні, центральне стоїть прямо', () => {
    const bodies = [...reefColonyBodies(colonyOf(1, 8), 8, 6)]
      .sort((a, b) => distanceFromCentre(a) - distanceFromCentre(b));
    // Напрям нахилу збігається з напрямом «від центру»: косинус між
    // ними виміряно в 0.997–1.000, тож 0.9 ловить будь-який розворот.
    for (const body of bodies) {
      const distance = distanceFromCentre(body);
      if (distance < 1e-9) continue;
      const cosine = (body.offset.u / distance) * Math.cos(body.tiltAzimuthRad)
        + (body.offset.v / distance) * Math.sin(body.tiltAzimuthRad);
      expect(cosine, 'тіло нахилене не назовні').toBeGreaterThan(0.9);
    }
    expect(bodies[bodies.length - 1]!.tiltRad - bodies[0]!.tiltRad, 'віяла немає')
      .toBeGreaterThan(0.08);
  });

  it('тіла не стоять одне в одному', () => {
    // Навіть у злитій шапці центри мусять різнитись: два тіла в одній
    // точці — це не корал, це подвійна оплата за той самий піксель.
    const bodies = reefColonyBodies(colonyOf(1, 15), 15, 7);
    for (let a = 0; a < bodies.length; a += 1) {
      for (let b = a + 1; b < bodies.length; b += 1) {
        const gap = Math.hypot(
          bodies[a]!.offset.u - bodies[b]!.offset.u,
          bodies[a]!.offset.v - bodies[b]!.offset.v,
        );
        expect(gap, `тіла ${a} і ${b}`).toBeGreaterThan(bodies[a]!.radius * 0.5);
      }
    }
  });
});

describe('колонія належить своєму рокові', () => {
  it('той самий рік і та сама пара — та сама колонія', () => {
    const colony = colonyOf(0.6, 42);
    expect(reefColonyBodies(colony, 42, 3)).toEqual(reefColonyBodies(colony, 42, 3));
  });

  it('різні роки однієї пари не близнюки', () => {
    const colony = colonyOf(0.6, 42);
    expect(reefColonyBodies(colony, 42, 3)).not.toEqual(reefColonyBodies(colony, 42, 4));
  });

  it('різні пари не близнюки', () => {
    const colony = colonyOf(0.6, 42);
    expect(reefColonyBodies(colony, 42, 3)).not.toEqual(reefColonyBodies(colony, 43, 3));
  });

  it('порожній рік усе одно колонія, а не порожнеча', () => {
    const bodies = reefColonyBodies(colonyOf(0, 1), 1, 0);
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    expect(bodies.every((body) => body.radius > 0 && body.height > 0)).toBe(true);
  });

  it('нуль тіл не ламає розкладку', () => {
    expect(reefColonyBodies({ radius: 0.2, bodies: 0, density: 0.5 }, 1, 0)).toEqual([]);
  });
});
