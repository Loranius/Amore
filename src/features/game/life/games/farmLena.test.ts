import { describe, expect, it } from 'vitest';
import { LENA_ADULT, LENA_KID, LENA_TEEN } from '../render/people';
import { frontHands, hdFoot, hdHeight, poseHand, POSE_NAMES } from '../render/peopleHd';
import { artScale, basketBody, basketWidth, coopSpot } from './farmLena';
import type { Kit } from './kit';

// ============================================================
// Лєна в міні-іграх садиби малюнком PixelLab (ADR-0239, власник
// 2026-10-31: «будемо допрацьовувати візуал персонажів» → «Лєна в
// міні-іграх»). Тут — геометрія, з якою гра кладе кошик і вудку в руки
// Лєни; чи справді там долоні, перевіряє `scripts/port/people.test.mjs`.
// ============================================================

const LENAS = [['мала', LENA_KID], ['підліток', LENA_TEEN], ['доросла', LENA_ADULT]] as const;

describe('Лєна в міні-іграх садиби', () => {
  it('піксель малюнка — ціла кількість пікселів пристрою; на телефоні Лєна така, як була кодом, на комп\'ютері — менша', () => {
    for (const [s, z] of [[3, 2], [4, 2], [5, 2], [5, 1], [6, 1], [8, 1]] as const) {
      const device = artScale({ s } as Kit, z) * s;
      expect(Math.abs(device - Math.round(device)), `s=${s}, z=${z}`).toBeLessThan(1e-9);
      expect(device).toBeGreaterThanOrEqual(1);
    }
    expect(artScale({ s: 3 } as Kit, 2)).toBeCloseTo(4 / 3);
    expect(artScale({ s: 5 } as Kit, 1)).toBeCloseTo(0.6);
  });

  it.each(LENAS)('%s: є точки долонь для всіх поз і обличчям до нас', (_, look) => {
    expect(hdFoot(look)).not.toBeNull();
    for (const pose of POSE_NAMES) expect(poseHand(look, pose), pose).not.toBeNull();
    const front = frontHands(look)!;
    expect(front.l).toBeLessThan(0);
    expect(front.r).toBeGreaterThan(0);
    // Долоні висять біля стегон: вище чверті зросту й нижче половини.
    const height = hdHeight(look)! * 2;
    expect(front.up).toBeGreaterThan(height * 0.15);
    expect(front.up).toBeLessThan(height * 0.5);
  });

  it.each(LENAS)('%s: у курнику кошик угорі й унизу далеко один від одного, праворуч — попереду, ліворуч — дзеркально', (_, look) => {
    const a = 4 / 3;
    const s = 3;
    const x = 137;
    const y = 519;
    const ur = coopSpot(look, x, y, 'ur', a, s)!;
    const dr = coopSpot(look, x, y, 'dr', a, s)!;
    const ul = coopSpot(look, x, y, 'ul', a, s)!;
    const dl = coopSpot(look, x, y, 'dl', a, s)!;
    // Угорі кошик на долонях, унизу — з долонь за обідок: між ними щонайменше
    // висота кошика, тож жолоби біля Лєни не злипаються.
    expect(dr.by - ur.by).toBeGreaterThanOrEqual((basketBody(basketWidth(look)) + 3) * a);
    expect(ur.bx).toBeGreaterThan(x + ur.half / 2);
    expect(dr.bx).toBeGreaterThan(x + dr.half / 2);
    expect(x - ul.bx).toBeCloseTo(ur.bx - x);
    expect(x - dl.bx).toBeCloseTo(dr.bx - x);
    expect(ul.by).toBe(ur.by);
    expect(dl.by).toBe(dr.by);
    // Обидва кошики над землею, нижній — вище колін.
    expect(dr.by).toBeLessThan(y - hdHeight(look)! * 2 * 0.15 * a);
  });
});
