import { describe, expect, it } from 'vitest';
import { cellHash } from '../world/hash';
import { cityMap, homeYard } from '../world/maps';
import { TILE, type Ground } from '../world/types';
import { STYLES } from './buildings';
import { BRICK_TONES, PANEL_TONES, PLANK_TONES, SHINGLE_TONES } from './buildingsHd';
import { PALETTES } from './palette';
import { hexToRgb, NEAR_DUPLICATE, setDensity, shade } from './pixel';
import { fenceGoesDown, rutAt } from './tiles';
import { lawnField, lawnFieldGrid, lawnHd, lawnLevel } from './tilesHd';

// Власник 2026-10-12: «Переглянь текстури всього подвір'я, покращ їх в
// 32х32» (ADR-0239). Тут — те, що не видно з одного кадру: латки трави
// тягнуться через кілька клітинок, трава не лізе на стежку й город, а тони
// дощок і черепиці не зникають, коли будівля зливає близькі кольори.

const LAWN: ReadonlySet<Ground | undefined> = new Set<Ground | undefined>(['g', 'G', 'F']);

/** Контекст 32×32, що записує кожен прямокутник. */
function recorder(): { g: CanvasRenderingContext2D; rects: { x: number; y: number; w: number; h: number }[] } {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const g = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h }) } as unknown as CanvasRenderingContext2D;
  setDensity(g, 2);
  return { g, rects };
}

describe('Трава подвір\'я в 32×32', () => {
  // Тінь (рівні 0–1), звичайна трава (2) і сонце (3–4) мають лягати
  // плямами: якби рівень випадав клітинкою навмання, без сусіда своєї групи
  // лишалася б кожна п'ята клітинка.
  it('латки — суцільні плями на кілька клітинок, а не шум клітинками; є і тінь, і сонце', () => {
    const yard = homeYard();
    const level = (i: number, j: number) => lawnLevel(lawnField(i + 0.5, j + 0.5));
    const group = (lv: number) => Math.sign(lv - 2);
    let tiles = 0;
    let lonely = 0;
    const counts = [0, 0, 0, 0, 0];
    for (let j = 0; j < yard.h; j += 1) {
      for (let i = 0; i < yard.w; i += 1) {
        if (!LAWN.has(yard.ground[j]![i])) continue;
        tiles += 1;
        const lv = level(i, j);
        counts[lv]! += 1;
        const twin = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([di, dj]) => LAWN.has(yard.ground[j + dj]?.[i + di]) && group(level(i + di, j + dj)) === group(lv));
        if (!twin) lonely += 1;
      }
    }
    expect(lonely / tiles, `клітинок без сусіда своєї групи: ${lonely} з ${tiles}`).toBeLessThan(0.05);
    const shadeShare = (counts[0]! + counts[1]!) / tiles;
    const sunShare = (counts[3]! + counts[4]!) / tiles;
    expect(shadeShare).toBeGreaterThan(0.12);
    expect(shadeShare).toBeLessThan(0.45);
    expect(sunShare).toBeGreaterThan(0.12);
    expect(sunShare).toBeLessThan(0.45);
  });

  it('поле латок для пікселів і для клітинок — те саме (кущики густіші саме там, де тінь)', () => {
    const grid = lawnFieldGrid(40, 34, 9);
    for (let k = 0; k < 300; k += 1) {
      const fx = (cellHash(k, 1, 5) % 3990) / 100;
      const fy = (cellHash(k, 2, 5) % 3390) / 100;
      expect(grid(fx, fy)).toBeCloseTo(lawnField(fx, fy, 9), 12);
    }
  });

  it.each([
    ...(['spring', 'summer', 'autumn', 'winter'] as const).map((season) => ['подвір\'я', season] as const),
    ...(['summer', 'winter'] as const).map((season) => ['село', season] as const),
  ])('%s, %s: латки, кущики, квіти й очерет не лізуть на стежку, дорогу, город, воду й під будівлі', (where, season) => {
    const yard = where === 'село' ? cityMap('zhylyntsi') : homeYard();
    const { g, rects } = recorder();
    lawnHd(g, yard, PALETTES[season]);
    expect(rects.length).toBeGreaterThan(1000);
    const off: string[] = [];
    for (const r of rects) {
      for (let j = Math.floor(r.y / TILE); j <= Math.floor((r.y + r.h - 1e-6) / TILE); j += 1) {
        for (let i = Math.floor(r.x / TILE); i <= Math.floor((r.x + r.w - 1e-6) / TILE); i += 1) {
          if (!LAWN.has(yard.ground[j]?.[i])) off.push(`${r.x},${r.y} ${r.w}×${r.h} на ${yard.ground[j]?.[i]} (${i},${j})`);
        }
      }
    }
    expect(off.slice(0, 5)).toEqual([]);
  });
});

describe('Будівлі подвір\'я в 32×32', () => {
  // `disciplinePalette` зливає кольори, ближчі за NEAR_DUPLICATE: тон дошки
  // чи черепиці, що ближчий до основного, мовчки стає основним.
  it('тони дощок, черепиць і листів бляхи не зливаються з основним кольором', () => {
    const far = (a: string, b: string) => {
      const [r1, g1, b1] = hexToRgb(a);
      const [r2, g2, b2] = hexToRgb(b);
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2) >= NEAR_DUPLICATE;
    };
    const checked: string[] = [];
    for (const b of [...homeYard().buildings, ...cityMap('zhylyntsi').buildings]) {
      const rule = STYLES[b.style];
      const wall = b.wall ?? rule.wall;
      const roof = b.roof ?? rule.roofColor;
      if (rule.material === 'wood') for (const t of PLANK_TONES) { expect(far(shade(wall, t), wall), `${b.id}: дошка ${t}`).toBe(true); checked.push(`${b.id} стіна`); }
      if (rule.material === 'brick') for (const t of BRICK_TONES) { expect(far(shade(wall, t), wall), `${b.id}: цеглина ${t}`).toBe(true); checked.push(`${b.id} цегла`); }
      if (rule.roof === 'tile') for (const t of SHINGLE_TONES) { expect(far(shade(roof, t), roof), `${b.id}: черепиця ${t}`).toBe(true); checked.push(`${b.id} черепиця`); }
      if (rule.roof === 'metal') for (const t of PANEL_TONES) { expect(far(shade(roof, t), roof), `${b.id}: бляха ${t}`).toBe(true); checked.push(`${b.id} бляха`); }
    }
    expect(checked.length).toBeGreaterThan(10);
    expect(checked.filter((c) => c.endsWith('цегла')).length, 'школа й сільмаг').toBeGreaterThanOrEqual(4);
  });
});

// Власник 2026-10-12: «перейдемо до Жилинців аналогічно» — село в 32×32.
describe('Село Жилинці в 32×32', () => {
  it('колії — лише на вулицях завширшки дві клітинки: не на перехресті, не на стежці й не на майданчику', () => {
    const v = cityMap('zhylyntsi');
    expect(rutAt(v, 5, 14)).toEqual({ axis: 'h', inner: 'bottom' });
    expect(rutAt(v, 5, 15)).toEqual({ axis: 'h', inner: 'top' });
    expect(rutAt(v, 30, 25)).toEqual({ axis: 'h', inner: 'top' });
    expect(rutAt(v, 20, 5)).toEqual({ axis: 'v', inner: 'right' });
    expect(rutAt(v, 21, 5)).toEqual({ axis: 'v', inner: 'left' });
    for (const [i, j] of [[20, 14], [21, 15], [20, 24]] as const) expect(rutAt(v, i, j), `перехрестя ${i},${j}`).toBeNull();
    for (const [i, j] of [[7, 12], [27, 10], [32, 8]] as const) expect(rutAt(v, i, j), `стежка ${i},${j}`).toBeNull();
    for (let j = 7; j < 13; j += 1) for (let i = 33; i < 41; i += 1) expect(rutAt(v, i, j), `майданчик ${i},${j}`).toBeNull();
    // Уздовж вулиці колії всюди, крім перехресть і місць, де до неї виходить стежка.
    let along = 0;
    let ruts = 0;
    for (let i = 0; i < v.w; i += 1) for (const j of [14, 15]) { if (v.ground[j]![i] !== 'd') continue; along += 1; if (rutAt(v, i, j)) ruts += 1; }
    expect(ruts / along).toBeGreaterThan(0.75);
  });

  it('паркан обабіч рідної хати йде згори вниз, ряд перед хатою — вбік; на подвір\'ї згори вниз ідуть краї ліворуч і праворуч', () => {
    const v = cityMap('zhylyntsi');
    for (let j = 6; j < 13; j += 1) {
      expect(fenceGoesDown(v, 2, j), `2,${j}`).toBe(true);
      expect(fenceGoesDown(v, 12, j), `12,${j}`).toBe(true);
    }
    for (const i of [2, 3, 5, 9, 11, 12]) expect(fenceGoesDown(v, i, 13), `${i},13`).toBe(false);
    const yard = homeYard();
    expect(fenceGoesDown(yard, 0, 10)).toBe(true);
    expect(fenceGoesDown(yard, yard.w - 1, 10)).toBe(true);
    expect(fenceGoesDown(yard, 10, 0)).toBe(false);
  });
});
