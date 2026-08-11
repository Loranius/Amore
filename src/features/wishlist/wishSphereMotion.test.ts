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

// Стіл без перешкод: силует монарха більше не борт. Власник зробив кристал
// фоном модуля, і фізика про нього нічого не знає.
const WORLD: WishSphereWorld = { width: 412, height: 620 };

/**
 * Куля для тесту. Місце в сузір'ї за умовчанням там, де куля стоїть: у
 * перевірках, які не про повернення, вона має лишатись удома, інакше вони
 * міряли б повернення замість того, що написано в їхній назві.
 */
function body(patch: Partial<WishSphereBody> & { id: number }): WishSphereBody {
  const base = { x: 100, y: 100, vx: 0, vy: 0, radius: 30, calm: 0, ...patch };
  return { ...base, homeX: patch.homeX ?? base.x, homeY: patch.homeY ?? base.y };
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
    //
    // Міряється до того, як почне збиратись сузір'я: інакше замість тертя тут
    // перевірялось би повернення, яке спиняє кулю з іншої причини. Звідси й
    // 2.4 с — під порогом 2.6.
    //
    // Дві секунди тут стояли, поки на столі був камінь: куля доїжджала до
    // силуету, відскакувала й гасла швидше. Відколи кристал став фоном, вона
    // котиться вільно, і чисте тертя гасить 420 px/с до порога нерухомості за
    // 2.19 с. Число змінилось, властивість — ні.
    const start = body({ id: 1, x: 60, y: 500, vx: 420, vy: 0 });
    const moved = settle([start], WORLD, 0.2);
    expect(moved[0]!.x).toBeGreaterThan(start.x + 20);

    const stopped = settle([start], WORLD, 2.4);
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
    //
    // Місця в сузір'ї задані окремо й нарізно: перекриття тут — початкова
    // умова, а не домівка. Інакше перевірка мовчки перетворилась би на «чи
    // переважує розштовхування повернення».
    const stacked = [
      body({ id: 1, x: 200, y: 500, radius: 36, homeX: 90, homeY: 500 }),
      body({ id: 2, x: 206, y: 502, radius: 30, homeX: 90, homeY: 400 }),
      body({ id: 3, x: 203, y: 498, radius: 24, homeX: 90, homeY: 310 }),
    ];
    const state = settle(stacked, WORLD, 2);
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

describe('the constellation gathers itself', () => {
  // Вимога власника: «щоб вони м'яко поверталися у своє сузір'я за кілька
  // секунд спокою». Стіл лишається столом — але композицію не можна розсипати
  // назавжди одним рухом пальця.
  const TABLE: WishSphereWorld = { width: 412, height: 620 };
  const AWAY = { id: 1, x: 300, y: 520, homeX: 110, homeY: 300 } as const;

  function distanceHome(item: WishSphereBody): number {
    return Math.hypot(item.x - item.homeX, item.y - item.homeY);
  }

  it('leaves a pushed sphere where it stopped for the first couple of seconds', () => {
    // «За кілька секунд спокою», а не «щойно відпустили»: куля, яку тягне
    // назад одразу, — це не стіл, а гумка, і гратись нею неможливо.
    const after = settle([body({ ...AWAY })], TABLE, 2);
    expect(after[0]!.x).toBeCloseTo(300, 6);
    expect(after[0]!.y).toBeCloseTo(520, 6);
    // І цикл кадрів при цьому спинятись не має права: зупинений тут, він
    // просто ніколи б не дожив до повернення.
    expect(wishSpheresAtRest(after)).toBe(false);
  });

  it('brings it home, and then really stops', () => {
    // «Вдома» з точністю до кількох пікселів: далі куля не йде, бо на такій
    // відстані швидкість повернення вже нижча за поріг нерухомості. Це менше
    // за розмах її власного дрейфу, тобто оку невидиме.
    const after = settle([body({ ...AWAY })], TABLE, 8);
    expect(distanceHome(after[0]!)).toBeLessThanOrEqual(6);
    expect(wishSpheresAtRest(after)).toBe(true);
  });

  it('glides rather than snaps, and never overshoots its place', () => {
    // Проліт крізь місце з поверненням назад читався б як пружина. Тут рух
    // експоненційний: відстань лише зменшується.
    let state = [body({ ...AWAY })];
    let previous = distanceHome(state[0]!);
    let fastest = 0;
    for (let step = 0; step < 60 * 8; step += 1) {
      state = stepWishSpheres(state, TABLE, 1 / 60);
      const now = distanceHome(state[0]!);
      expect(now).toBeLessThanOrEqual(previous + 1e-6);
      previous = now;
      fastest = Math.max(fastest, Math.hypot(state[0]!.vx, state[0]!.vy));
    }
    // М'яко — це ще й «не пострілом»: стеля швидкості повернення значно нижча
    // за кидок пальцем.
    expect(fastest).toBeLessThanOrEqual(230);
  });

  it('does not gather while a finger is still on the table', () => {
    // Спокій — властивість столу, а не окремої кулі: поки одну тягнуть, решта
    // не має роз'їжджатись по місцях у неї під рукою.
    let state = [body({ ...AWAY }), body({ id: 2, x: 80, y: 120 })];
    for (let step = 0; step < 60 * 8; step += 1) {
      state = stepWishSpheres(state, { ...TABLE, held: 2 }, 1 / 60);
    }
    expect(state[0]!.x).toBeCloseTo(300, 6);
    expect(state[0]!.y).toBeCloseTo(520, 6);
  });

  it('gives up rather than fighting a neighbour for its place forever', () => {
    // Розкладка може поставити два місця впритул — тест сузір'я вимагає лише,
    // щоб вони не збіглись у точку. Дві кулі, які тягне одна крізь одну,
    // штовхались би вічно, а разом із ними вічно крутився б цикл кадрів.
    const state = settle([
      body({ id: 1, x: 100, y: 300, radius: 40, homeX: 200, homeY: 300 }),
      body({ id: 2, x: 320, y: 300, radius: 40, homeX: 214, homeY: 300 }),
    ], TABLE, 16);
    expect(wishSpheresAtRest(state)).toBe(true);
  });

  it('counts the calm in real seconds, not in frames', () => {
    // Виміряно на живому порталі, і це була справжня вада, а не примха
    // стенда: у безголовому Chromium сцена малюється програмно, кадри йдуть по
    // три на секунду — і крок 0.33 с обрізався до 1/30. За дев'ять справжніх
    // секунд «спокою» набігала одна, сузір'я не збиралось зовсім. На
    // повільному телефоні вийшло б те саме, тільки не так помітно.
    let slow = [body({ ...AWAY })];
    for (let step = 0; step < 12; step += 1) slow = stepWishSpheres(slow, TABLE, 1 / 3);
    // Чотири справжні секунди трьома кадрами на секунду — повернення вже мусить
    // іти, хоч сумарний крок фізики тут менший за секунду.
    expect(distanceHome(slow[0]!)).toBeLessThan(Math.hypot(300 - 110, 520 - 300));
  });

  it('does not skip the whole attempt after a long absence', () => {
    // Вкладка, до якої не повертались хвилину, приносить першим кадром
    // величезну різницю часу. Без стелі на крок відліку куля перестрибнула б
    // усе вікно спроби й лишилась би там, куди її колись відкотили.
    //
    // І вікно спроби мусить мірятись часом фізики, а не годинником: інакше
    // на рідких кадрах воно спливає на півдорозі. Виміряно — куля спинялась за
    // 166 px від свого місця.
    let state = [body({ ...AWAY })];
    for (let step = 0; step < 150; step += 1) state = stepWishSpheres(state, TABLE, 30);
    expect(distanceHome(state[0]!)).toBeLessThanOrEqual(6);
  });

  it('returns at the same pace whatever the frame rate', () => {
    const start = [body({ ...AWAY })];
    let fast = [...start];
    for (let step = 0; step < 120 * 5; step += 1) fast = stepWishSpheres(fast, TABLE, 1 / 120);
    let slow = [...start];
    for (let step = 0; step < 30 * 5; step += 1) slow = stepWishSpheres(slow, TABLE, 1 / 30);
    expect(Math.hypot(fast[0]!.x - slow[0]!.x, fast[0]!.y - slow[0]!.y)).toBeLessThan(6);
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
    //
    // Допуск виражений часткою пройденого шляху, а не пікселями. Пікселі тут
    // стояли, поки куля впиралась у силует монарха: борт зрізав розбіжність, і
    // «менше за шість» виглядало точністю, якою насправді був упор. На вільному
    // столі видно справжню ціну кроку Ейлера — 2.6% шляху, і саме її тут і
    // названо.
    const start = [body({ id: 1, x: 60, y: 560, vx: 500, vy: 0 })];
    let fast = [...start];
    for (let i = 0; i < 240; i += 1) fast = stepWishSpheres(fast, WORLD, 1 / 120);
    let slow = [...start];
    for (let i = 0; i < 60; i += 1) slow = stepWishSpheres(slow, WORLD, 1 / 30);
    const rolled = Math.abs(slow[0]!.x - 60);
    expect(rolled).toBeGreaterThan(150);
    expect(Math.abs(fast[0]!.x - slow[0]!.x)).toBeLessThan(rolled * 0.04);
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
