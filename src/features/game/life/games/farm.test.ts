import { describe, expect, it } from 'vitest';
import { LENA_ADULT, LENA_KID } from '../render/people';
import { BASKET_MAX, CROPS, EGGS_PER_ROUND, EGG_SPEEDUP_EVERY, FRUIT_PRICE, fruitEarnings, type Fruit } from '../sim/farm';
import { rngFor } from '../sim/rng';
import { BITE_S, CASTS, CHUTES, EggsGame, FishingGame, GARDEN_PLOTS, GARDEN_S, GardenGame, ORCHARD_DROPS, OrchardGame, basketAt, eggStepS } from './farm';
import type { GameContext, Kit } from './kit';

// ============================================================
// Міні-ігри садиби (ADR-0239, власник 2026-10-13). Ігри детерміновані:
// кості — `rngFor`, час — кроки `update`, тож тут їх грають «руками».
// ============================================================

const ctx = (key: string, lena = LENA_KID): GameContext => ({ rng: rngFor(7, 'farm-test', key), level: 0, lena });
/** Полотно без малювання: ігри беруть із нього лише розмір. */
const phone = { W: 274, H: 610 } as Kit;
const desk = { W: 256, H: 160 } as Kit;
const DT = 1 / 60;

describe('сад', () => {
  /** Лєна, що завжди стоїть під найнижчим фруктом, який падає. */
  function catcher(game: OrchardGame) {
    for (let k = 0; k < 60 * 120 && !game.done; k += 1) {
      const next = game.fruits.filter((f) => f.state === 'fall').sort((a, b) => b.y - a.y)[0];
      if (next) game.lena = next.x;
      game.update(DT);
    }
  }

  it('у кошик — не більше 15: на п\'ятнадцятому гра закінчується, гроші — за ціною кожного фрукта', () => {
    const game = new OrchardGame(ctx('full'));
    catcher(game);
    expect(game.done).toBe(true);
    expect(game.caught).toHaveLength(BASKET_MAX);
    const tally = game.tally as Record<Fruit, number>;
    expect((tally.apple ?? 0) + (tally.plum ?? 0) + (tally.pear ?? 0)).toBe(BASKET_MAX);
    expect(fruitEarnings(tally)).toBe(game.caught.reduce((s, f) => s + FRUIT_PRICE[f], 0));
    expect(game.summary).toEqual(['Кошик повний!', `+${fruitEarnings(tally)} ₴`]);
    expect(game.score).toBe(1);
  });

  it('якщо не ловити, фрукти падають на землю, а гра закінчується, коли дерева обтрусились', () => {
    const game = new OrchardGame(ctx('idle'));
    game.lena = 0.02;
    for (let k = 0; k < 60 * 120 && !game.done; k += 1) game.update(DT);
    expect(game.done).toBe(true);
    expect(game.caught.length).toBeLessThan(BASKET_MAX);
    expect(game.score).toBeLessThan(1);
    // Фруктів вистачає, щоб наповнити кошик, але не з великим запасом.
    expect(ORCHARD_DROPS).toBeGreaterThanOrEqual(BASKET_MAX * 2);
  });

  it('палець веде Лєну: вона йде туди, де торкнулись', () => {
    const game = new OrchardGame(ctx('walk'));
    game.point(desk.W * 0.9, 100, desk);
    for (let k = 0; k < 60; k += 1) game.update(DT);
    expect(game.lena).toBeGreaterThan(0.75);
  });

  it('той самий день — ті самі фрукти', () => {
    const a = new OrchardGame(ctx('same'));
    const b = new OrchardGame(ctx('same'));
    for (let k = 0; k < 600; k += 1) { a.update(DT); b.update(DT); }
    expect(a.fruits.map((f) => [f.kind, f.x])).toEqual(b.fruits.map((f) => [f.kind, f.x]));
  });
});

describe('курник', () => {
  it('яйця котяться швидше з кожним п\'ятим (власник): чотири швидкості на 20 яєць', () => {
    const steps = Array.from({ length: EGGS_PER_ROUND }, (_, n) => eggStepS(n));
    for (let n = 1; n < EGGS_PER_ROUND; n += 1) {
      if (n % EGG_SPEEDUP_EVERY === 0) expect(steps[n], `яйце ${n + 1}`).toBeLessThan(steps[n - 1]!);
      else expect(steps[n]).toBe(steps[n - 1]);
    }
    expect(new Set(steps).size).toBe(EGGS_PER_ROUND / EGG_SPEEDUP_EVERY);
  });

  /** Лєна, що підставляє кошик під яйце, яке скотиться найперше. */
  function perfect(game: EggsGame) {
    for (let k = 0; k < 60 * 200 && !game.done; k += 1) {
      const rolling = game.eggs.filter((e) => e.state === 'roll');
      const first = rolling.sort((a, b) => ((5 - a.pos) * a.step - a.t) - ((5 - b.pos) * b.step - b.t))[0];
      if (first) game.pose = CHUTES[first.chute]!;
      game.update(DT);
    }
  }

  it('за раунд — рівно 20 яєць; хто встигає, той ловить усі', () => {
    const game = new EggsGame(ctx('perfect'));
    perfect(game);
    expect(game.done).toBe(true);
    expect(game.launched).toBe(EGGS_PER_ROUND);
    expect(game.caught).toBe(EGGS_PER_ROUND);
    expect(game.tally).toEqual({ eggs: EGGS_PER_ROUND, broken: 0 });
    expect(game.results).toHaveLength(EGGS_PER_ROUND);
    expect(game.score).toBe(1);
  });

  it('хто стоїть на місці, ловить лише з одного жолоба, решта б\'ється — а яєць однаково 20', () => {
    const game = new EggsGame(ctx('idle'));
    game.pose = 'dl';
    for (let k = 0; k < 60 * 200 && !game.done; k += 1) game.update(DT);
    expect(game.done).toBe(true);
    expect(game.caught + game.broken).toBe(EGGS_PER_ROUND);
    expect(game.broken).toBeGreaterThan(0);
    expect(game.results.filter((r) => r === 'broken')).toHaveLength(game.broken);
  });

  it('дотик ліворуч чи праворуч від Лєни, вище чи нижче її пояса — кошик туди', () => {
    for (const kit of [phone, desk]) {
      const game = new EggsGame(ctx('tap'));
      const sc = game.sceneFor(kit);
      game.tap(10, sc.split - 5, kit);
      expect(game.pose).toBe('ul');
      game.tap(10, sc.split + 5, kit);
      expect(game.pose).toBe('dl');
      game.tap(kit.W - 10, sc.split - 5, kit);
      expect(game.pose).toBe('ur');
      game.tap(kit.W - 10, sc.split + 5, kit);
      expect(game.pose).toBe('dr');
    }
  });

  it('кінець кожного жолоба — над кошиком у позі, що його ловить', () => {
    for (const lena of [LENA_KID, LENA_ADULT]) {
      for (const kit of [phone, desk]) {
        const game = new EggsGame(ctx('geo', lena));
        const sc = game.sceneFor(kit);
        CHUTES.forEach((pose, c) => {
          const b = basketAt(lena, sc.lx, sc.floor + 1, pose, sc.z);
          const ch = sc.chutes[c]!;
          expect(Math.abs(ch.x1 - b.bx)).toBeLessThan(b.half);
          expect(ch.y1).toBeLessThan(b.by);
          // Жолоб іде згори вниз до Лєни й не виходить за екран.
          expect(ch.y0).toBeLessThan(ch.y1);
          expect(ch.y0).toBeGreaterThan(46);
          expect(Math.min(ch.x0, ch.x1)).toBeGreaterThanOrEqual(0);
          expect(Math.max(ch.x0, ch.x1)).toBeLessThanOrEqual(kit.W);
        });
      }
    }
  });
});

describe('рибалка', () => {
  /** Чекати, поки гра дійде до стану `state`. */
  function until(game: FishingGame, state: FishingGame['state']) {
    for (let k = 0; k < 60 * 10 && game.state !== state; k += 1) game.update(DT);
    expect(game.state).toBe(state);
  }

  it('смикнула зарано — риба злякалась; дочекалась клювання — є риба', () => {
    const game = new FishingGame(ctx('fish'));
    game.tap();
    until(game, 'wait');
    game.tap();
    expect(game.state).toBe('miss');
    expect(game.tally.missed).toBe(1);
    until(game, 'ready');
    game.tap();
    until(game, 'bite');
    game.tap();
    expect(game.state).toBe('reveal');
    expect(game.last).not.toBeNull();
    expect(game.tally[game.last!]).toBe(1);
  });

  it('проґавила клювання — зірвалась', () => {
    const game = new FishingGame(ctx('late'));
    game.tap();
    until(game, 'bite');
    for (let k = 0; k < Math.ceil((BITE_S + 0.1) * 60); k += 1) game.update(DT);
    expect(game.state).toBe('miss');
    expect(game.tally.missed).toBe(1);
  });

  it(`${CASTS} закидів — і рибалка скінчилась; оцінка — частка спійманого`, () => {
    const game = new FishingGame(ctx('all'));
    for (let k = 0; k < 60 * 120 && !game.done; k += 1) {
      if (game.state === 'ready' || game.state === 'bite') game.tap();
      game.update(DT);
    }
    expect(game.done).toBe(true);
    expect(game.casts).toBe(CASTS);
    const got = (game.tally.karas ?? 0) + (game.tally.okun ?? 0) + (game.tally.korop ?? 0);
    expect(got).toBe(CASTS);
    expect(game.score).toBe(1);
  });
});

describe('город', () => {
  it('кріт — по голові, бур\'ян — геть, достигле — у кошик, зелене — не чіпати', () => {
    const game = new GardenGame(ctx('garden'));
    const p = game.plots[0]!;
    p.mole = 1;
    game.tapPlot(0);
    expect(game.tally.moles).toBe(1);
    expect(p.mole).toBe(0);
    p.weed = 2;
    game.tapPlot(0);
    expect(game.tally.weeds).toBe(1);
    expect(p.weed).toBe(0);
    p.stage = 3;
    game.tapPlot(0);
    expect(game.tally[p.crop]).toBe(1);
    expect(p.stage).toBe(0);
    p.stage = 2;
    game.tapPlot(0);
    expect(Object.values(game.tally).reduce((s, v) => s + v, 0)).toBe(3);
  });

  it('кріт, якого не прогнали, підгризає ділянку', () => {
    const game = new GardenGame(ctx('mole'));
    const p = game.plots[3]!;
    p.stage = 3;
    p.mole = 0.2;
    for (let k = 0; k < 30; k += 1) game.update(DT);
    expect(p.stage).toBe(0);
  });

  it('п\'ять культур по три кущі; грядка — одна культура і стоячи, і лежачи', () => {
    const game = new GardenGame(ctx('layout'));
    expect(game.plots).toHaveLength(GARDEN_PLOTS);
    expect(new Set(game.plots.map((p) => p.crop))).toEqual(new Set(CROPS));
    // Стоячи (телефон): ряд — одна культура.
    for (let r = 0; r < CROPS.length; r += 1) {
      expect(new Set([0, 1, 2].map((c) => game.plots[game.plotAt(c, r, true)]!.crop))).toEqual(new Set([CROPS[r]]));
    }
    // Лежачи (комп'ютер): стовпець — одна культура.
    for (let c = 0; c < CROPS.length; c += 1) {
      expect(new Set([0, 1, 2].map((r) => game.plots[game.plotAt(c, r, false)]!.crop))).toEqual(new Set([CROPS[c]]));
    }
  });

  it(`город триває ${GARDEN_S} с і закінчується з підсумком`, () => {
    const game = new GardenGame(ctx('end'));
    for (let k = 0; k < (GARDEN_S + 1) * 60 && !game.done; k += 1) game.update(DT);
    expect(game.done).toBe(true);
    expect(game.summary[0]).toMatch(/^Урожаю: \d+$/);
  });
});
