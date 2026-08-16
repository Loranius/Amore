import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Токени світу — бриф §8–§9, Фаза 2.
// ------------------------------------------------------------
// Ці перевірки стережуть не колір, а **ієрархію**. Бриф просить рівно
// цього: ролі замість відтінків, одне джерело правди, і жодних «десяти
// непов'язаних фіолетових» (§8). Значення власник змінюватиме; імена й
// те, що вони єдині, — ні.
// ============================================================

const ROOT = join(__dirname, '../../..');
const THEME = readFileSync(join(ROOT, 'src/features/world/worldTheme.css'), 'utf8');
const BACKDROP = readFileSync(join(ROOT, 'src/features/home/portalBackdrop.css'), 'utf8');
const WORLD = readFileSync(join(ROOT, 'src/features/world/artifactWorld.css'), 'utf8');

/** Every role the brief's §9 names, in the shape this project uses. */
const REQUIRED_TOKENS = [
  '--world-bg',
  '--world-bg-deep',
  '--world-primary',
  '--world-primary-soft',
  '--world-accent',
  '--world-accent-soft',
  '--world-surface',
  '--world-surface-strong',
  '--world-surface-soft',
  '--world-border',
  '--world-border-active',
  '--world-text',
  '--world-text-muted',
  '--world-glow',
  '--world-shadow',
  '--world-success',
  '--world-warning',
  '--world-danger',
] as const;

function declaredIn(css: string, block: string): Set<string> {
  const start = css.indexOf(block);
  if (start < 0) return new Set();
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open, close);
  return new Set(
    [...body.matchAll(/(--world-[a-z-]+)\s*:/g)].map((match) => match[1]!),
  );
}

describe('world theme tokens (Crystal World brief §8–§9)', () => {
  it('declares every role the brief names', () => {
    const declared = declaredIn(THEME, ':root {');
    for (const token of REQUIRED_TOKENS) {
      expect(declared.has(token), token).toBe(true);
    }
  });

  it('names roles rather than shades', () => {
    // The brief's own warning: "Do NOT use ten unrelated purple shades
    // without hierarchy". A token called `--world-purple-3` would satisfy
    // every other test here and defeat the point of all of them.
    const declared = [...declaredIn(THEME, ':root {')];
    for (const token of declared) {
      expect(/purple|violet|pink|lilac|mauve|\d$/.test(token), token).toBe(false);
    }
  });

  it('leaves no colour literal in the world’s own stylesheets', () => {
    // The whole reason the layer exists. These two files held three
    // independent sets of values — the sky, the night overrides and the dock —
    // and three places that must agree are three places to forget one.
    for (const [name, css] of [['portalBackdrop.css', BACKDROP], ['artifactWorld.css', WORLD]] as const) {
      const literals = css
        // Comments explain the values they replaced; they are prose, not style.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [];
      expect(literals, name).toEqual([]);
    }
  });

  it('lets the dark theme move the environment without redefining the world', () => {
    // The stated design: the portal is a night scene in both themes, and the
    // light one differs by being a little warmer — not by being another place.
    // So the dark block may lower the room and its shadows; text and accents
    // are the world's identity and stay put.
    const dark = declaredIn(THEME, "[data-theme='dark'] {");
    expect(dark.size).toBeGreaterThan(0);
    for (const token of dark) {
      expect(
        /^--world-(bg|bg-deep|surface|surface-strong|shadow|vignette)$/.test(token),
        `${token} is not an environment role`,
      ).toBe(true);
    }
  });

  it('keeps one warm colour, and reserves it', () => {
    // §8 allows exactly one warm accent, for what concerns the relationship
    // itself. Two would make the palette a gradient of moods rather than one
    // world with a single warm note in it.
    const warm = [...declaredIn(THEME, ':root {')].filter((token) => /warm|rose/.test(token));
    expect(warm).toEqual(['--world-warm']);
  });
});

// ============================================================
// Рецепт активної кнопки — один на портал.
// ------------------------------------------------------------
// Історія цього файлу вже містить відповідь, що буває інакше: до референсу
// власника в модулі «Плани» накопичилось вісім шарів стилю, шість із яких
// перевизначали той самий псевдоелемент. Починалось так само — з другої копії
// значення, яку ніхто не помітив.
//
// Тому градієнт активної кнопки живе в `--control-fill`, а плани, покупки й
// вішліст на нього посилаються. Перевірка тримає саме це.
// ============================================================
describe('the active-button recipe stays one recipe', () => {
  const PORTAL = readFileSync(join(ROOT, 'src/index.css'), 'utf8');

  /** Фіолетове тіло кнопки — те, що робить її «Календарем» із планів. */
  const BODY = /#7a3fd0|#52259a|#35156b/;

  it('declares the fill once, in the token layer', () => {
    expect(PORTAL).toMatch(/--control-fill:/);
    expect(PORTAL.match(/--control-fill:/g)).toHaveLength(1);
  });

  it('is never spelled out a second time anywhere in src', () => {
    // Знайти всі файли стилю й перевірити кожен: перелік у тесті застаріває
    // рівно тоді, коли додається наступний модуль.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return walk(path);
        return entry.name.endsWith('.css') ? [path] : [];
      });

    const offenders = walk(join(ROOT, 'src'))
      .filter((path) => !path.endsWith('src/index.css'))
      .filter((path) => BODY.test(readFileSync(path, 'utf8')));

    expect(offenders, 'ці файли повторюють градієнт замість var(--control-fill)').toEqual([]);
  });
});
