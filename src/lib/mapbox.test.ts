import { describe, expect, it } from 'vitest';

/**
 * The guard that decides whether a Mapbox token counts as present.
 *
 * Mirrored here rather than imported, because the module reads
 * `import.meta.env` at load time and a test cannot re-import it per case. The
 * expression is one line and the point is the *rule*, not the plumbing.
 */
const resolve = (fromEnv: string | undefined, fallback: string): string =>
  (fromEnv ?? '').trim() || fallback;

describe('Mapbox token resolution', () => {
  const fallback = 'pk.fallback';

  it('treats an empty environment variable as no token at all', () => {
    // This is the bug, and it is the shape an environment file actually takes
    // when a key is present but unset: `VITE_MAPBOX_TOKEN=` parses to an empty
    // string, which `??` does not fall back on. The token went to Mapbox as '',
    // it threw "an API access token is required" during render, and the route
    // error boundary caught it — the whole map page became a crash screen.
    //
    // Found by sweeping every route at three viewports: `/map` was the only one
    // showing the boundary, on all three.
    expect(resolve('', fallback)).toBe(fallback);
    expect(resolve(undefined, fallback)).toBe(fallback);
  });

  it('treats a whitespace-only variable the same way', () => {
    // A deployed environment variable with a stray newline is truthy and still
    // not a token.
    expect(resolve('   ', fallback)).toBe(fallback);
    expect(resolve('\n', fallback)).toBe(fallback);
  });

  it('uses a real token when there is one, and trims it', () => {
    expect(resolve('pk.real', fallback)).toBe('pk.real');
    expect(resolve('  pk.real\n', fallback)).toBe('pk.real');
  });

  it('matches what the module actually does', async () => {
    // The mirror above is only worth having if it agrees with the real thing.
    const { MAPBOX_TOKEN } = await import('./mapbox');
    expect(typeof MAPBOX_TOKEN).toBe('string');
    expect(MAPBOX_TOKEN.trim()).toBe(MAPBOX_TOKEN);
    // Whatever this environment supplies, the page must never be handed an
    // empty token — that is the condition that took the route down.
    expect(MAPBOX_TOKEN.length).toBeGreaterThan(0);
  });
});
