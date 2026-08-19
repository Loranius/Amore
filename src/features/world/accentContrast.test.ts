import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ============================================================
// Акцент має дві ролі, і плутати їх не можна.
// ------------------------------------------------------------
// Знайдено виміром, а не оком: білий текст на `--accent` (`#b06bff`) дає
// контраст **3.28:1** — нижче AA для звичайного тексту, — і так було в 25
// правилах по всьому порталу, від `.btn` до активного чипа. Побачити це
// неможливо: лавандова пігулка з білим підписом виглядає нормально, поки
// не поміряєш.
//
// Заміна не потребувала нового кольору — `--accent-strong` уже існував.
//
//   `--accent`        лінія, текст, сяйво.   5.90:1 на ґрунті
//   `--accent-strong` заливка під білим.     5.22:1 під білим
//
// Ці перевірки стережуть не відтінок (власник його змінюватиме), а те, що
// ролі лишились різними й що правило «світлий текст на плаский акцент» не
// повернулось у жоден CSS-файл.
// ============================================================

const ROOT = join(__dirname, '../../..');
const INDEX = readFileSync(join(ROOT, 'src/index.css'), 'utf8');

/**
 * Значення токена в межах одного блоку теми.
 *
 * Раніше тут стояв пошук по всьому файлу, і він брав ПЕРШЕ входження — поки
 * тема була одна, це працювало. Тем знову дві (ADR-0040), і пошук по файлу
 * означав би, що світла не перевіряється взагалі: усі числа нижче припадали
 * б на темну, а зламати можна саме світлу, бо в ній акцент мусить бути
 * ТЕМНІШИМ за заливку, а не світлішим.
 */
function block(selector: string): string {
  const at = INDEX.indexOf(selector);
  if (at === -1) throw new Error(`блоку ${selector} немає в index.css`);
  return INDEX.slice(at, INDEX.indexOf('\n}', at));
}

const THEMES = {
  dark: block(':root {'),
  light: block("[data-theme='light'] {"),
} as const;

function token(name: string, theme: keyof typeof THEMES = 'dark'): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(THEMES[theme]);
  if (!match) throw new Error(`токена ${name} немає в темі ${theme}`);
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

describe('ролі акценту розрізняються', () => {
  it('заливка під білим текстом проходить AA', () => {
    // 4.5:1 — поріг для звичайного тексту. Кнопки порталу мають підписи
    // 12–13 px, тобто послаблення для великого тексту тут не діє.
    expect(contrast('#ffffff', token('--accent-strong'))).toBeGreaterThanOrEqual(4.5);
  });

  it('та сама заливка лишається видимою на ґрунті', () => {
    // 3:1 — поріг для меж елемента інтерфейсу. Без цього кнопка зливалася б
    // із тлом, і виправлення контрасту тексту зіпсувало б форму.
    expect(contrast(token('--accent-strong'), token('--bg'))).toBeGreaterThanOrEqual(3);
  });

  it('лінійний акцент читається на ґрунті як текст', () => {
    expect(contrast(token('--accent'), token('--bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('дві ролі — два різні значення', () => {
    expect(token('--accent')).not.toBe(token('--accent-strong'));
  });

  it('ролі не переставлені місцями', () => {
    /*
     * Було: «плаский акцент СВІТЛІШИЙ за заливку». На темному ґрунті це
     * правда, але це наслідок, а не правило: у світлій темі все навпаки —
     * щоб читатись на рожевому аркуші, лінійний акцент мусить бути
     * ТЕМНІШИМ за заливку. Правило, що працює в обох, одне: `--accent`
     * контрастує з ґрунтом КРАЩЕ за `--accent-strong`, бо саме він
     * призначений бути на ньому текстом.
     *
     * Виміряно: темна 5.90 проти 3.71, світла 6.2 проти 4.7.
     */
    for (const theme of ['dark', 'light'] as const) {
      const line = contrast(token('--accent', theme), token('--bg', theme));
      const fill = contrast(token('--accent-strong', theme), token('--bg', theme));
      expect(line, `${theme}: лінійний акцент має читатись краще за заливку`)
        .toBeGreaterThan(fill);
    }
  });
});

describe('світла тема тримає ті самі пороги', () => {
  /*
   * Аркуш власника ці пороги не проходить: підписи кнопок на ньому білі на
   * ніжно-рожевому, тобто близько 2.2:1. Тому рожевий аркуша лишився там, де
   * він великий і під ним немає тексту, а під білим текстом стоїть глибша
   * малина. Числа нижче — причина, чому саме така.
   */
  it('заливка під білим текстом проходить AA', () => {
    expect(contrast('#ffffff', token('--accent-strong', 'light'))).toBeGreaterThanOrEqual(4.5);
  });

  it('заливка лишається видимою на рожевому аркуші', () => {
    expect(contrast(token('--accent-strong', 'light'), token('--bg', 'light')))
      .toBeGreaterThanOrEqual(3);
  });

  it('лінійний акцент читається на аркуші як текст', () => {
    expect(contrast(token('--accent', 'light'), token('--bg', 'light')))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('основний і приглушений текст читаються обидва', () => {
    // Приглушений — теж текст: підказки в полях і другорядні підписи мають
    // той самий поріг 4.5, і саме тому `--muted` у світлій темі виглядає
    // темнішим, ніж звично для «приглушеного».
    expect(contrast(token('--text', 'light'), token('--bg', 'light'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--muted', 'light'), token('--bg', 'light'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('світлий текст на плаский акцент не повернувся', () => {
  it('жодне правило в жодному CSS не поєднує їх', () => {
    /*
     * Регрес, який виправляли одним проходом по 25 правилах у восьми
     * файлах. Одне випадкове повернення не помітить ніхто — воно виглядає
     * нормально й не падає.
     */
    const files = globSync('src/**/*.css', { cwd: ROOT });
    const offenders: string[] = [];

    for (const file of files) {
      const css = readFileSync(join(ROOT, file), 'utf8');
      for (const rule of css.matchAll(/\{([^{}]*)\}/g)) {
        const body = rule[1]!;
        const filled = /background(-color)?:\s*var\(--accent\)/.test(body);
        const light = /color:\s*(#fff\b|#ffffff\b|white\b|var\(--text\))/.test(body);
        if (filled && light) offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
