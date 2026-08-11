import { describe, expect, it } from 'vitest';
import {
  stepWishSpheres,
  wishSpheresAtRest,
  type WishSphereBody,
  type WishSphereWorld,
} from './wishSphereMotion';

// ============================================================
// Фізика куль бажань.
// ------------------------------------------------------------
// Жодну з цих властивостей не видно на знімку: чи все зупиняється, чи ніхто не
// проліз крізь сусіда, чи куля, кинута в монарха, від нього відскочила. Саме
// тому вони тут, а не «перевірені оком».
// ============================================================

const WORLD: WishSphereWorld = {
  width: 412,
  height: 620,
  obstacle: { centreX: 260, tipY: 240, tipWidth: 60, baseWidth: 140 },
};

function body(patch: Partial<WishSphereBody> & { id: number }): WishSphereBody {
  return { x: 100, y: 100, vx: 0, vy: 0, radius: 30, ...patch };
}

/** Проганяє світ уперед рівними кроками по 16 мс. */
function settle(
  bodies: readonly WishSphereBody[],
  world: WishSphereWorld,
  seconds: number,
): WishSphereBody[] {
  let state = [...bodies];
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    state = stepWishSpheres(state, world, 1 / 60);
  }
  return state;
}

describe('inertia', () => {
  it('carries a pushed sphere and then stops it', () => {
    // Обидві половини — вимога: без інерції це кнопка, що телепортується, без
    // тертя куля ніколи не зупиняється й тримає цикл кадрів вічно.
    const start = body({ id: 1, x: 60, y: 500, vx: 420, vy: 0 });
    const moved = settle([start], WORLD, 0.2);
    expect(moved[0]!.x).toBeGreaterThan(start.x + 20);

    const stopped = settle([start], WORLD, 6);
    expect(wishSpheresAtRest(stopped)).toBe(true);
    expect(stopped[0]!.vx).toBe(0);
    expect(stopped[0]!.vy).toBe(0);
  });

  it('keeps every sphere inside the field, however hard it is thrown', () => {
    const thrown = [
      body({ id: 1, x: 200, y: 300, vx: 5000, vy: 2000 }),
      body({ id: 2, x: 100, y: 400, vx: -4000, vy: -3000, radius: 44 }),
    ];
    const state = settle(thrown, WORLD, 4);
    for (const item of state) {
      expect(item.x - item.radius).toBeGreaterThanOrEqual(-1e-6);
      expect(item.x + item.radius).toBeLessThanOrEqual(WORLD.width + 1e-6);
      expect(item.y - item.radius).toBeGreaterThanOrEqual(-1e-6);
      expect(item.y + item.radius).toBeLessThanOrEqual(WORLD.height + 1e-6);
    }
  });
});

describe('collisions', () => {
  it('separates spheres that start on top of each other', () => {
    // Розкладка може поставити кулі впритул — після зміни розміру за
    // пріоритетом це стало звичайною справою. Розв'язувати перекриття мусить
    // саме крок, а не розкладка.
    const stacked = [
      body({ id: 1, x: 200, y: 500, radius: 36 }),
      body({ id: 2, x: 206, y: 502, radius: 30 }),
      body({ id: 3, x: 203, y: 498, radius: 24 }),
    ];
    const state = settle(stacked, WORLD, 5);
    for (const a of state) {
      for (const b of state) {
        if (a === b) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        expect(gap, `${a.id}~${b.id}`).toBeGreaterThanOrEqual(a.radius + b.radius - 1);
      }
    }
  });

  it('passes the push along instead of swallowing it', () => {
    // Це і є «як кулі в більярді»: та, у яку влучили, рушає з місця, а та, що
    // вдарила, втрачає частину швидкості.
    //
    // Стіл тут вільний — без силуету монарха. Перша редакція цієї перевірки
    // ставила обидві кулі просто в камінь, і рухав їх він, а не удар: тест
    // показував не те, що перевіряв.
    const table: WishSphereWorld = { width: WORLD.width, height: WORLD.height };
    const cue = body({ id: 1, x: 80, y: 560, vx: 600, vy: 0, radius: 30 });
    const target = body({ id: 2, x: 145, y: 560, vx: 0, vy: 0, radius: 30 });
    const state = settle([cue, target], table, 0.35);
    const hit = state.find((item) => item.id === 2)!;
    const striker = state.find((item) => item.id === 1)!;
    expect(hit.x).toBeGreaterThan(target.x + 10);
    expect(striker.vx).toBeLessThan(600);
  });

  it('lets a held sphere push its neighbours without moving itself', () => {
    // Палець сильніший за інерцію: поки кулю тримають, вона їде за пальцем, а
    // не за фізикою — інакше перетягування відчувалось би як боротьба.
    const table: WishSphereWorld = { width: WORLD.width, height: WORLD.height };
    const held = body({ id: 1, x: 200, y: 500, radius: 36 });
    const neighbour = body({ id: 2, x: 240, y: 500, radius: 30 });
    const state = stepWishSpheres([held, neighbour], { ...table, held: 1 }, 1 / 60);
    expect(state[0]!.x).toBe(200);
    expect(state[0]!.y).toBe(500);
    expect(state[1]!.x).toBeGreaterThan(240);
  });
});

describe('the monarch is a cushion, not empty space', () => {
  it('never leaves a sphere inside the silhouette', () => {
    // Ієрархія «монарх → бажання» не має триматись на тому, що ніхто нічого не
    // кинув у центр.
    const thrown = [
      body({ id: 1, x: 60, y: 520, vx: 900, vy: -200 }),
      body({ id: 2, x: 380, y: 560, vx: -1200, vy: -100, radius: 40 }),
    ];
    const state = settle(thrown, WORLD, 6);
    const obstacle = WORLD.obstacle!;
    for (const item of state) {
      if (item.y + item.radius < obstacle.tipY) continue;
      const depth = Math.min(1, Math.max(0, (item.y - obstacle.tipY) / (WORLD.height - obstacle.tipY)));
      const halfWidth = obstacle.tipWidth + depth * (obstacle.baseWidth - obstacle.tipWidth);
      expect(Math.abs(item.x - obstacle.centreX), `${item.id}`)
        .toBeGreaterThanOrEqual(halfWidth + item.radius - 1e-6);
    }
  });
});

describe('the step is honest', () => {
  it('gives the same answer for the same input', () => {
    const bodies = [
      body({ id: 1, x: 120, y: 400, vx: 300, vy: -120 }),
      body({ id: 2, x: 180, y: 430, vx: -80, vy: 40, radius: 40 }),
    ];
    const first = settle(bodies, WORLD, 1);
    const second = settle(bodies, WORLD, 1);
    expect(second).toEqual(first);
  });

  it('does not depend on the frame rate for where a sphere lands', () => {
    // Тертя експоненційне саме заради цього: на швидкому екрані куля має
    // котитись так само далеко, як на повільному.
    const start = [body({ id: 1, x: 60, y: 560, vx: 500, vy: 0 })];
    let fast = [...start];
    for (let i = 0; i < 240; i += 1) fast = stepWishSpheres(fast, WORLD, 1 / 120);
    let slow = [...start];
    for (let i = 0; i < 60; i += 1) slow = stepWishSpheres(slow, WORLD, 1 / 30);
    expect(Math.abs(fast[0]!.x - slow[0]!.x)).toBeLessThan(6);
  });

  it('survives nonsense instead of spreading NaN', () => {
    const broken = [
      body({ id: 1, x: Number.NaN, y: 10, vx: Number.POSITIVE_INFINITY, vy: 0 }),
      body({ id: 2, x: Number.NaN, y: Number.NaN, radius: Number.NaN }),
    ];
    const state = stepWishSpheres(broken, { ...WORLD, width: Number.NaN }, Number.NaN);
    for (const item of state) {
      for (const value of [item.x, item.y, item.vx, item.vy, item.radius]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
