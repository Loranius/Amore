import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Запобіжник модуля «Плани».
// ------------------------------------------------------------
// Ці перевірки стережуть не вигляд, а те, ЩО ЙОГО ЗЛАМАЛО. Обидві написані
// за фактом, а не про запас:
//
// 1. Стиль модуля розповзся на вісім файлів. `plansCrystalRefresh.css` і шість
//    `plansReference*.css` підключались окремими рядками в `main.tsx`, і ШІСТЬ
//    із них оголошували той самий `.pm-tile::after`. Через це кристалик у
//    кутку картки неможливо було прибрати: перемагав той файл, чий імпорт
//    стояв нижче, і жодна правка не знала, який саме.
//
// 2. «Кристальний шлях» власник попросив прибрати «взагалі». Приховати його
//    стилем — не те саме, що видалити: наступний шар стилю поверне його
//    без жодної зміни в розмітці.
// ============================================================

const PLANS_DIR = join(__dirname);
const SRC_DIR = join(__dirname, '../..');

const stylesheets = readdirSync(PLANS_DIR).filter((name) => name.endsWith('.css'));

/** Усі файли модуля, крім самого стилю поверхні. */
const others = stylesheets.filter((name) => name !== 'plansModule.css');

function read(name: string): string {
  return readFileSync(join(PLANS_DIR, name), 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe('стиль модуля живе в одному файлі', () => {
  it('поверхню модуля описує лише plansModule.css', () => {
    // `.pm-*` — класи поверхні модуля. Якщо їх оголошує ще якийсь файл, шари
    // почались наново, і наступний «просто прибери кристалик» знову впреться
    // в питання «а котрий із них виграє».
    for (const name of others) {
      const selectors = [...read(name).matchAll(/\.pm-[a-z-]+/g)].map((m) => m[0]);
      expect(selectors, `${name} описує поверхню модуля`).toEqual([]);
    }
  });

  it('кожен селектор картки оголошений один раз', () => {
    const css = read('plansModule.css');
    for (const selector of ['.pm-tile::after', '.pm-tile::before']) {
      // `split` рахує ВХОДЖЕННЯ, а коментар угорі файлу згадує селектор
      // текстом — тому рахуємо лише ті, за якими йде блок оголошень.
      const declarations = [...css.matchAll(
        new RegExp(`${selector.replace(/[.:]/g, '\\$&')}\\s*(,[^{]*)?\\{`, 'g'),
      )];
      expect(declarations.length, `${selector} оголошено ${declarations.length} разів`)
        .toBeLessThanOrEqual(1);
    }
  });

  it('стиль планів не підключається глобально', () => {
    // Саме глобальний імпорт і дозволив шарам накопичитись: файл, підключений
    // у `main.tsx`, діє скрізь і не належить жодному модулю.
    const main = readFileSync(join(SRC_DIR, 'main.tsx'), 'utf8')
      .replace(/\/\/[^\n]*/g, '');
    expect(main).not.toMatch(/import\s+'@\/features\/plans\//);
  });
});

describe('«Кристальний шлях» видалено, а не приховано', () => {
  it('ніде в src немає його розмітки, стилю чи підпису', () => {
    const guilty: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const text = readFileSync(file, 'utf8');
      // Сам цей файл описує вимогу словами — його й пропускаємо.
      if (file.endsWith('plansModule.test.ts')) continue;
      if (/pm-crystal-path|CrystalPathProgress|КРИСТАЛЬНИЙ ШЛЯХ/.test(text)) {
        guilty.push(file.slice(SRC_DIR.length + 1));
      }
    }
    expect(guilty).toEqual([]);
  });
});

describe('колода задумів не накриває власний лічильник (ADR-0207)', () => {
  /*
   * ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО. Нижні картки колоди мали
   * `block-size: 100%`, і сотий відсоток міряв УСЮ секцію разом із
   * підписом «1 з 5» під нею. Тло колоди лягало поверх лічильника, і той
   * зникав. Знайшов це живий знімок, не типізація й не тест.
   *
   * Лікується двома речами разом, тому й стережуться обидві: стос дістає
   * власну систему координат, а тло міряється `inset: 0`, тобто рівно
   * передньою карткою.
   */
  const css = read('plansFocus.css');
  const deck = readFileSync(join(PLANS_DIR, 'PlanIdeaDeck.tsx'), 'utf8');

  it('стос має власну обгортку в розмітці', () => {
    expect(deck).toContain('className="pf-deck-stack"');
  });

  it('обгортка створює систему координат', () => {
    expect(css).toMatch(/\.pf-deck-stack\s*\{[^}]*position:\s*relative/);
  });

  it('тло колоди міряється передньою карткою, а не секцією', () => {
    const rule = css.slice(css.indexOf('.pf-card--behind'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('inset: 0');
    // Саме це поєднання і було вадою: висота у відсотках від секції.
    expect(body).not.toMatch(/block-size:\s*100%/);
  });

  it('сторож справді дивиться в потрібне місце', () => {
    // Без цього три зелені перевірки вище нічого не доводять: якби
    // `read` повертав порожнє, вони б не впали лише на `not.toMatch`.
    expect(css.length).toBeGreaterThan(500);
    expect(css).toContain('.pf-card--behind');
  });
});
