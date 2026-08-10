import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Вішліст у Crystal World — бриф §10, §28, §44, §55, Фаза 7b.
// ------------------------------------------------------------
// Перший модуль, який впускає світ. Перевірки тримають те, що бриф називає
// вадами: прозорість замість поверхонь, розмиття на кожній картці, і темна
// сторінка там, де світу не видно.
// ============================================================

const ROOT = join(__dirname, '../../..');
const CSS = readFileSync(join(ROOT, 'src/features/wishlist/wishlistCrystalWorld.css'), 'utf8');
const BARE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Selectors, read by tracking braces rather than by guessing at line ends. */
function selectors(css: string): string[] {
  const found: string[] = [];
  // `@keyframes` теж at-rule, але його діти — не селектори, а `from`/`to`.
  // Перша редакція цього обхідника рахувала їх селекторами й вимагала від них
  // маркера маршруту.
  const stack: ('at' | 'keyframes' | 'rule')[] = [];
  let head = '';
  for (const char of css) {
    const inDeclarations = stack[stack.length - 1] === 'rule';
    if (char === '{') {
      const text = head.trim();
      head = '';
      if (text.startsWith('@')) {
        stack.push(text.startsWith('@keyframes') ? 'keyframes' : 'at');
        continue;
      }
      const insideKeyframes = stack[stack.length - 1] === 'keyframes';
      stack.push('rule');
      if (text !== '' && !insideKeyframes) found.push(text);
    } else if (char === '}') {
      head = '';
      stack.pop();
    } else if (!inDeclarations) {
      head += char;
    }
  }
  return found;
}

describe('scope (brief §42, §55)', () => {
  it('changes nothing on a route the world does not reach', () => {
    // The migration rule the whole phase order rests on: a module turns dark
    // because its route opened the world, not because a stylesheet was
    // imported. Without this, importing the file anywhere would repaint the
    // wishlist on every screen.
    const lists = selectors(BARE);
    expect(lists.length).toBeGreaterThan(3);
    for (const list of lists) {
      for (const selector of list.split(',')) {
        // Обидва маркери ставить один хук і завжди разом: `data-world-input`
        // без `data-portal-scene` не існує. Тож правило під ним так само не
        // може дістати сторінку, на якій світу не видно.
        const trimmed = selector.trim();
        expect(
          trimmed.startsWith("[data-portal-scene='true']")
            || trimmed.startsWith("[data-world-input='artifact']"),
          selector,
        ).toBe(true);
      }
    }
  });

  it('wins against the bubble’s own shell', () => {
    // Measured on the live portal: the first version of these rules used
    // `.wishlist .wl-cloud-bubble` (0,3,0) and lost to
    // `.wishlist .wishlist-grid .wl-cloud-item .wl-cloud-bubble` (0,4,0) in
    // wishlistBubbleGlass.css — the glass ball kept a bright rim on the night
    // scene. The full chain is repeated deliberately.
    const bubbleRules = selectors(BARE).filter((list) => list.includes('.wl-cloud-bubble'));
    expect(bubbleRules.length).toBeGreaterThan(0);
    for (const list of bubbleRules) {
      for (const selector of list.split(',')) {
        expect(selector, selector).toContain('.wishlist-grid .wl-cloud-item');
      }
    }
  });
});

describe('surfaces (brief §10, §44)', () => {
  it('blurs the sheet and nothing else', () => {
    // §44 asks for one stronger parent glass surface rather than an
    // independent backdrop-filter per element. The sheet is that surface. The
    // 46px round button is not: a backdrop pass on it buys nothing the
    // translucent fill and the hairline edge do not already give.
    const blurs = BARE.match(/backdrop-filter:\s*blur/g) ?? [];
    expect(blurs).toHaveLength(1);
    const sheet = BARE.slice(BARE.indexOf('.wl-world-sheet {'));
    expect(sheet.slice(0, sheet.indexOf('}'))).toMatch(/backdrop-filter:\s*blur/);
  });

  it('takes the paper away without making the page transparent', () => {
    // §10 and §55 forbid the literal reading of "remove the white". The page
    // loses its own background and hands its tokens to the world, so what is
    // left is a controlled hierarchy rather than nothing.
    const page = BARE.slice(BARE.indexOf('.wishlist.pink-page'));
    const body = page.slice(page.indexOf('{'), page.indexOf('}'));
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/--text:\s*var\(--world-text\)/);
    expect(body).toMatch(/--surface:\s*var\(--world-surface\)/);
  });

  it('spends no colour literals of its own', () => {
    // One exception, and it is stated: the facet light is white at a stated
    // opacity, because a highlight is light rather than a role in the palette.
    const literals = BARE.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g) ?? [];
    for (const literal of literals) {
      expect(literal, literal).toMatch(/^rgba\(255, 255, 255,/);
    }
  });
});

describe('wishes as crystals (brief §28)', () => {
  it('cuts the wish to a faceted silhouette instead of a bubble', () => {
    const bubble = BARE.slice(BARE.indexOf(".wl-cloud-bubble {"));
    const body = bubble.slice(0, bubble.indexOf('}'));
    expect(body).toMatch(/clip-path:\s*polygon/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/box-shadow:\s*none/);
  });

  it('keeps light on the facets, which is what makes it read as stone', () => {
    // Measured: with the overlay simply hidden, a dark product photo on the
    // night world read as a hole in the scene, and a one-pixel rim did not
    // save it.
    const after = BARE.slice(BARE.indexOf('.wl-cloud-bubble::after'));
    const body = after.slice(after.indexOf('{'), after.indexOf('}'));
    expect(body).toMatch(/display:\s*block/);
    expect(body).toMatch(/linear-gradient/);
  });
});
