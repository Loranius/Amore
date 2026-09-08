import { describe, expect, it } from 'vitest';
import { artifactSpan, pixelHue } from './artifactSpan.mjs';

// ============================================================
// Мірка розміру артефакта на екрані.
// ------------------------------------------------------------
// Вона існує заради одного питання — «чи справді наблизилось» (ADR-0160), —
// і зламатись може тихо: віддати число замість `null` там, де артефакта в
// кадрі немає, або злічити разом із ним камінь острова. Обидва випадки
// виглядають як успіх.
// ============================================================

/** Полотно з прямокутниками заданого кольору на заданому тлі. */
function canvas(width, height, background, rects, colour) {
  const data = Buffer.alloc(width * height * 3);
  const boxes = Array.isArray(rects) ? rects : [rects];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = boxes.some((rect) => x >= rect.x && x < rect.x + rect.width
        && y >= rect.y && y < rect.y + rect.height);
      const [r, g, b] = inside ? colour : background;
      const at = (y * width + x) * 3;
      data[at] = r; data[at + 1] = g; data[at + 2] = b;
    }
  }
  return { width, height, channels: 3, data };
}

// Виміряні на живому кадрі порталу (`npm run live -- home`): кристал і
// камінь острова. Саме ці два кольори мірка мусить розрізняти.
const CRYSTAL = [179, 74, 161];
const ISLAND = [48, 36, 85];

describe('відтінок пікселя', () => {
  it('кладе кристал і камінь у різні смуги', () => {
    expect(Math.round(pixelHue(...CRYSTAL).hue)).toBe(310);
    expect(Math.round(pixelHue(...ISLAND).hue)).toBe(255);
    // Насиченість їх НЕ розділяє — заради цього факту мірка й дивиться на
    // відтінок.
    expect(Math.abs(pixelHue(...CRYSTAL).saturation - pixelHue(...ISLAND).saturation))
      .toBeLessThan(0.05);
  });

  it('лишає світлий обвід грані всередині тіла', () => {
    // Виміряно на живому кадрі: обвід має 0.16–0.30 насиченості. Поріг 0.3
    // різав саме його, тобто розрізав кристал на окремі грані — і мірка
    // звітувала про одну грань замість тіла.
    const EDGE = [188, 134, 171];
    expect(pixelHue(...EDGE).saturation).toBeLessThan(0.3);
    expect(artifactSpan(canvas(20, 20, ISLAND, { x: 5, y: 5, width: 4, height: 4 }, EDGE)))
      .not.toBeNull();
  });

  it('віддає нульову насиченість сірому, не ділячи на нуль', () => {
    expect(pixelHue(20, 20, 20)).toEqual({ hue: 0, saturation: 0, value: 20 });
  });
});

describe('розмір артефакта', () => {
  it('міряє прямокутник кристала й ігнорує камінь', () => {
    const image = canvas(100, 100, ISLAND, { x: 20, y: 30, width: 10, height: 40 }, CRYSTAL);
    const span = artifactSpan(image);
    expect(span).not.toBeNull();
    expect(span.left).toBe(20);
    expect(span.top).toBe(30);
    expect(span.width).toBe(10);
    expect(span.height).toBe(40);
    expect(span.pixels).toBe(400);
  });

  it('бере ТІЛО, а не рамку всього рожевого на екрані', () => {
    /*
     * Полотно порталу займає весь екран (виміряно: `canvas` — це
     * 0,0,412,915), тож обмежити пошук ним неможливо, а над ним лежить
     * інтерфейс. Емодзі-квітка у привітанні — 144 пікселі вгорі — піднімала
     * верхню межу на 538 і давала артефакт заввишки 1292 замість 754.
     */
    const image = canvas(100, 200, ISLAND, [
      { x: 40, y: 100, width: 20, height: 60 },
      { x: 5, y: 5, width: 4, height: 4 },
    ], CRYSTAL);
    const span = artifactSpan(image);
    expect(span.top).toBe(100);
    expect(span.height).toBe(60);
    expect(span.pixels).toBe(1200);
  });

  it('віддає null, коли артефакта в кадрі немає', () => {
    // Не нуль: «немає» і «нульової висоти» — різні відповіді, і перша
    // мусить зупинити того, хто читає число.
    expect(artifactSpan(canvas(40, 40, ISLAND, { x: 0, y: 0, width: 0, height: 0 }, CRYSTAL)))
      .toBeNull();
  });

  it('не виходить за межі, які їй дали', () => {
    // Акцент інтерфейсу має той самий відтінок, тож без межі мірка
    // звітувала б про артефакт заввишки в увесь екран.
    const image = canvas(100, 100, ISLAND, { x: 5, y: 5, width: 8, height: 8 }, CRYSTAL);
    expect(artifactSpan(image, { x: 40, y: 40, width: 40, height: 40 })).toBeNull();
    expect(artifactSpan(image, { x: 0, y: 0, width: 40, height: 40 }).pixels).toBe(64);
  });
});
