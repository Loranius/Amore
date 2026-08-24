import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  fileURLToPath(new URL('./wishlistBubble3d.css', import.meta.url)),
  'utf8',
);

/** Той самий CSS без коментарів: вони цитують саме те число, що прибране. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));

describe('чорнило скла кульки йде за темою', () => {
  /*
   * Вада, яку побачив власник: у світлій темі портал кримсоновий
   * (`--world-accent: #9c2b50`), а тінь на дальшому боці кульки лишалась
   * фіолетовою — `rgba(71, 42, 91, …)` вписаний числом у чотирьох
   * місцях. У темній темі те саме число доречне, тож правило «прибрати
   * фіолетовий» тут не годиться: годиться «зробити його токеном»
   * (ADR-0056).
   */

  it('жодне з чотирьох місць не тримає колір числом', () => {
    expect(CODE).not.toContain('rgba(71, 42, 91');
    expect(CODE).not.toContain('rgba(66, 39, 85');
    // Чотири — не «кілька»: якщо додасться п'яте, воно теж має бути
    // токеном, і цей рахунок про це нагадає.
    expect(CODE.match(/rgba\(var\(--wl-bubble-ink/g)).toHaveLength(4);
  });

  it('темна тема лишається фіолетовою — власник просив саме так', () => {
    const at = CODE.indexOf(':root {');
    expect(at).toBeGreaterThan(-1);
    const rule = CODE.slice(at, CODE.indexOf('}', at));
    expect(rule).toContain('--wl-bubble-ink: 71, 42, 91');
    expect(rule).toContain('--wl-bubble-ink-soft: 66, 39, 85');
  });

  it('світла тема бере ніжний рожевий', () => {
    const at = CODE.indexOf("[data-theme='light']");
    expect(at).toBeGreaterThan(-1);
    const rule = CODE.slice(at, CODE.indexOf('}', at));
    expect(rule).toContain('--wl-bubble-ink: 138, 74, 99');
    expect(rule).toContain('--wl-bubble-ink-soft: 130, 70, 94');
  });

  it('тінь під кулькою лишається тінню, а не кольором теми', () => {
    /*
     * `drop-shadow` під вирізаним товаром — `rgba(36, 24, 45, …)`, і він
     * НЕ став токеном навмисно: тінь у порталі не носить кольору акценту
     * (DESIGN.md, «Shadow Is A Shadow»). Якщо колись хтось «доведе до
     * ладу» і його — цей тест скаже, що це інша річ.
     */
    expect(CODE).toContain('rgba(36, 24, 45');
  });
});
