import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Екран входу не має світлих островів.
// ------------------------------------------------------------
// **Виміряно обчисленими кольорами живої сторінки.** Картка входу була
// `rgba(255,255,255,0.86)` — біла, — а текст на ній брав `var(--text)`,
// тобто майже біле чорнило темної теми:
//
//   заголовок «Хто сьогодні заходить у портал?»  1.24:1  (треба 4.5)
//   кнопки з іменами «Діма» / «Лєна»             1.24:1  (треба 4.5)
//   надзаголовок AMORE                           2.41:1  (треба 4.5)
//
// Імена пари на екрані входу були фактично невидимі. Після переходу на
// токени — 16.41, 14.75 і 5.48 відповідно.
//
// Побачити це раніше було нічим: жива оснастка САМА проходила логін, тож
// єдиний екран, який пара бачить при кожному холодному старті, не
// знімався жодного разу. Тому в оснастки з'явився `--no-login`.
//
// Причина — половинчастий переїзд: фон екрана перевели на токени, а
// картку, кнопки й крапки PIN лишили з хардкодженим білим. Саме такі
// half-migrations цей тест і ловить: він не міряє контраст (для цього
// потрібен браузер), а стежить, щоб на поверхнях входу не було
// непрозорих світлих значень, під якими токен-чорнило зникає.
// ============================================================

const INDEX = readFileSync(join(__dirname, '../../index.css'), 'utf8');

/** Тіло правила за селектором, без коментарів. */
function ruleBody(selector: string): string {
  const source = INDEX.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = source.indexOf(`\n${selector} {`);
  expect(at, `правило ${selector} не знайдено`).toBeGreaterThan(-1);
  const open = source.indexOf('{', at);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

/** Світлий непрозорий колір: `#fff`, `#ffffff`, `rgb(255,255,255)`, `rgba(…, ≥0.5)`. */
function opaqueLightColours(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(/#([0-9a-f]{3,8})\b|rgba?\(([^)]*)\)/gi)) {
    if (match[1]) {
      const hex = match[1];
      const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
      if (Math.min(r!, g!, b!) > 200) found.push(match[0]);
      continue;
    }
    const nums = (match[2] ?? '').split(',').map((n) => Number(n.trim()));
    const [r, g, b] = nums;
    const alpha = nums.length > 3 ? nums[3]! : 1;
    if (r !== undefined && g !== undefined && b !== undefined
      && Math.min(r, g, b) > 200 && alpha >= 0.5) {
      found.push(match[0]);
    }
  }
  return found;
}

describe('поверхні екрана входу', () => {
  for (const selector of ['.auth-card', '.user-btn']) {
    it(`${selector} не має непрозорого світлого фону`, () => {
      expect(opaqueLightColours(ruleBody(selector))).toEqual([]);
    });

    it(`${selector} бере поверхню з токена`, () => {
      // Токен слідує за темою; хардкод — ні, і саме тому одна з двох тем
      // ламається мовчки.
      expect(ruleBody(selector)).toMatch(/background(-color)?:[^;]*var\(--/);
    });
  }

  it('крапки PIN видно на темній картці', () => {
    // Було `rgba(49,37,58,0.14)` — темне по світлому зі старої ери. На
    // темній картці пара не бачила, скільки цифр уже ввела.
    const body = ruleBody('.pin-dot');
    expect(body).toMatch(/var\(--text\)/);
    expect(body).not.toMatch(/rgba\(49,\s*37,\s*58/);
  });

  it('помилка PIN бере токен небезпеки, а не власний червоний', () => {
    expect(ruleBody('.pin-error')).toMatch(/var\(--danger\)/);
  });

  it('на картці входу немає розмиття (One Blur Rule)', () => {
    // Розмивається рівно одне — док.
    expect(ruleBody('.auth-card')).not.toMatch(/backdrop-filter/);
  });
});
