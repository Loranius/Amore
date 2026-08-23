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

  it('leaves the fallback bubbles alone', () => {
    // Змінена вимога, і змінена власником прямим текстом: «не роби
    // crystal-shaped UI». Тут стояли правила, які обрізали кульку
    // бульбашкового вигляду в шестигранник, і тест стеріг їхню специфічність.
    // Кристалів у вішлісті більше немає — ні тілами у сцені, ні формою в CSS,
    // — а бульбашковий вигляд лишається запасним шляхом без WebGL і має
    // виглядати собою.
    expect(BARE).not.toContain('.wl-cloud-bubble');
    expect(BARE).not.toMatch(/clip-path:\s*polygon/);
  });
});

describe('surfaces (brief §10, §44)', () => {
  it('не розмиває нічого: під ним і так уже розмито', () => {
    /*
     * **Вимога змінилась, і змінилась через вимір.**
     *
     * Тест раніше вимагав РІВНО ОДНЕ розмиття — на аркуші, — виходячи з
     * §44: одна сильніша скляна поверхня замість кількох незалежних. Це
     * було правильно як половина правила. Друга половина знайшлась
     * пізніше: поки модуль відкритий, `worldDim` накриває весь
     * `.artifact-world` вуаллю І розмиває його власним
     * `filter: blur(4px)`.
     *
     * Тобто аркуш розмивав тло, яке вже розмите й уже приглушене.
     * Побачити різницю неможливо, а платить за неї браузер щокадру, бо
     * під вуаллю крутиться анімоване полотно.
     *
     * Лишилось два розмиття на весь портал, і обидва стоять над ЖИВИМ,
     * нерозмитим тлом: док (`.bottom-nav`) і вуаль над фото героя
     * спогадів (`.mm-hero-veil`).
     */
    expect(BARE).not.toMatch(/backdrop-filter/);
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
