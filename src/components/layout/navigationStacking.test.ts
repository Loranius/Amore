import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../../index.css', import.meta.url)),
  'utf8',
);

/** The declaration block of a rule, by its exact selector. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

/**
 * Navigation has to out-stack the portal.
 *
 * The home screen paints its scene as `position: fixed` layers with their own
 * `z-index`, and a positioned element always paints above a non-positioned one
 * whatever their order in the flow. The desktop sidebar was `position: static`
 * with `z-index: auto`, so the crystal's canvas covered it: measured on a
 * 1280×800 viewport, the sidebar occupied [12, 73, 215, 596] with thirteen
 * links in it, and `document.elementFromPoint` at its centre returned the
 * canvas. The portal had no reachable navigation on desktop at all.
 *
 * The bottom navigation never had the bug because it was already fixed at
 * `z-index: 50` — which is the proof the number is enough, since it stands over
 * the same canvas on a phone.
 *
 * This reads the stylesheet rather than a rendered page on purpose. The defect
 * is a missing declaration, and a jsdom render resolves neither media queries
 * nor stacking; catching it for real needs the browser probe. What this guards
 * is the thing that was actually absent.
 */
describe('navigation stacking', () => {
  it('gives the desktop sidebar a stacking context above the portal', () => {
    const sidebar = block('  .sidebar');
    expect(sidebar).toMatch(/position:\s*relative/);
    expect(sidebar).toMatch(/z-index:\s*50/);
  });

  it('keeps the phone navigation on the same layer', () => {
    const bottom = block('.bottom-nav');
    expect(bottom).toMatch(/position:\s*fixed/);
    expect(bottom).toMatch(/z-index:\s*50/);
  });

  it('keeps the portal scene below both', () => {
    // The scene's own layers are z-index 0 and 1; anything at or above the
    // navigation's 50 would take the clicks back.
    const backdrop = readFileSync(
      fileURLToPath(new URL('../../features/home/portalBackdrop.css', import.meta.url)),
      'utf8',
    );
    const zIndices = [...backdrop.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(zIndices.length).toBeGreaterThan(0);
    expect(Math.max(...zIndices)).toBeLessThan(50);
  });
});
