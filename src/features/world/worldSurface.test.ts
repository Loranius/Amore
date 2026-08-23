import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Поверхні світу — бриф §11–§19, Фаза 5.
// ------------------------------------------------------------
// Стережуть не вигляд, а те, що бриф називає вадами: прозорість замість
// ієрархії (§10), стан самим лише відтінком (§15), розмиття на кожній
// картці (§13), неонові кнопки (§16), білі поля форм (§17). Значення —
// смак власника; ці властивості — ні.
// ============================================================

const ROOT = join(__dirname, '../../..');
const THEME = readFileSync(join(ROOT, 'src/features/world/worldTheme.css'), 'utf8');
const SURFACE = readFileSync(join(ROOT, 'src/features/world/worldSurface.css'), 'utf8');

const NO_COMMENTS = SURFACE.replace(/\/\*[\s\S]*?\*\//g, '');

/** Value of a token as declared in `:root`. */
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

/** Paints `over` onto `under`, the way the browser composites it. */
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

/** The declaration block for a selector, comments stripped. */
function ruleFor(selector: string): string {
  const index = NO_COMMENTS.indexOf(selector);
  expect(index, `missing rule for ${selector}`).toBeGreaterThan(-1);
  const open = NO_COMMENTS.indexOf('{', index);
  return NO_COMMENTS.slice(open + 1, NO_COMMENTS.indexOf('}', open));
}

describe('surface hierarchy (brief §10, §12–§14)', () => {
  it('gives the three levels three different densities', () => {
    // §10 is explicit that removing white backgrounds does not mean making
    // everything transparent. Three levels that all resolved to the same
    // alpha would be exactly that mistake, spelled differently.
    const strong = parseColour(token('--world-surface-strong')).a;
    const card = parseColour(token('--world-surface')).a;
    const control = parseColour(token('--world-surface-soft')).a;
    expect(strong).toBe(1);
    expect(card).toBeLessThan(strong);
    expect(control).toBeLessThan(card);
  });

  it('reads text well on every level', () => {
    // §12 asks for "excellent text contrast" and §17 for accessible
    // contrast. Computed against what the eye actually sees: each surface
    // composited over the world behind it.
    const world = parseColour(token('--world-bg'));
    const text = parseColour(token('--world-text'));
    const muted = parseColour(token('--world-text-muted'));
    for (const name of ['--world-surface-strong', '--world-surface', '--world-surface-soft'] as const) {
      const surface = composite(parseColour(token(name)), world);
      expect(contrast(text, surface), `${name} / text`).toBeGreaterThan(7);
      expect(contrast(muted, surface), `${name} / muted`).toBeGreaterThan(4.5);
    }
  });

  it('keeps an input readable inside its own recess', () => {
    // §17: a dark mineral recess, not a white form field — and still
    // readable, which is the half that is easy to lose.
    const recess = composite(
      parseColour(token('--world-recess')),
      composite(parseColour(token('--world-surface-strong')), parseColour(token('--world-bg'))),
    );
    expect(contrast(parseColour(token('--world-text')), recess)).toBeGreaterThan(7);
    expect(contrast(parseColour(token('--world-text-muted')), recess)).toBeGreaterThan(4.5);
    // A recess goes *into* the stone: it must be darker than what it sits in.
    expect(luminance(recess)).toBeLessThan(
      luminance(composite(parseColour(token('--world-surface-strong')), parseColour(token('--world-bg')))),
    );
  });

  it('reads a primary action’s label against its own body', () => {
    // §16 wants light readable text on polished amethyst. The body is a
    // solid token, so this is a straight ratio.
    expect(
      contrast(parseColour(token('--world-bg-deep')), parseColour(token('--world-primary-soft'))),
    ).toBeGreaterThan(4.5);
    expect(
      contrast(parseColour(token('--world-bg-deep')), parseColour(token('--world-danger'))),
    ).toBeGreaterThan(4.5);
  });
});

describe('active state (brief §15)', () => {
  it('changes four things, not the hue alone', () => {
    // The brief's own words: "Do NOT communicate interaction state through
    // purple hue alone." A rule that only swapped `background` would pass
    // every other test in this file and fail every colour-blind user.
    for (const selector of [
      "[data-portal-scene='true'] .btn-secondary[aria-pressed='true']",
      "[data-portal-scene='true'] .bottom-nav-indicator",
    ]) {
      const body = ruleFor(selector);
      // Four disjoint channels: fill, edge, ink, depth. At least three must
      // move, so that losing any one of them still leaves the state legible.
      const channels = [
        /background/.test(body),
        /border/.test(body),
        /(^|[;\s])color:/.test(body),
        /transform|box-shadow/.test(body),
      ].filter(Boolean).length;
      expect(channels, selector).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives focus an outline that survives a colourblind eye', () => {
    // A border colour change alone is invisible to a good share of people;
    // an outline offset from the field is a shape change.
    const body = ruleFor("[data-portal-scene='true'] input:focus-visible");
    expect(body).toMatch(/outline:\s*2px solid/);
    expect(body).toMatch(/outline-offset/);
  });
});

/** Ділить `box-shadow` на шари, не рвучи вкладені `fn(a, b)`. */
function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) { layers.push(current); current = ''; continue; }
    current += char;
  }
  if (current.trim()) layers.push(current);
  return layers;
}

describe('restraint (brief §11, §13, §16)', 
() => {
  it('blurs exactly one thing', () => {
    // §13: "Do not put expensive blur on every card." The dock is one
    // element on the screen and lies directly on the artifact; a list of
    // thirty cards is not.
    //
    // The dock's own surface no longer lives in this file. It used to sit
    // under `[data-portal-scene='true']`, i.e. it only applied where the
    // scene shows — while the base rule in index.css was invalid CSS the
    // browser dropped (a colour in a non-final background layer), so on
    // every route without a scene the dock was fully transparent. The one
    // recipe now lives in index.css; see `dockSurface.test.ts`.
    //
    // The invariant this test protects is unchanged and still checked:
    // this file blurs NOTHING of its own, so no card list can quietly
    // acquire a backdrop-filter here.
    const blurs = NO_COMMENTS.match(/backdrop-filter/g) ?? [];
    expect(blurs).toHaveLength(0);
  });

  it('never glows in colour', () => {
    // §16: "Do not create neon glowing buttons." A shadow in this world is
    // a shadow — dark, and cast downward. The only coloured light allowed
    // is a one-pixel inset edge, which is a highlight on a facet.
    const shadows = [...NO_COMMENTS.matchAll(/box-shadow:([^;]+);/g)].map((m) => m[1]!);
    expect(shadows.length).toBeGreaterThan(0);
    for (const shadow of shadows) {
      // Розділювач шарів мусить пропускати коми ВСЕРЕДИНІ дужок:
      // `color-mix(in srgb, …)` містить їх, і наївний split рвав такий
      // шар на уламки. Сторож, який плутається на дозволеному значенні,
      // так само промовчить на забороненому.
      for (const layer of splitShadowLayers(shadow)) {
        if (/var\(--world-glow\)/.test(layer)) {
          // Coloured light is allowed only as a hairline inset edge.
          expect(layer.trim(), layer).toMatch(/^inset 0 1px 0/);
        }
      }
    }
  });

  it('spends no colour literals of its own', () => {
    // Same rule the theme layer already lives by: one source of truth, or
    // the fifth place to forget.
    expect(NO_COMMENTS.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? []).toEqual([]);
  });
});

describe('the dock, after the two ways it went wrong', () => {
  // Both checks are regressions, not taste. The owner reported them in one
  // sentence — «кнопка змінена лише покупках… також відцентруй його, бо він
  // щось дуже занесений вправо» — and they turned out to be two independent
  // defects that this layer and its neighbour each caused once.

  it('keeps the shared volume recipe when it repaints the active pill', () => {
    // The defect: this rule overrode the base indicator and quietly dropped
    // the `--control-*` relief with it, so the active item looked volumetric
    // only on routes with no scene behind them. Shopping was the last such
    // route, which is why the owner saw exactly one correct button.
    //
    // The guard is the recipe, not the values: an override that repaints the
    // pill is fine, an override that flattens it is the bug coming back.
    const body = ruleFor("[data-portal-scene='true'] .bottom-nav-indicator");
    expect(body).toMatch(/--control-sheen/);
    expect(body).toMatch(/box-shadow:[^;]*--control-/);
  });

  it('never takes the dock out of fixed positioning', () => {
    // The other half. `artifactWorld.css` lifted the shell's children above
    // the scene with `position: relative`, and the dock was in that list —
    // so `left`/`right` stopped sizing it. Measured on the live portal: a
    // 412 px box from x=14 instead of 384, its centre 14 px right of the
    // screen's. That is the whole of "занесений вправо".
    //
    // The dock does not need the rule: `index.css` already gives it
    // `z-index: 50`, well above the `z-index: 1` its neighbours get here.
    const world = readFileSync(join(ROOT, 'src/features/world/artifactWorld.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    let scanned = 0;
    for (const [, selectors, declarations] of world.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      scanned += 1;
      if (!/position\s*:\s*(relative|static|absolute)/.test(declarations!)) continue;
      for (const selector of selectors!.split(',')) {
        expect(selector.trim().endsWith('.bottom-nav'), selector).toBe(false);
      }
    }
    // The first version of this loop destructured the match as
    // `[selectors, declarations]` — which is `[whole match, selectors]` — so
    // it read selector text where it expected declarations, matched nothing,
    // and passed while the defect was reinstated. The count is the proof
    // that the scan found rules at all.
    expect(scanned).toBeGreaterThan(5);
  });
});

describe('where the surfaces apply (brief preamble, §18)', () => {
  it('never paints anything outside the world', () => {
    // The scoping rule this phase rests on: a dark card on a light page is
    // not "partly migrated", it is broken. Every rule here is behind the
    // marker that says the world is actually visible behind it.
    //
    // Read by tracking braces rather than by looking for lines that end in a
    // comma: a multi-line `box-shadow` value ends in a comma too, and the
    // first version of this test called one a selector.
    const selectors: string[] = [];
    // Each open brace pushes what kind of block it was: an at-rule still
    // contains selectors, a style rule contains declarations.
    const stack: ('at' | 'rule')[] = [];
    let head = '';
    for (const char of NO_COMMENTS) {
      const inDeclarations = stack[stack.length - 1] === 'rule';
      if (char === '{') {
        const text = head.trim();
        head = '';
        if (text.startsWith('@')) { stack.push('at'); continue; }
        stack.push('rule');
        if (text !== '') selectors.push(text);
      } else if (char === '}') {
        head = '';
        stack.pop();
      } else if (!inDeclarations) {
        head += char;
      }
    }

    expect(selectors.length).toBeGreaterThan(5);
    for (const list of selectors) {
      for (const selector of list.split(',')) {
        expect(selector.trim().startsWith("[data-portal-scene='true']"), selector).toBe(true);
      }
    }
  });

  it('lets the world stay visible behind a sheet', () => {
    // §18 asks for a sheet layered over the world rather than a page
    // replacing it. An opaque scrim would be the page, wearing a shadow.
    const scrim = ruleFor("[data-portal-scene='true'] .modal-overlay");
    expect(scrim).toMatch(/var\(--world-vignette\)/);
    expect(parseColour(token('--world-vignette')).a).toBeLessThan(0.9);
  });
});
