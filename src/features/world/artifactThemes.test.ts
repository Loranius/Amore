import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Три світи × дві теми — шість палітр, один поріг.
// ------------------------------------------------------------
// `worldTheme.css` обіцяв це від початку: ролі названі `--world-*`, «бо
// далі прийдуть Дерево й Риф, і той самий інтерфейс має обслуговувати їх,
// змінивши значення, а не імена». Перевірка тримає обидві половини
// обіцянки — що імена справді ті самі, і що нові значення читаються.
//
// Пороги ті самі, що в `accentContrast.test.ts` для кристала. Вони не
// про смак: 4.5:1 — AA для тексту 12–13 px, яким підписані кнопки
// порталу, 3:1 — межа елемента інтерфейсу.
// ============================================================

const ROOT = join(__dirname, '../../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
/** Без коментарів: вони цитують значення, які пояснюють, і збивають пошук. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));

const INDEX = bare(read('src/index.css'));
const WORLD = bare(read('src/features/world/worldTheme.css'));
const ARTIFACT = bare(read('src/features/world/artifactThemes.css'));

/** Тіло одного блоку — від селектора до `\n}` на початку рядка. */
function block(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`блоку ${selector} немає`);
  const end = css.indexOf('\n}', at);
  if (end === -1) throw new Error(`блок ${selector} не закритий`);
  return css.slice(at, end);
}

/*
 * Кристал зібраний із ДВОХ файлів, і це не недогляд, а те, що новий шар
 * саме й виправляє для решти світів. `index.css` тримає токени сторінки,
 * `worldTheme.css` — токени світу, і `worldTheme.css` сам попереджає, що
 * вони «мусять мінятись РАЗОМ». У дерева й рифа обидві родини лежать в
 * одному блоці, тож забути половину ніде.
 */
const PALETTES = {
  'кристал · темна': [block(INDEX, ':root {'), block(WORLD, ':root {')].join('\n'),
  'кристал · світла': [
    block(INDEX, "[data-theme='light'] {"),
    block(WORLD, "[data-theme='light'] {"),
  ].join('\n'),
  'дерево · темна': block(ARTIFACT, "html[data-artifact='tree'] {"),
  'дерево · світла': block(ARTIFACT, "html[data-theme='light'][data-artifact='tree'] {"),
  'риф · темна': block(ARTIFACT, "html[data-artifact='reef'] {"),
  'риф · світла': block(ARTIFACT, "html[data-theme='light'][data-artifact='reef'] {"),
} as const;

type Palette = keyof typeof PALETTES;

/** Ролі, без яких палітра неповна: кожна з них десь несе текст. */
const REQUIRED = [
  '--bg',
  '--surface',
  '--text',
  '--muted',
  '--accent',
  '--accent-strong',
  '--world-bg',
  '--world-text',
  '--world-text-muted',
  '--world-primary',
  '--world-accent',
  '--world-warm',
] as const;

function token(name: string, palette: Palette): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(PALETTES[palette]);
  if (!match) throw new Error(`токена ${name} немає в палітрі «${palette}»`);
  return match[1]!.toLowerCase();
}

/** Відносна яскравість за WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [0, 2, 4]
    .map((offset) => parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

const NAMES = Object.keys(PALETTES) as Palette[];

describe('кожен світ має повну палітру, а не косметичну добавку', () => {
  it.each(NAMES)('%s оголошує кожну роль, яка несе текст', (palette) => {
    for (const role of REQUIRED) {
      expect(() => token(role, palette), `${palette}: ${role}`).not.toThrow();
    }
  });

  it.each(NAMES)('%s: основний і приглушений текст читаються на ґрунті', (palette) => {
    expect(contrast(token('--text', palette), token('--bg', palette))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--muted', palette), token('--bg', palette))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAMES)('%s: текст читається і на картці, не лише на ґрунті', (palette) => {
    /*
     * Поверхня світліша за ґрунт у темних темах і темніша у світлих, тож
     * пройти на одному й провалитись на другому — цілком можливо. Саме
     * на картці лежить майже весь текст порталу.
     */
    expect(contrast(token('--text', palette), token('--surface', palette))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--muted', palette), token('--surface', palette))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAMES)('%s: лінійний акцент читається як текст', (palette) => {
    expect(contrast(token('--accent', palette), token('--bg', palette))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--accent', palette), token('--surface', palette))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAMES)('%s: заливка тримає білий текст і лишається видимою', (palette) => {
    expect(contrast('#ffffff', token('--accent-strong', palette))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--accent-strong', palette), token('--bg', palette))).toBeGreaterThanOrEqual(3);
  });

  it.each(NAMES)('%s: ролі акценту не переставлені місцями', (palette) => {
    /*
     * Правило, що працює в обох темах: `--accent` контрастує з ґрунтом
     * КРАЩЕ за `--accent-strong`, бо саме він призначений бути на ньому
     * текстом. «Світліший» правилом бути не може — у світлій темі все
     * навпаки.
     */
    const line = contrast(token('--accent', palette), token('--bg', palette));
    const fill = contrast(token('--accent-strong', palette), token('--bg', palette));
    expect(line).toBeGreaterThan(fill);
    expect(token('--accent', palette)).not.toBe(token('--accent-strong', palette));
  });

  it.each(NAMES)('%s: чорнило світу збігається з чорнилом сторінки', (palette) => {
    /*
     * Дві родини токенів (`--text`/`--muted` і `--world-text*`) описують
     * одне й те саме чорнило для двох різних споживачів: половина порталу
     * читає одну, половина другу. `worldTheme.css` попереджає, що вони
     * «мусять мінятись РАЗОМ» — тут це перевіряється, а не мається на увазі.
     */
    expect(token('--world-text', palette)).toBe(token('--text', palette));
    expect(token('--world-text-muted', palette)).toBe(token('--muted', palette));
  });
});

describe('кожен світ лишається одним світом', () => {
  it.each(NAMES)('%s тримає рівно один теплий тон', (palette) => {
    // §8 брифу: один теплий акцент, зарезервований за тим, що стосується
    // самих стосунків. Два зробили б палітру градієнтом настроїв.
    const warm = [...PALETTES[palette].matchAll(/(--[a-z-]*(?:warm|rose)[a-z-]*)\s*:/g)]
      .map((match) => match[1]!);
    expect(warm).toEqual(['--world-warm']);
  });

  it('жоден блок артефакта не вигадує нового імені', () => {
    /*
     * Уся суть шару: значення нові, ролі — ті самі. Ім'я, яке існує лише
     * в дереві, означало б, що дерево не тема, а другий портал.
     */
    const known = new Set(
      [...`${INDEX}\n${WORLD}`.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]!),
    );
    const invented = [...ARTIFACT.matchAll(/^\s{2}(--[a-z0-9-]+)\s*:/gm)]
      .map((match) => match[1]!)
      .filter((name) => !known.has(name));
    expect([...new Set(invented)]).toEqual([]);
  });
});

describe('світла тема світу не успадковує темну мовчки', () => {
  /*
   * Пастка, закладена самою специфічністю: `html[data-artifact='tree']`
   * — це (0,1,1), а `[data-theme='light']` — (0,1,0). Тобто ТЕМНИЙ блок
   * світу виграє в світлої теми порталу. Будь-який токен, оголошений у
   * темному блоці й забутий у світлому, тихо лишиться темним на світлому
   * екрані — і виглядатиме не як помилка, а як дивний колір.
   *
   * Це не гіпотеза: рівно так число днів над деревом лишалось рожевим із
   * кристалічної теми, поки чорнило сцени не оголосили явно в обох.
   */
  const PAIRS = [
    ['дерево', "html[data-artifact='tree'] {", "html[data-theme='light'][data-artifact='tree'] {"],
    ['риф', "html[data-artifact='reef'] {", "html[data-theme='light'][data-artifact='reef'] {"],
  ] as const;

  const declared = (selector: string): Set<string> =>
    new Set([...block(ARTIFACT, selector).matchAll(/^\s{2}(--[a-z0-9-]+)\s*:/gm)]
      .map((match) => match[1]!));

  it.each(PAIRS)('%s: світлий блок перекриває кожен токен темного', (_name, dark, light) => {
    const missing = [...declared(dark)].filter((token) => !declared(light).has(token));
    expect(missing).toEqual([]);
  });
});

describe('шар вмикається специфічністю, а не порядком', () => {
  it('селектори компаундні — обидва атрибути на одному <html>', () => {
    /*
     * Пробіл між ними («нащадок») не збігся б ніколи й мовчки: CSS не дає
     * помилки, правило просто не діє. Цю пастку в проєкті вже ловили
     * (`rootAttributeSelectors.test.ts`), і вона коштувала прозорого дока
     * на семи маршрутах.
     */
    expect(ARTIFACT).not.toMatch(/\[data-theme='light'\]\s+\[data-artifact/);
    expect(ARTIFACT).not.toMatch(/\[data-artifact='[a-z]+'\]\s+\[data-theme/);
  });

  it('кожен блок починається з html — інакше він не б\'є :root', () => {
    // `[data-artifact='tree']` — це (0,1,0), рівно як `:root`. За рівної
    // специфічності вирішує порядок склеювання, тобто випадок.
    // Селектор — рядок, який ЗАКІНЧУЄТЬСЯ відкритою дужкою. Без прив'язки
    // до кінця рядка збіг починався з `}` попереднього блоку.
    const selectors = [...ARTIFACT.matchAll(/^([^{}\n]+?)\s*\{\s*$/gm)]
      .map((match) => match[1]!.trim())
      .filter((selector) => selector.length > 0);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector.startsWith('html['), selector).toBe(true);
    }
  });

  it('шар підключений після токенів порталу', () => {
    const MAIN = readFileSync(join(ROOT, 'src/main.tsx'), 'utf8');
    const portal = MAIN.indexOf("import '@/index.css'");
    const artifact = MAIN.indexOf("artifactThemes.css");
    expect(portal).toBeGreaterThan(-1);
    expect(artifact).toBeGreaterThan(portal);
  });
});
