import { describe, expect, it } from 'vitest';
import { BIRD_RANGE_X, BIRD_RANGE_Y, BIRD_SPEED, FLEE_SPEED, SCARE_PX, birdDir, newBird, stepBird, type Bird, type BirdKind, type BirdWorld } from './birds';

// Кури й півень на подвір'ї (ADR-0239, власник 2026-10-12: «замість тих
// курей-кругляшків, що дригаються з місця на місце»): птаха живе біля свого
// місця — стоїть, дзьобає, переходить на кілька кроків — і тікає від Лєни
// й Басі. Зерна записані, тож кожен прогін той самий.

const open: BirdWorld['canStand'] = (x, y) => x > 0 && y > 0 && x < 600 && y < 400;
const calm: BirdWorld = { scare: [], canStand: open };

function run(b: Bird, seconds: number, w: BirdWorld, each?: (b: Bird) => void, dt = 1 / 60): Bird {
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    b = stepBird(b, dt, w);
    each?.(b);
  }
  return b;
}

describe('кури й півень: поведінка', () => {
  it('той самий сейв — та сама курка: кожен кидок від зерна й номера вибору', () => {
    const a = run(newBird('white', 200, 150, 41), 60, calm);
    const b = run(newBird('white', 200, 150, 41), 60, calm);
    expect(b).toEqual(a);
    // А сусідки з іншими зернами не ходять строєм.
    const c = run(newBird('white', 200, 150, 42), 60, calm);
    expect(Math.hypot(c.x - a.x, c.y - a.y) + Math.abs(c.picks - a.picks)).toBeGreaterThan(0);
  });

  it('ходить лише довкола свого місця: уздовж далі, ніж угору-вниз', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const home = { x: 300, y: 200 };
      let maxX = 0;
      let maxY = 0;
      run(newBird('brown', home.x, home.y, seed), 180, calm, (b) => {
        maxX = Math.max(maxX, Math.abs(b.x - home.x));
        maxY = Math.max(maxY, Math.abs(b.y - home.y));
      });
      expect(maxX, `зерно ${seed}`).toBeLessThanOrEqual(BIRD_RANGE_X + 1e-6);
      expect(maxY, `зерно ${seed}`).toBeLessThanOrEqual(BIRD_RANGE_Y + 1e-6);
      // І справді ходить, а не стоїть на місці.
      expect(maxX, `зерно ${seed}`).toBeGreaterThan(BIRD_RANGE_X / 3);
    }
  });

  it('стоїть, дзьобає й ходить — і не смикається: кожен стан триває, а не міняється щокадру', () => {
    const time = { stand: 0, peck: 0, walk: 0, flee: 0 };
    let changes = 0;
    let was = newBird('white', 300, 200, 9);
    run(was, 300, calm, (b) => {
      time[b.state] += 1 / 60;
      if (b.state !== was.state) changes += 1;
      was = b;
    });
    expect(time.stand).toBeGreaterThan(30);
    expect(time.peck).toBeGreaterThan(30);
    expect(time.walk).toBeGreaterThan(30);
    expect(time.flee).toBe(0);
    // Середній стан триває понад пів секунди.
    expect(300 / changes).toBeGreaterThan(0.5);
  });

  it('дзьобає профілем (кадри дзьобання — збоку); півень ходить лише профілем, а до глядача обертається, лише стоячи', () => {
    for (const kind of ['white', 'brown', 'rooster'] as BirdKind[]) {
      const dirs = new Set<number>();
      let facing = 0;
      run(newBird(kind, 300, 200, 17), 300, calm, (b) => {
        if (b.state === 'peck') expect([1, 2]).toContain(b.dir);
        if (kind === 'rooster' && b.state !== 'stand') expect([1, 2], `півень ${b.state}`).toContain(b.dir);
        if (kind === 'rooster' && b.dir === 0) facing += 1 / 60;
        dirs.add(b.dir);
      });
      if (kind === 'rooster') {
        expect([...dirs].sort()).toEqual([0, 1, 2]);
        expect(facing).toBeGreaterThan(10);
      } else expect([...dirs].sort()).toEqual([0, 1, 2, 3]);
    }
    // Півень, що йде просто вгору чи вниз, — профілем; курка — спиною чи обличчям.
    expect(birdDir('rooster', 0, -10, 1)).toBe(1);
    expect(birdDir('rooster', 0, 10, 2)).toBe(2);
    expect(birdDir('white', 0, -10, 1)).toBe(3);
    expect(birdDir('white', 0, 10, 1)).toBe(0);
  });

  it('тікає від Лєни швидше, ніж ходить, а коли та пішла — вертається до свого місця', () => {
    const home = { x: 300, y: 200 };
    const lena = { x: home.x - 10, y: home.y };
    const scared: BirdWorld = { scare: [lena], canStand: open };
    let b = stepBird(newBird('brown', home.x, home.y, 5), 1 / 60, scared);
    expect(b.state).toBe('flee');
    expect(b.target!.x).toBeGreaterThan(home.x);
    const x0 = b.x;
    b = run(b, 0.3, scared);
    expect((b.x - x0) / 0.3).toBeGreaterThan(BIRD_SPEED * 1.8);
    expect((b.x - x0) / 0.3).toBeLessThanOrEqual(FLEE_SPEED + 1e-6);
    b = run(b, 2, scared);
    expect(Math.hypot(b.x - lena.x, b.y - lena.y)).toBeGreaterThanOrEqual(SCARE_PX);
    // Лєна пішла: за пів хвилини курка знову ходить біля свого місця.
    b = run(b, 30, calm);
    expect(Math.abs(b.x - home.x)).toBeLessThanOrEqual(BIRD_RANGE_X + 1e-6);
    expect(Math.abs(b.y - home.y)).toBeLessThanOrEqual(BIRD_RANGE_Y + 1e-6);
  });

  it('ніколи не стає туди, де стояти не можна, — ні ходою, ні втечею', () => {
    // Тин просто справа від місця й Бася, що ганяє курку вздовж нього.
    const fence = (x: number, y: number) => open(x, y) && !(x > 316 && x < 324);
    const home = { x: 305, y: 200 };
    let t = 0;
    run(newBird('white', home.x, home.y, 23), 120, { scare: [], canStand: fence }, (b) => {
      t += 1 / 60;
      expect(fence(b.x, b.y), `${t.toFixed(2)} с: ${b.x.toFixed(1)},${b.y.toFixed(1)}`).toBe(true);
    });
    const dog = { x: 280, y: 200 };
    run(newBird('white', home.x, home.y, 24), 20, { scare: [dog], canStand: fence }, (b) => {
      expect(fence(b.x, b.y)).toBe(true);
      expect(b.x).toBeLessThan(316);
    });
  });
});
