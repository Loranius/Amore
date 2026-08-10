import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Головна як нейтральний центр світу — бриф §15, §44, §48–§49, Фаза 6.
// ------------------------------------------------------------
// Кожна перевірка тут стоїть за виміряною вадою на живому порталі, а не за
// смаком. Числа в коментарях — те, що показав вимір до правки.
// ============================================================

const ROOT = join(__dirname, '../../..');
const SWITCHER = readFileSync(join(ROOT, 'src/features/home/homeArtifactSwitcher.css'), 'utf8');
const SURFACE = readFileSync(join(ROOT, 'src/features/world/worldSurface.css'), 'utf8');
const THEME = readFileSync(join(ROOT, 'src/features/world/worldTheme.css'), 'utf8');
const INDEX = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function token(name: string): string {
  const match = THEME.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`missing token ${name}`);
  return match[1]!.trim();
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseColour(value: string): Rgba {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1]!.split(',').map((p) => Number.parseFloat(p.trim()));
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
  }
  throw new Error(`unparsed colour ${value}`);
}

function composite(over: Rgba, under: Rgba): Rgba {
  return {
    r: over.r * over.a + under.r * (1 - over.a),
    g: over.g * over.a + under.g * (1 - over.a),
    b: over.b * over.a + under.b * (1 - over.a),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/**
 * The brightest thing the sky puts behind Home's foreground.
 *
 * Measured on the live portal rather than assumed: with the switcher at 7%
 * white the worst background under its label came out rgb(86,71,106), which is
 * lighter than any token. Translucent surfaces are only as readable as the
 * lightest thing behind them, so that is what these ratios are computed over.
 */
const WORST_SKY: Rgba = { r: 86, g: 71, b: 106, a: 1 };

describe('artifact switcher (brief §15, §48)', () => {
  it('reads the selected artifact, which it did not', () => {
    // Measured before this phase: white ink on `--world-accent` gave 1.74:1 —
    // the least readable thing on the screen, and the one word that says which
    // world the couple is looking at.
    const body = parseColour(token('--world-primary-soft'));
    const ink = parseColour(token('--world-bg-deep'));
    expect(contrast(ink, body)).toBeGreaterThan(4.5);
  });

  it('reads the ones not selected, over the brightest sky', () => {
    // Measured before: 3.75:1, because the surface was 7% white and the sky
    // came through it.
    const surface = composite(parseColour(token('--world-surface')), WORST_SKY);
    expect(contrast(parseColour(token('--world-text-muted')), surface)).toBeGreaterThan(4.5);
  });

  it('marks the selected one in more than one way', () => {
    // §15 again, and here it matters most: this control is the one place a
    // couple chooses between worlds.
    const rule = bare(SWITCHER).slice(bare(SWITCHER).indexOf('.home-artifact-option--active'));
    const body = rule.slice(rule.indexOf('{'), rule.indexOf('}'));
    const channels = [
      /background/.test(body),
      /border/.test(body),
      /(^|[;\s])color:/.test(body),
      /transform|box-shadow/.test(body),
    ].filter(Boolean).length;
    expect(channels).toBeGreaterThanOrEqual(3);
  });

  it('keeps one warm accent in the palette', () => {
    // The "still in development" dot was #e2b34f — gold, a second warm accent
    // in a palette §8 allows exactly one of.
    expect(bare(SWITCHER)).not.toMatch(/#e2b34f|#ffe3a1/);
  });
});

describe('blur budget (brief §44)', () => {
  it('leaves exactly one glass surface on Home', () => {
    // §44: one stronger parent glass surface, not an independent heavy
    // backdrop-filter per element. Measured on the live portal, Home had two —
    // the dock and the switcher, stacked.
    const home = (bare(SWITCHER).match(/backdrop-filter/g) ?? []).length;
    const world = (bare(SURFACE).match(/backdrop-filter/g) ?? []).length;
    expect(home).toBe(0);
    expect(world).toBe(1);
  });
});

describe('no white flash (brief §49)', () => {
  it('starts the app on the world’s ground, not on paper', () => {
    // Measured: the first frame averaged 247.6 of 255 — a white screen, with
    // the night portal arriving right behind it. This screen shows on every
    // cold start, while the session is being checked.
    const boot = bare(INDEX).slice(bare(INDEX).indexOf('.boot-screen'));
    expect(boot.slice(0, boot.indexOf('}'))).toMatch(/background:\s*var\(--world-bg-deep\)/);
  });

  it('paints the ground before any stylesheet exists', () => {
    // The rule in index.css cannot win the first frame: in dev the styles
    // arrive by script, and by then the white document is already drawn. So
    // the ground is repeated inline — the one place a colour literal is
    // justified, because the variable does not exist yet.
    const inline = HTML.match(/html\s*{\s*background:\s*(#[0-9a-fA-F]{6})/);
    expect(inline, 'index.html must paint the ground inline').not.toBeNull();
    expect(inline![1]!.toLowerCase()).toBe(token('--world-bg-deep').toLowerCase());
  });

  it('keeps paper under the pages that have none of their own', () => {
    // Seven pages never painted a background — they stood on the document's
    // colour. Now the document belongs to the world, so the container holds
    // the paper until each page's own phase moves it into the world.
    expect(bare(INDEX)).toMatch(/\.app-shell > \.content \{\s*background: var\(--bg\);/);
    expect(bare(INDEX)).toMatch(/\[data-portal-scene='true'\] \.app-shell > \.content \{\s*background: none;/);
  });

  it('has the world’s tokens before the world is mounted', () => {
    // The reason the line above works at all. The tokens used to arrive with
    // `artifactWorld.css`, which loads with the world — after the boot screen
    // has already painted.
    expect(bare(INDEX)).toMatch(/@import\s+'\.\/features\/world\/worldTheme\.css'/);
  });
});
