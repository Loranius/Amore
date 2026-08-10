import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Wish Spheres — вимоги власника до вигляду й ціни сфер.
// ------------------------------------------------------------
// Три з них не можна перевірити нічим, крім самого файлу стилів: сфера не
// має бути аватаркою, вона не має коштувати як друга сцена, і приглушення
// фону не має дотягтись до головної. Кожна названа вимогою, а не смаком.
// ============================================================

const ROOT = join(__dirname, '../../..');
const CSS = readFileSync(join(ROOT, 'src/features/wishlist/wishlistSpheres.css'), 'utf8');
const BARE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector: string): string {
  const at = BARE.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = BARE.slice(at);
  return body.slice(body.indexOf('{'), body.indexOf('}'));
}

describe('the sphere is glass, not an avatar', () => {
  it('fits the object inside instead of cropping a photo to a circle', () => {
    // Вимога сформульована як заборона: «circle → photograph cropped into
    // circle → border» робити не можна. Тому зображення вписується цілком
    // (`contain`), займає менше за кулю й гасне маскою, а не обрізається.
    const image = block('.wl-sphere-field .wl-sphere__image');
    expect(image).toMatch(/object-fit:\s*contain/);
    expect(image).not.toMatch(/object-fit:\s*cover/);
    expect(image).toMatch(/mask-image:\s*radial-gradient/);
  });

  it('keeps the object recognisable rather than turning it into a pink blur', () => {
    // «Не перетворюй його на сіру/рожеву пляму», і числа названі: насиченість
    // 70–90%, непрозорість 80–95%, трохи менший контраст.
    const image = block('.wl-sphere-field .wl-sphere__image');
    const saturation = /saturate\(([\d.]+)\)/.exec(image);
    const opacity = /opacity:\s*([\d.]+)/.exec(image);
    expect(saturation).not.toBeNull();
    expect(Number(saturation![1])).toBeGreaterThanOrEqual(0.7);
    expect(Number(saturation![1])).toBeLessThanOrEqual(0.9);
    expect(opacity).not.toBeNull();
    expect(Number(opacity![1])).toBeGreaterThanOrEqual(0.8);
    expect(Number(opacity![1])).toBeLessThanOrEqual(0.95);
    expect(image).not.toMatch(/filter:[^;]*blur\(/);
  });

  it('draws the rim as a hairline arc, not as a border', () => {
    const rim = block('.wl-sphere-field .wl-sphere__rim');
    expect(rim).not.toMatch(/\bborder:\s*[^;]*px/);
    expect(rim).toMatch(/mask:\s*radial-gradient/);
  });
});

describe('the price stays low (§18)', () => {
  it('never puts a backdrop pass on a sphere', () => {
    // Двадцять прозорих кіл із власним `backdrop-filter` — це двадцять
    // проходів по фону за кадр на телефоні. Скло тут робиться градієнтами.
    expect(BARE).not.toContain('backdrop-filter');
  });

  it('dims the background scene with a wash, not with a filter over the canvas', () => {
    // Фільтр по повноекранному полотну — зайвий прохід на кожен кадр, і на
    // слабкому пристрої це помітно.
    const wash = block("[data-wishlist-scene='dim'] .artifact-world::after");
    expect(wash).toMatch(/background:/);
    expect(BARE).not.toMatch(/\.artifact-world[^{]*\{[^}]*filter:/);
  });
});

describe('the wishlist changes nothing on Home', () => {
  it('reaches the shared scene only through the wishlist marker', () => {
    // Головна має виглядати так само, як до цієї роботи. Єдине правило, що
    // взагалі торкається спільної сцени, стоїть під маркером, який ставить і
    // знімає сторінка вішліста.
    for (const line of BARE.split('\n')) {
      if (!line.includes('.artifact-world')) continue;
      expect(line, line).toContain("[data-wishlist-scene='dim']");
    }
  });
});

describe('reduced motion (§20)', () => {
  it('keeps the spatial composition but stops the drift', () => {
    const at = BARE.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(-1);
    const body = BARE.slice(at);
    expect(body).toMatch(/animation:\s*none/);
    // Позиції лишаються — жодного `display: none` на сфери.
    expect(body).not.toMatch(/display:\s*none/);
  });
});
