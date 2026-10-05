import { describe, expect, it } from 'vitest';
import { DOG_CHASE_S, DOG_ROAM_S, DOG_TRIP_CHANCE, newDog, stepDog, type Dog, type DogWorld } from './dog';

const open: DogWorld['canStand'] = (x, y) => x > 0 && y > 0 && x < 600 && y < 500;

function run(d: Dog, seconds: number, w: DogWorld, dt = 1 / 60): { dog: Dog; trips: number } {
  let trips = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const r = stepDog(d, dt, w);
    d = r.dog;
    if (r.trip) trips += 1;
  }
  return { dog: d, trips };
}

describe('Бася на подвір\'ї (власник, 2026-10-05)', () => {
  it('5 секунд бігає по подвір\'ю, 3 секунди — за Лєною, і знову', () => {
    const w: DogWorld = { lena: { x: 300, y: 250 }, canStand: open };
    let d = newDog(100, 100, 7);
    expect(d.mode).toBe('roam');
    d = run(d, DOG_ROAM_S - 0.1, w).dog;
    expect(d.mode).toBe('roam');
    d = run(d, 0.2, w).dog;
    expect(d.mode).toBe('chase');
    d = run(d, DOG_CHASE_S - 0.2, w).dog;
    expect(d.mode).toBe('chase');
    d = run(d, 0.2, w).dog;
    expect(d.mode).toBe('roam');
  });

  it('за 3 секунди погоні справді добігає до Лєни й крутиться біля неї', () => {
    const w: DogWorld = { lena: { x: 320, y: 260 }, canStand: open };
    const d = run(newDog(60, 60, 3), DOG_ROAM_S + DOG_CHASE_S - 0.3, w).dog;
    expect(d.mode).toBe('chase');
    expect(d.arrived).toBe(true);
    expect(Math.hypot(d.x - w.lena.x, d.y - w.lena.y)).toBeLessThan(24);
  });

  it('падіння — щонайбільше раз на підбіг і приблизно в 30% підбігів', () => {
    const w: DogWorld = { lena: { x: 300, y: 250 }, canStand: open };
    let total = 0;
    const approaches = 120;
    let d = newDog(290, 245, 11);
    for (let i = 0; i < approaches; i += 1) {
      const r = run(d, DOG_ROAM_S + DOG_CHASE_S, w, 1 / 30);
      expect(r.trips).toBeLessThanOrEqual(1);
      total += r.trips;
      d = r.dog;
    }
    expect(d.approach).toBe(approaches);
    const share = total / approaches;
    expect(share).toBeGreaterThan(DOG_TRIP_CHANCE - 0.12);
    expect(share).toBeLessThan(DOG_TRIP_CHANCE + 0.12);
  });

  it('не пробігає крізь стіни: стоїть лише там, де можна стати', () => {
    const wall = (x: number, y: number) => open(x, y) && !(x > 200 && x < 240);
    const w: DogWorld = { lena: { x: 400, y: 200 }, canStand: wall };
    let d = newDog(100, 200, 5);
    for (let i = 0; i < 60 * 30; i += 1) {
      d = stepDog(d, 1 / 60, w).dog;
      expect(wall(d.x, d.y)).toBe(true);
    }
  });

  it('той самий сейв — ті самі падіння', () => {
    const w: DogWorld = { lena: { x: 300, y: 250 }, canStand: open };
    const a = run(newDog(290, 245, 42), 80, w, 1 / 30).trips;
    const b = run(newDog(290, 245, 42), 80, w, 1 / 30).trips;
    expect(a).toBe(b);
  });
});

describe('догляд за Басею (власник, 2026-10-05: «погладити чи покормити»)', () => {
  it('погладити — настрій росте перші три рази на день, далі просто радіє', async () => {
    const { newLife } = await import('./life');
    const { petBasia, PETS_PER_DAY } = await import('./dog');
    let s = { ...newLife(1, 'sadok'), mood: 50 };
    for (let i = 0; i < PETS_PER_DAY; i += 1) s = petBasia(s).state;
    expect(s.mood).toBe(50 + 2 * PETS_PER_DAY);
    expect(petBasia(s).state.mood).toBe(s.mood);
  });

  it('нагодувати — раз на день', async () => {
    const { newLife, LifeRuleError } = await import('./life');
    const { feedBasia } = await import('./dog');
    const s = feedBasia({ ...newLife(1, 'sadok'), mood: 50 }).state;
    expect(s.mood).toBe(53);
    expect(() => feedBasia(s)).toThrow(LifeRuleError);
  });

  it('погладжена Бася сидить біля Лєни, а не біжить', () => {
    const w: DogWorld = { lena: { x: 300, y: 250 }, canStand: open };
    const d = { ...newDog(280, 250, 1), happy: 1 };
    const r = run(d, 0.9, w).dog;
    expect(Math.hypot(r.x - 280, r.y - 250)).toBe(0);
    expect(r.dir).toBe(2);
  });
});
