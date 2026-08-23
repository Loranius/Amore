import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ============================================================
// Приглушення спільної сцени в модулях — обидві теми.
// ------------------------------------------------------------
// Джерело-охоронний тест, за тим самим підходом, що й `wishlistSpheres.
// test.ts`: правило живе в CSS, а перевіряти рантайм-рендер WebGL-полотна
// тут нічим (vitest.config.ts бере лише `.test.ts`, середовище `node`).
// ============================================================
const CSS = readFileSync(
  fileURLToPath(new URL('./worldDim.css', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function ruleBody(startPattern: RegExp): string {
  const at = CSS.search(startPattern);
  expect(at, `правило ${startPattern} має існувати`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf('}', at));
}

describe('приглушення сцени у світлій темі (ADR-0040 §5, редакція 2)', () => {
  it('не закриває сцену суцільним папером', () => {
    // До денної сцени (§4) вуаль була flat `var(--page-ground)`, бо сцена
    // лишалась нічною в обох темах. Денна сцена той самий сірий-посередині
    // не дає, тож ховати кристал більше нема чого рятувати.
    const rule = ruleBody(/html\[data-theme='light'\]\[data-world-scene='dim'\] \.artifact-world::after \{/);
    expect(rule).not.toContain('var(--page-ground)');
    expect(rule).toContain('radial-gradient(');
  });

  it('не вимикає розмиття й масштаб для світлої теми окремо', () => {
    // Була друга компоундна правило, що скидала filter/transform назад у
    // `none` рівно для світлої теми — так кристал ховався ще й геометрично,
    // навіть якби вуаль стала прозорою. Регресія на неї непомітна: CSS не
    // падає, просто кристал знову зникає.
    expect(CSS).not.toMatch(/html\[data-theme='light'\]\[data-world-scene='dim'\] \.artifact-world \{[^}]*filter:\s*none/);
  });

  it('спільне правило розмиття тепер діє на обидві теми однаково', () => {
    // `[data-world-scene='dim'] .artifact-world { filter: blur(…); … }` без
    // префікса теми — це і є типове правило; світла тема більше не має
    // власного override, що його скасовує.
    const at = CSS.search(/^\[data-world-scene='dim'\] \.artifact-world \{/m);
    expect(at).toBeGreaterThan(-1);
    const rule = CSS.slice(at, CSS.indexOf('}', at));
    expect(rule).toMatch(/filter:\s*blur\(/);
    expect(rule).toMatch(/transform:\s*scale\(/);
  });
});
