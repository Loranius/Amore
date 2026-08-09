import { describe, expect, it } from 'vitest';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { barkRelief, barkReliefPhase } from './barkRelief';

const config = DEFAULT_ORGANIC_SURFACE_CONFIG.bark;
const THICK = config.fadeRadius * 4;

describe('barkReliefPhase', () => {
  it('is stable for a branch id and different between branches', () => {
    expect(barkReliefPhase('organic:trunk')).toBe(barkReliefPhase('organic:trunk'));
    expect(barkReliefPhase('organic:trunk')).not.toBe(barkReliefPhase('organic:branch:a'));
  });

  it('stays inside one turn, so it is a phase and not a drift', () => {
    for (const id of ['organic:trunk', 'a', 'b', 'organic:branch:tree:annual:1']) {
      expect(barkReliefPhase(id)).toBeGreaterThanOrEqual(0);
      expect(barkReliefPhase(id)).toBeLessThan(Math.PI * 2);
    }
  });
});

describe('barkRelief', () => {
  it('leaves twigs perfectly round', () => {
    // The relief is a fraction of the radius, so on a twig it would be
    // invisible — but the normal tilt is not, and it would make thin branches
    // shimmer for nothing.
    const relief = barkRelief(1.1, 0.4, 0, 0.3, config);
    expect(relief.radiusScale).toBe(1);
    expect(relief.angularSlope).toBe(0);
  });

  it('reaches full strength on a trunk', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let step = 0; step < 720; step += 1) {
      const angle = (step / 720) * Math.PI * 2;
      const { radiusScale } = barkRelief(angle, 0.8, THICK, 0.3, config);
      min = Math.min(min, radiusScale);
      max = Math.max(max, radiusScale);
    }
    // The cross-section is lobed, not circular — this is the whole point.
    expect(max - min).toBeGreaterThan(0.05);
    // …and it stays a trunk: a scale that could reach zero would pinch the
    // sweep into a self-intersecting knot.
    expect(min).toBeGreaterThan(0.7);
    expect(max).toBeLessThan(1.3);
  });

  it('closes around the ring, so the last vertex meets the first', () => {
    const first = barkRelief(0, 0.8, THICK, 0.3, config);
    const wrapped = barkRelief(Math.PI * 2, 0.8, THICK, 0.3, config);
    expect(wrapped.radiusScale).toBeCloseTo(first.radiusScale, 10);
    expect(wrapped.angularSlope).toBeCloseTo(first.angularSlope, 10);
  });

  it('publishes an angular slope that matches its own radius curve', () => {
    // The renderer tilts the normal by this number; if it disagreed with the
    // geometry the trunk would light as a cylinder while looking lobed.
    const epsilon = 1e-4;
    for (const angle of [0.3, 1.7, 3.4, 5.9]) {
      const here = barkRelief(angle, 0.8, THICK, 0.3, config);
      const ahead = barkRelief(angle + epsilon, 0.8, THICK, 0.3, config);
      const behind = barkRelief(angle - epsilon, 0.8, THICK, 0.3, config);
      const numeric = (ahead.radiusScale - behind.radiusScale) / (2 * epsilon);
      expect(here.angularSlope).toBeCloseTo(numeric / here.radiusScale, 5);
    }
  });

  it('varies along the branch, so a trunk is not an extrusion', () => {
    const low = barkRelief(0.7, 0, THICK, 0.3, config);
    const high = barkRelief(0.7, 1.4, THICK, 0.3, config);
    expect(Math.abs(high.radiusScale - low.radiusScale)).toBeGreaterThan(0.02);
  });

  it('is deterministic', () => {
    const a = barkRelief(2.2, 0.9, THICK, 1.4, config);
    const b = barkRelief(2.2, 0.9, THICK, 1.4, config);
    expect(a).toEqual(b);
    expect(Number.isFinite(a.radiusScale)).toBe(true);
    expect(Number.isFinite(a.angularSlope)).toBe(true);
  });
});

describe('bark striation', () => {
  it('stays resolvable by the rings that carry it', () => {
    // Measured, not chosen: the trunk carries 37 rings over ~2.8 engine units,
    // so ring spacing is about 0.082. At frequency 41 the striation wavelength
    // was 0.153 — 1.9 rings per wave, below Nyquist — and it aliased into
    // nothing at all, which is why the trunk still read smooth after it was
    // added. Four rings per wave is the floor for it to survive.
    const ringSpacing = 2.8 / 37;
    const wavelength = (Math.PI * 2) / config.striationFrequency;
    expect(wavelength / ringSpacing).toBeGreaterThanOrEqual(3.5);
  });

  it('is a tremble on the swelling, not a second set of swellings', () => {
    expect(config.striationFrequency).toBeGreaterThan(config.swellFrequency * 2);
    expect(config.striationDepthRatio).toBeLessThan(0.42);
  });
});
