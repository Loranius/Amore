import { describe, expect, it } from 'vitest';
import { LENA_FALL_DOWN_S, LENA_FALL_S, LENA_TRIP_S, fallPhase } from '../sim/dog';
import { dizzy, dustAt, fallFrameHd, fallPosePixel, lyingness } from './fall';
import { FALL_DOWN_FRAMES, FALL_UP_FRAMES } from './peopleHd';

// Падіння Лєни від Басі (ADR-0239, власник 2026-10-13: «створи анімацію
// падіння від Басі для Лєни»): падає навзнак, лежить секунду, підводиться.

const STEP = 1 / 120;

function timeline<T>(f: (t: number) => T): T[] {
  const out: T[] = [];
  for (let t = 0; t <= LENA_TRIP_S + 1e-9; t += STEP) out.push(f(t));
  return out;
}

describe('падіння Лєни: кадри', () => {
  it('32×32: кадри падіння по черзі, секунду лежить, далі кадри підйому — кожен кадр видно', () => {
    const frames = timeline(fallFrameHd);
    expect(frames[0]).toBe(0);
    expect(frames[frames.length - 1]).toBe(FALL_DOWN_FRAMES + FALL_UP_FRAMES - 1);
    for (let i = 1; i < frames.length; i += 1) expect(frames[i]!).toBeGreaterThanOrEqual(frames[i - 1]!);
    // Кожен з 12 кадрів з'являється й тримається щонайменше 50 мс.
    for (let f = 0; f < FALL_DOWN_FRAMES + FALL_UP_FRAMES; f += 1) {
      expect(frames.filter((x) => x === f).length * STEP, `кадр ${f}`).toBeGreaterThanOrEqual(0.05);
    }
    // Лежить (останній кадр падіння) — сама секунда лежання й ще мить падіння.
    const lying = frames.filter((x) => x === FALL_DOWN_FRAMES - 1).length * STEP;
    expect(lying).toBeGreaterThanOrEqual(LENA_FALL_S);
    expect(lying).toBeLessThan(LENA_FALL_S + LENA_FALL_DOWN_S / 2);
  });

  it('16×16: відхиляється назад → падає навзнак → лежить … → сідає → підводиться → стоїть', () => {
    const poses = timeline(fallPosePixel);
    const runs = poses.filter((p, i) => i === 0 || p !== poses[i - 1]);
    expect(runs).toEqual([1, 2, 3, 2, 1, 0]);
    expect(fallPosePixel(LENA_FALL_DOWN_S + LENA_FALL_S / 2)).toBe(3);
    expect(fallPosePixel(LENA_TRIP_S)).toBe(0);
    // Кожну позу видно щонайменше 0,1 с (остання — «стоїть» — триває й після падіння).
    for (let i = 0, run = 1; i < poses.length - 1; i += 1, run += 1) {
      if (poses[i + 1] === poses[i]) continue;
      expect(run * STEP, `поза ${poses[i]}`).toBeGreaterThanOrEqual(0.1);
      run = 0;
    }
  });

  it('тінь розтягується, поки лягає; зірочки — поки лежить і сідає; пил — щойно впала', () => {
    expect(lyingness(0)).toBe(0);
    expect(lyingness(LENA_FALL_DOWN_S + 0.5)).toBe(1);
    expect(lyingness(LENA_TRIP_S)).toBe(0);
    const stars = timeline(dizzy);
    expect(stars[0]).toBe(false);
    expect(stars[stars.length - 1]).toBe(false);
    const starsS = stars.filter(Boolean).length * STEP;
    expect(starsS).toBeGreaterThanOrEqual(LENA_FALL_S);
    // Пил — лише на початку лежання, і осідає.
    const dust = timeline((t) => ({ t, d: dustAt(t) })).filter((x) => x.d != null);
    expect(dust.length).toBeGreaterThan(0);
    for (const x of dust) expect(fallPhase(x.t).phase).toBe('lie');
    for (let i = 1; i < dust.length; i += 1) expect(dust[i]!.d!).toBeGreaterThan(dust[i - 1]!.d!);
  });
});
