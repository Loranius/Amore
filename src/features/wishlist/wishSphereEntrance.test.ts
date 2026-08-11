import { describe, expect, it } from 'vitest';
import {
  ENTRANCE_DELAY,
  ENTRANCE_RUN,
  ENTRANCE_STAGGER,
  wishSphereEntrance,
  wishSphereEntranceOrder,
  wishSphereEntranceSpan,
} from './wishSphereEntrance';

// ============================================================
// Вхід бажань у кадр.
// ------------------------------------------------------------
// Знімок показує лише один кадр, а тут перевіряється саме рух: коли рушає
// куля, чи не пролітає вона повз місце, чи справді політ одної перекривається
// з політом іншої. Хореографію, зведену руками, від того, що насправді грає,
// відрізнити оком неможливо.
// ============================================================

const TRAVEL = 420;

function at(elapsed: number, beat = 0) {
  return wishSphereEntrance({ elapsed, beat, travel: TRAVEL });
}

describe('a wish floats in from the right', () => {
  it('waits off the right edge until its turn', () => {
    // Не блимає на місці й не стоїть посеред кадру прозорою: поки черга не
    // дійшла, куля за краєм.
    for (const elapsed of [0, 100, ENTRANCE_DELAY - 1]) {
      const step = at(elapsed);
      expect(step.dx).toBe(TRAVEL);
      expect(step.opacity).toBe(0);
      expect(step.flying).toBe(true);
    }
  });

  it('arrives exactly at its place and then lets physics have it', () => {
    const landed = at(ENTRANCE_DELAY + ENTRANCE_RUN + 1);
    expect(landed).toEqual({ dx: 0, dy: 0, scale: 1, opacity: 1, flying: false });
  });

  it('only ever gets closer — no overshoot past its own place', () => {
    // Проліт із поверненням читався б як пружина. Вхід — це під'їзд.
    let previous = Infinity;
    for (let elapsed = ENTRANCE_DELAY; elapsed <= ENTRANCE_DELAY + ENTRANCE_RUN; elapsed += 10) {
      const step = at(elapsed);
      expect(step.dx).toBeLessThanOrEqual(previous + 1e-9);
      expect(step.dx).toBeGreaterThanOrEqual(0);
      previous = step.dx;
    }
  });

  it('comes in on an arc, not along a ruler', () => {
    // Пряма читалась би як стрічка, що їде. Куля заходить знизу, підіймається
    // над прямою до місця й опускається на нього.
    //
    // Міряється найвища точка дуги, а не середина польоту: гальмування
    // зміщує вершину на першу чверть шляху, тож «на середині» — це вже
    // спуск, і перевірка середини питала б про гальмування, а не про дугу.
    let highest = 0;
    for (let elapsed = ENTRANCE_DELAY; elapsed <= ENTRANCE_DELAY + ENTRANCE_RUN; elapsed += 10) {
      highest = Math.min(highest, at(elapsed).dy);
    }
    expect(highest).toBeLessThan(-20);
    const early = at(ENTRANCE_DELAY + ENTRANCE_RUN * 0.04);
    expect(early.dy).toBeGreaterThan(0);
    expect(at(ENTRANCE_DELAY + ENTRANCE_RUN).dy).toBe(0);
  });

  it('grows and fades in, rather than appearing full-size', () => {
    const start = at(ENTRANCE_DELAY + 1);
    expect(start.scale).toBeLessThan(0.7);
    expect(start.opacity).toBeLessThan(0.1);
    expect(at(ENTRANCE_DELAY + ENTRANCE_RUN * 0.3).opacity).toBe(1);
  });
});

describe('the wishes overlap in the air', () => {
  it('starts each next sphere before the previous has landed', () => {
    // Вимога хореографії: черга читалась би як список, що заповнюється.
    // Інтервал мусить бути значно меншим за політ.
    expect(ENTRANCE_STAGGER).toBeLessThan(ENTRANCE_RUN / 3);
    // Коли перша ще в дорозі, шоста вже рушила.
    const whenSixthStarts = ENTRANCE_DELAY + 5 * ENTRANCE_STAGGER + 1;
    expect(at(whenSixthStarts, 5).flying).toBe(true);
    expect(at(whenSixthStarts, 5).dx).toBeLessThan(TRAVEL);
    expect(at(whenSixthStarts, 0).dx).toBeGreaterThan(0);
  });

  it('overlaps the camera turn instead of waiting for it', () => {
    // Якби бажання чекали кінця оберту, це були б два переходи підряд, а не
    // один рух. Оберт триває 1100 мс — перша куля рушає задовго до кінця.
    expect(ENTRANCE_DELAY).toBeLessThan(1100);
  });

  it('knows how long the whole thing takes', () => {
    expect(wishSphereEntranceSpan(7))
      .toBe(ENTRANCE_DELAY + 6 * ENTRANCE_STAGGER + ENTRANCE_RUN);
    expect(wishSphereEntranceSpan(0)).toBe(0);
    expect(wishSphereEntranceSpan(Number.NaN)).toBe(0);
  });
});

describe('the order is a constellation, not a list', () => {
  it('gives every wish its own beat', () => {
    const order = wishSphereEntranceOrder([11, 22, 33, 44, 55, 66, 77]);
    expect(new Set(order.values()).size).toBe(7);
    expect([...order.values()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('does not simply fill in list order', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const order = wishSphereEntranceOrder(ids);
    expect(ids.map((id) => order.get(id))).not.toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('answers the same for the same set', () => {
    // Вхід не має бути ще одним джерелом випадковості на кожен рендер:
    // перемальовування посеред польоту переставило б кулі в повітрі.
    const first = wishSphereEntranceOrder([3, 9, 27, 81]);
    for (let repeat = 0; repeat < 4; repeat += 1) {
      expect(wishSphereEntranceOrder([3, 9, 27, 81])).toEqual(first);
    }
  });

  it('survives nonsense instead of losing a wish', () => {
    const order = wishSphereEntranceOrder([Number.NaN, 2]);
    expect(order.size).toBe(2);
    for (const beat of order.values()) expect(Number.isFinite(beat)).toBe(true);
    const step = wishSphereEntrance({ elapsed: Number.NaN, beat: Number.NaN, travel: Number.NaN });
    for (const value of [step.dx, step.dy, step.scale, step.opacity]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
