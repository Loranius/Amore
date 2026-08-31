import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';

// ============================================================
// Одинадцять категорій × чотири світи: чи всі вони взагалі видні.
// ------------------------------------------------------------
// Кольори категорій стояли числами в TypeScript, тож портал міг
// перевдягнутись у дерево чи риф, а плани лишались рожево-фіолетовими.
// Тепер це токени, і перевіряти треба дві речі: що кожен світ оголосив
// УСІ одинадцять (забутий токен мовчки лишиться кристалічним), і що нова
// гама читається на поверхні САМЕ ТОГО світу.
//
// Пороги взяті з чинної гами, а не з голови:
//
//   кристал на темній  найгірший контраст 3.87, найближча пара 0.142
//   кристал на світлій найгірший контраст 1.81 (!), найближча пара 0.142
//
// Світлий кристал — саме той випадок, коли підпис категорії видно лише
// тому, що знаєш, де він. Тому новим гамам поставлено 3.0 на світлому:
// нижче за 4.5 (AA для дрібного тексту), але вдвічі вище за те, що є.
// ============================================================

const ROOT = join(__dirname, '../../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
/** Без коментарів: вони цитують ті самі числа, які пояснюють. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));

const INDEX = bare(read('src/index.css'));
const ARTIFACT = bare(read('src/features/world/artifactThemes.css'));

function block(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`блоку ${selector} немає`);
  const end = css.indexOf('\n}', at);
  return css.slice(at, end);
}

function palette(css: string, selector: string): Record<string, string> {
  const body = block(css, selector);
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/--plan-cat-([a-z]+)\s*:\s*(#[0-9a-f]{6})/g)) {
    out[match[1]!] = match[2]!;
  }
  return out;
}

const toRgb = (hex: string): [number, number, number] => [1, 3, 5]
  .map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];

function luminance(hex: string): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/**
 * Наскільки два кольори різні для ока — зважена відстань у sRGB.
 *
 * Не CIEDE2000: тут потрібне не точне число, а поріг «не злились», і він
 * узятий із гами, що вже стоїть у порталі.
 */
function separation(a: string, b: string): number {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2) / 255;
}

/** Світ, його блок і поверхня картки, на якій ця гама лежить. */
const WORLDS = [
  ['дерево, темна', ARTIFACT, "html[data-artifact='tree'] {", '#252320', 4],
  ['дерево, світла', ARTIFACT, "html[data-theme='light'][data-artifact='tree'] {", '#ffffff', 3],
  ['риф, темна', ARTIFACT, "html[data-artifact='reef'] {", '#101726', 4],
  ['риф, світла', ARTIFACT, "html[data-theme='light'][data-artifact='reef'] {", '#ffffff', 3],
] as const;

describe('гама категорій плану живе в кожному світі', () => {
  it('кристал оголошує всі одинадцять у :root', () => {
    const crystal = palette(INDEX, ':root {');
    expect(Object.keys(crystal).sort()).toEqual([...PLAN_CATEGORY_ORDER].sort());
  });

  it('жодна категорія не тримає колір числом у модулі', () => {
    /*
     * Саме число в `planConstants.ts` і робило плани сліпими до світу:
     * портал перевдягався цілком, а одинадцять шістнадцяткових значень
     * про це не знали.
     */
    for (const key of PLAN_CATEGORY_ORDER) {
      expect(PLAN_CATEGORIES[key].color, key).toBe(`var(--plan-cat-${key})`);
    }
  });

  it.each(WORLDS)('%s: оголошено всі одинадцять', (_name, css, selector) => {
    const world = palette(css, selector);
    const missing = PLAN_CATEGORY_ORDER.filter((key) => !(key in world));
    expect(missing).toEqual([]);
  });

  it.each(WORLDS)('%s: кожен колір видно на поверхні картки', (_name, css, selector, surface, floor) => {
    const world = palette(css, selector);
    for (const key of PLAN_CATEGORY_ORDER) {
      expect(contrast(world[key]!, surface), `${key} на ${surface}`).toBeGreaterThanOrEqual(floor);
    }
  });

  it.each(WORLDS)('%s: жодні дві категорії не злились', (_name, css, selector) => {
    const world = palette(css, selector);
    for (let i = 0; i < PLAN_CATEGORY_ORDER.length; i += 1) {
      for (let j = i + 1; j < PLAN_CATEGORY_ORDER.length; j += 1) {
        const a = PLAN_CATEGORY_ORDER[i]!;
        const b = PLAN_CATEGORY_ORDER[j]!;
        expect(separation(world[a]!, world[b]!), `${a}/${b}`).toBeGreaterThanOrEqual(0.142);
      }
    }
  });

  it('дерево не тримає жодного кольору малинової родини', () => {
    /*
     * Перша спроба лишила `date` цвітом (`#e8909f`), і на живому екрані
     * картка все одно читалась рожевою — тобто скарга власника не була
     * закрита, хоч число й змінилось. Відтінки 300-360° тут заборонені
     * прямо, щоб наступна «майже така сама» спроба впала тестом, а не
     * очима.
     */
    for (const selector of [
      "html[data-artifact='tree'] {",
      "html[data-theme='light'][data-artifact='tree'] {",
    ]) {
      const world = palette(ARTIFACT, selector);
      for (const key of PLAN_CATEGORY_ORDER) {
        const [r, g, b] = toRgb(world[key]!);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) continue;
        let hue = max === r
          ? (((g - b) / (max - min)) % 6)
          : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
        const magenta = hue > 300 && hue < 360;
        expect(magenta, `${key} ${world[key]} має відтінок ${hue.toFixed(0)}°`).toBe(false);
      }
    }
  });
});
