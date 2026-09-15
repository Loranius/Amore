import { describe, expect, it } from 'vitest';
import { buildReefSeabed } from './reefSeabed';

const SCALE = 1.7;
const RADIUS = SCALE * 13;

function seabed(): ReturnType<typeof buildReefSeabed> {
  return buildReefSeabed(SCALE, RADIUS);
}

describe('дно взагалі видно', () => {
  it('усі грані дивляться ВГОРУ, а не вниз', () => {
    /*
     * ЦЕЙ ТЕСТ ІСНУЄ ЧЕРЕЗ ВАДУ, ЯКОЇ НЕ БУЛО ВИДНО НІДЕ.
     *
     * Перша редакція мала обхід (low, high, low+next) — і дна не було в
     * кадрі ЗОВСІМ. Помітили не оком: вимірювання яскравості показало,
     * що сцена потемніла на 38%, а два кроки бісекції дали однакове
     * число з дном і без нього. Дно малювалось, але відсікалось як
     * зворотний бік.
     *
     * Нормалі У ВЕРШИНАХ при цьому дивились угору — саме тому ані
     * освітлення, ані будь-яка перевірка нормалей нічого не показала б.
     * Відсікання дивиться на ОБХІД, і перевіряти треба його.
     */
    const { geometry } = seabed();
    const positions = geometry.getAttribute('position').array;
    const indices = geometry.getIndex()!.array;
    let downward = 0;
    for (let at = 0; at < indices.length; at += 3) {
      const a = indices[at]!; const b = indices[at + 1]!; const c = indices[at + 2]!;
      const ax = positions[a * 3]!; const az = positions[a * 3 + 2]!;
      const bx = positions[b * 3]!; const bz = positions[b * 3 + 2]!;
      const cx = positions[c * 3]!; const cz = positions[c * 3 + 2]!;
      // Знак площі в площині XZ і є напрямом обходу згори.
      const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (area > 1e-9) downward += 1;
    }
    expect(downward, 'грані дна дивляться вниз — його не буде видно').toBe(0);
    expect(indices.length / 3).toBeGreaterThan(1000);
  });
});

describe('дно має рельєф і розчиняється у воді', () => {
  it('пісок не плаский', () => {
    const { geometry, lowest } = seabed();
    const positions = geometry.getAttribute('position').array;
    let highest = -Infinity;
    for (let at = 1; at < positions.length; at += 3) highest = Math.max(highest, positions[at]!);
    // Рельєф має бути помітним геометрично: хвиля на два градуси нахилу
    // не дає тіні, а отже й не існує.
    expect(highest - lowest).toBeGreaterThan(SCALE * 0.1);
    expect(Number.isFinite(lowest)).toBe(true);
    expect(lowest).toBeLessThan(0);
  });

  it('у вершинах лишився ТІЛЬКИ тон дюн — серпанок переїхав у піксель', () => {
    /*
     * **СЕМАНТИЧНА ЗМІНА (ADR-0195, крок 6).** Доти тут перевірялось, що
     * край дна згасає в нуль У ВЕРШИНАХ. Саме там згасання й було вадою:
     * сітка радіальна з `RADIAL_BIAS`, тож у зоні найкрутішого згасання
     * кільця стоять найрідше — і плавна величина, покладена в такі
     * вершини, інтерполювалась великими трикутниками в **бліду
     * багатокутну терасу навколо рифа**. Вона видна на кадрах від першого
     * дня цієї роботи.
     *
     * Сама вимога не змінилась: дно ОДНАКОВО мусить згасати у воду,
     * інакше каустика вдалині зробить білу стіну. Змінилось місце — тепер
     * це рахує піксель (`applyReefHaze`), а межі експортує цей же модуль,
     * щоб пісок і каустика не розійшлись.
     *
     * Тому тут перевіряється те, що лишилось у вершинах: тон дюн, і
     * НІЧОГО, що залежить від відстані. Якби серпанок тихо повернувся,
     * далекі вершини знову стали б темнішими за ближні.
     */
    const { geometry } = seabed();
    const positions = geometry.getAttribute('position').array;
    const colours = geometry.getAttribute('color').array;
    let near = 0; let nearCount = 0;
    let far = 0; let farCount = 0;
    for (let index = 0; index < colours.length / 3; index += 1) {
      const away = Math.hypot(positions[index * 3]!, positions[index * 3 + 2]!) / RADIUS;
      if (away < 0.05) { near += colours[index * 3]!; nearCount += 1; }
      if (away > 0.9) { far += colours[index * 3]!; farCount += 1; }
    }
    expect(nearCount, 'вершин під рифом').toBeGreaterThan(0);
    expect(farCount, 'вершин на краю').toBeGreaterThan(0);
    // Тон дюн гуляє навколо 0.95; від відстані він не залежить ніяк.
    expect(far / farCount).toBeCloseTo(near / nearCount, 1);
  });

  it('розгортка є — інакше каустиці нема на що лягти', () => {
    const { geometry } = seabed();
    const uv = geometry.getAttribute('uv');
    expect(uv).toBeDefined();
    expect(uv.count).toBe(geometry.getAttribute('position').count);
  });

  it('сітка згущується до центру', () => {
    // Дно тягнеться на тринадцять радіусів каменя, а роздивляються з
    // нього перші два. Рівномірна сітка витратила б дев'ять десятих
    // вершин туди, де самий туман.
    const { geometry } = seabed();
    const positions = geometry.getAttribute('position').array;
    let inner = 0; let outer = 0;
    for (let index = 0; index < positions.length / 3; index += 1) {
      const away = Math.hypot(positions[index * 3]!, positions[index * 3 + 2]!) / RADIUS;
      if (away < 0.25) inner += 1; else outer += 1;
    }
    expect(inner).toBeGreaterThan(outer * 0.9);
  });
});
