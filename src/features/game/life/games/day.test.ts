import { describe, expect, it } from 'vitest';
import { firstDayOfWeek } from '../sim/calendar';
import { JOBS } from '../sim/content';
import { newLife, type LifeState } from '../sim/life';
import { LENA_ADULT } from '../render/people';
import { dayPlan, makeGame } from './day';
import { lessonGame, subjectsFor } from './lessons';
import { shiftGame } from './work';
import { rngFor } from '../sim/rng';

// ============================================================
// Розклад дня (ADR-0239 §4): власник — «допрацюй ігри в садочку й уроки
// в школі, щоб вони не були такими одноманітними».
// ============================================================

const at = (s: LifeState, day: number): LifeState => ({ ...s, day });

/** Прогнати гру до кінця «мавпою»: торкатися всюди, поки не скінчиться. */
function monkey(game: ReturnType<typeof makeGame>, steps = 4000) {
  for (let k = 0; k < steps && !game.done; k += 1) game.update(0.05);
  return game;
}

describe('садочок', () => {
  it('три різні ігри на день, за тиждень — щонайменше шість різних, два дні поспіль не однакові', () => {
    const s = newLife(11);
    const week = [0, 1, 2, 3, 4].map((d) => dayPlan(at(s, d)).map((g) => g.id));
    for (const day of week) expect(new Set(day).size).toBe(3);
    expect(new Set(week.flat()).size).toBeGreaterThanOrEqual(6);
    for (let d = 1; d < week.length; d += 1) expect(week[d]).not.toEqual(week[d - 1]);
  });

  it('той самий день того самого сейву — та сама програма', () => {
    expect(dayPlan(at(newLife(5), 3))).toEqual(dayPlan(at(newLife(5), 3)));
  });
});

describe('школа', () => {
  it('три різні уроки й перерва з грою; фізкультура щотижня', () => {
    for (const week of [1, 4, 7, 11]) {
      const days = [0, 1, 2, 3, 4].map((d) => dayPlan(at(newLife(3, 'school'), firstDayOfWeek(week) + d)));
      for (const day of days) {
        const lessons = day.filter((g) => g.kind === 'lesson').map((g) => g.id);
        expect(new Set(lessons).size).toBe(3);
        expect(day.filter((g) => g.kind === 'playground')).toHaveLength(1);
      }
      expect(days.flat().some((g) => g.id === 'pe'), `тиждень ${week}`).toBe(true);
      expect(new Set(days.flat().map((g) => g.id)).size, `тиждень ${week}: різноманіття`).toBeGreaterThanOrEqual(7);
    }
  });

  it('предмети ростуть із класом: географія з 5-го, фізика й хімія з 7-го', () => {
    expect(subjectsFor(2)).not.toContain('geo');
    expect(subjectsFor(5)).toContain('geo');
    expect(subjectsFor(7)).toEqual(expect.arrayContaining(['physics', 'chemistry']));
  });
});

describe('ВДПУ і робота', () => {
  it('ВДПУ — історичний факультет: педагогіка, психологія, історія, методика; ні економіки, ні бухобліку (власник, 2026-10-05)', () => {
    const uni = subjectsFor(12);
    expect(uni).toEqual(expect.arrayContaining(['pedagogy', 'psychology', 'histUa', 'histWorld', 'methods']));
    for (const gone of ['econ', 'accounting', 'marketing', 'stats']) expect(uni as string[]).not.toContain(gone);
    // Кожен предмет і сесія збирають гру без помилки.
    for (const s of [...uni, 'exam' as const]) {
      const g = lessonGame(s, { rng: rngFor(5), level: 13, lena: LENA_ADULT });
      expect(g.title.length).toBeGreaterThan(0);
    }
  });

  it('у середу й п\'ятницю — сесія; у будні — дві пари', () => {
    const uni = newLife(4, 'uni');
    expect(dayPlan(at(uni, firstDayOfWeek(12) + 2))[0]!.id).toBe('exam');
    expect(dayPlan(at(uni, firstDayOfWeek(12)))).toHaveLength(2);
  });

  it('кожна робота має свою гру, і її можна створити', () => {
    for (const job of JOBS) {
      const g = shiftGame(job.game, { rng: rngFor(1, job.id), level: 0, lena: LENA_ADULT });
      expect(g.title.length).toBeGreaterThan(3);
      expect(g.done).toBe(false);
    }
  });
});

describe('ігри не зависають і не закінчуються самі там, де мають чекати дотику', () => {
  it('таймерні ігри завершуються без дотиків із підсумком 0..1', () => {
    for (const id of ['hide', 'butterflies', 'shapes'] as const) {
      const s = newLife(9);
      const g = monkey(makeGame(s, { kind: 'playground', id, title: id, level: 0, key: `t:${id}` }, LENA_ADULT));
      expect(g.done, id).toBe(true);
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(1);
    }
  });

  it('уроки з таймером не ставлять оцінку без жодної відповіді', () => {
    const g = lessonGame('math', { rng: rngFor(2), level: 3, lena: LENA_ADULT });
    monkey(g, 400);
    expect(g.done).toBe(false);
  });
});
