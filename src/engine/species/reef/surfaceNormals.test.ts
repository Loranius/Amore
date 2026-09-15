import { describe, expect, it } from 'vitest';
import { weldCreased } from './surfaceNormals';

/*
 * ЩО ЦЕЙ ФАЙЛ СТЕРЕЖЕ (ADR-0195, кроки 1–2).
 *
 * Твердість ребра переїхала з МАТЕРІАЛУ (`flatShading`) у ФОРМУ. Це заміна
 * прапорця на закон, тож перевіряється закон: куб лишається кубом, куля стає
 * кулею, і жодна вершина не втрачає напрямку — саме на цьому кулька й
 * камінець чорніли знизу, поки прапорець ховав вироджені нормалі.
 */

/** Куб одиничного розміру: шість граней, дванадцять трикутників. */
function cube(): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const corners: Array<[number, number, number]> = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ];
  for (const [x, y, z] of corners) positions.push(x, y, z);
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
    [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5],
  ];
  for (const [a, b, c, d] of quads) indices.push(a, b, c, a, c, d);
  return { positions, indices };
}

/** Півсфера кільцями — тіло, у якого справжніх зламів немає зовсім. */
function dome(rings: number, sides: number): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const phi = ((ring + 0.5) / rings) * (Math.PI / 2);
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      positions.push(
        Math.round(Math.cos(angle) * Math.cos(phi) * 1e6) / 1e6,
        Math.round(Math.sin(phi) * 1e6) / 1e6,
        Math.round(Math.sin(angle) * Math.cos(phi) * 1e6) / 1e6,
      );
    }
  }
  const apex = positions.length / 3;
  positions.push(0, 1, 0);
  for (let ring = 0; ring + 1 < rings; ring += 1) {
    const low = ring * sides;
    const high = low + sides;
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      // Намотка проти годинникової при погляді ЗЗОВНІ: нормаль мусить
      // дивитись назовні, і тест нижче це й перевіряє знаком.
      indices.push(low + side, high + side, low + next);
      indices.push(low + next, high + side, high + next);
    }
  }
  const top = (rings - 1) * sides;
  for (let side = 0; side < sides; side += 1) {
    indices.push(top + side, apex, top + ((side + 1) % sides));
  }
  return { positions, indices };
}

describe('нормалі з кутом зламу', () => {
  it('куб лишається кубом: у кожного кута три різні нормалі', () => {
    /*
     * Камінь ламається по площинах, і саме цим він відрізняється від
     * грудки. Якби зварювання не мало порога, у восьми кутів куба вийшло б
     * вісім нормалей, спрямованих із центра, — тобто м'яка подушка.
     */
    const { positions, indices } = cube();
    const welded = weldCreased(positions, indices, { creaseAngleDeg: 30 });
    expect(welded.positions.length / 3, 'вершин').toBe(24);
    for (let vertex = 0; vertex < 24; vertex += 1) {
      const n = welded.normals.slice(vertex * 3, vertex * 3 + 3);
      // Нормаль грані куба дивиться строго по осі: рівно одна одиниця.
      const axes = n.filter((value) => Math.abs(Math.abs(value) - 1) < 1e-6);
      expect(axes, `вершина ${vertex}: ${n.join(',')}`).toHaveLength(1);
    }
  });

  it('той самий куб при 180° стає подушкою — тобто поріг справді діє', () => {
    // Контроль до попереднього тесту: без порога закон інший, і це видно
    // числом вершин, а не на око.
    const { positions, indices } = cube();
    expect(weldCreased(positions, indices, { creaseAngleDeg: 180 }).positions.length / 3).toBe(8);
  });

  it('купол зварюється в гладке тіло без жодного розщеплення', () => {
    const { positions, indices } = dome(6, 16);
    const welded = weldCreased(positions, indices, { creaseAngleDeg: 30 });
    expect(welded.positions.length / 3, 'вершин').toBe(positions.length / 3);
    // На кулі нормаль вершини мусить збігатись із самою позицією.
    for (let vertex = 0; vertex < welded.positions.length / 3; vertex += 1) {
      const at = vertex * 3;
      const px = welded.positions[at]!;
      const py = welded.positions[at + 1]!;
      const pz = welded.positions[at + 2]!;
      const length = Math.hypot(px, py, pz);
      if (length < 1e-6) continue;
      const dot = (px * welded.normals[at]! + py * welded.normals[at + 1]!
        + pz * welded.normals[at + 2]!) / length;
      expect(dot, `вершина ${vertex}`).toBeGreaterThan(0.93);
    }
  });

  it('ЖОДНА нормаль не має нульової довжини', () => {
    /*
     * **РЕГРЕСІЯ ADR-0195 §1.2.** Кулька й камінець рахували нормаль як
     * `position / |position|`, а денце й маківка стоять у самому нулі. Поки
     * затінення було пласким, нормаль вершини не використовувалась зовсім;
     * щойно її ввімкнули, обидва тіла почорніли знизу.
     *
     * Тобто прапорець на матеріалі ХОВАВ ваду в даних. Тепер нормаль
     * виводиться з граней, і навіть у виродженої точки вона має напрямок.
     */
    const flat = {
      positions: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      indices: [0, 1, 2, 3, 2, 1],
    };
    for (const mesh of [cube(), dome(4, 8), flat]) {
      const welded = weldCreased(mesh.positions, mesh.indices, { creaseAngleDeg: 30 });
      for (let vertex = 0; vertex < welded.normals.length / 3; vertex += 1) {
        const at = vertex * 3;
        const length = Math.hypot(
          welded.normals[at]!, welded.normals[at + 1]!, welded.normals[at + 2]!,
        );
        expect(length, `вершина ${vertex}`).toBeCloseTo(1, 5);
      }
    }
  });

  it('двічі поспіль дає побайтово однаковий результат', () => {
    // Детермінізм: вершини виходять у порядку обходу трикутників, а не в
    // порядку хеш-таблиці.
    const { positions, indices } = dome(5, 9);
    const tint = Array.from({ length: positions.length / 3 }, (_v, at) => at / 10);
    const first = weldCreased(positions, indices, { creaseAngleDeg: 30, tint: tint });
    const second = weldCreased(positions, indices, { creaseAngleDeg: 30, tint: tint });
    expect(second).toEqual(first);
  });

  it('вершина, яка нікуди не розщепилась, лишається на СВОЄМУ місці', () => {
    /*
     * **РЕГРЕСІЯ ВЛАСНОЇ ПЕРШОЇ РЕДАКЦІЇ.** Вона видавала вершини в
     * порядку обходу таблиці точок, тож меш, у якому нічого не зварилось,
     * усе одно виходив переставленим. Від того посипались чужі тести —
     * кільця кульки, ціна колонії, пошук маківки, — і жоден із них не був
     * про нормалі.
     *
     * Перестановка вершин — це мовчазна зміна контракту меша, якого ніхто
     * не оголошував. Тому порядок стережеться числом.
     */
    const { positions, indices } = dome(5, 12);
    const welded = weldCreased(positions, indices, { creaseAngleDeg: 60 });
    expect(welded.positions).toEqual(positions);
    expect(welded.indices).toEqual(indices);
  });

  it('переносить тінт на зварені вершини', () => {
    const { positions, indices } = dome(4, 8);
    const tint = Array.from({ length: positions.length / 3 }, (_v, at) => (at % 2 === 0 ? 0.25 : 0.75));
    const welded = weldCreased(positions, indices, { creaseAngleDeg: 180, tint: tint });
    expect(welded.tint).toHaveLength(welded.positions.length / 3);
    for (const value of welded.tint!) {
      expect(value).toBeGreaterThanOrEqual(0.25);
      expect(value).toBeLessThanOrEqual(0.75);
    }
  });
});
