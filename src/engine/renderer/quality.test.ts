import { describe, expect, it } from 'vitest';
import {
  crystalRenderScale,
  resolveCrystalRendererQuality,
  type CrystalRendererCapabilities,
} from './quality';

function device(overrides: Partial<CrystalRendererCapabilities> = {}): CrystalRendererCapabilities {
  return {
    webgl: true,
    webgl2: true,
    deviceMemoryGb: 8,
    hardwareConcurrency: 8,
    devicePixelRatio: 2,
    ...overrides,
  };
}

describe('crystal renderer quality', () => {
  it('does not punish a flagship for having a dense screen', () => {
    // Regression: `dpr >= 3` alone forced the lowest optical tier, so a current
    // flagship (eight cores, eight gigabytes, ratio 3) got the same crystal as
    // a four-year-old budget handset — iridescence off, reflection halved. The
    // couple with the best phone saw the plainest artifact.
    expect(resolveCrystalRendererQuality(device({ devicePixelRatio: 3 }))).toBe('high');
    expect(resolveCrystalRendererQuality(device({ devicePixelRatio: 3.5 }))).toBe('high');
  });

  it('still steps down when the pixel count outruns any device we can detect', () => {
    expect(resolveCrystalRendererQuality(device({ devicePixelRatio: 4 }))).toBe('balanced');
  });

  it('reads the device from memory and cores, not from its screen', () => {
    expect(resolveCrystalRendererQuality(device({ deviceMemoryGb: 4 }))).toBe('low');
    expect(resolveCrystalRendererQuality(device({ hardwareConcurrency: 4 }))).toBe('low');
    expect(resolveCrystalRendererQuality(device({ deviceMemoryGb: 6 }))).toBe('balanced');
    expect(resolveCrystalRendererQuality(device({ webgl2: false }))).toBe('balanced');
  });

  it('never upgrades hardware it cannot see', () => {
    // Safari reports neither memory nor cores. Guessing high there would hand a
    // weak device the full pipeline.
    expect(resolveCrystalRendererQuality(device({
      deviceMemoryGb: null,
      hardwareConcurrency: null,
    }))).toBe('low');
    expect(resolveCrystalRendererQuality(device({ webgl: false }))).toBe('fallback');
  });

  it('survives a nonsense pixel ratio', () => {
    for (const devicePixelRatio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const quality = resolveCrystalRendererQuality(device({ devicePixelRatio }));
      expect(['high', 'balanced', 'low', 'fallback']).toContain(quality);
      expect(Number.isFinite(crystalRenderScale(quality, devicePixelRatio))).toBe(true);
    }
  });
});

describe('crystal render scale', () => {
  it('is where a dense screen actually gets paid for', () => {
    // Sharpness is what a 3x screen has to spare; iridescence is the crystal.
    expect(crystalRenderScale('high', 3)).toBe(2);
    expect(crystalRenderScale('balanced', 3)).toBe(1.75);
    expect(crystalRenderScale('low', 3)).toBe(1.4);
    expect(crystalRenderScale('fallback', 3)).toBe(1);
  });

  it('never renders more pixels than the screen asked for', () => {
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      expect(crystalRenderScale(quality, 1)).toBe(1);
      expect(crystalRenderScale(quality, 1.5)).toBeLessThanOrEqual(1.5);
    }
  });

  it('gives a weaker tier a lower ceiling', () => {
    const ceilings = (['high', 'balanced', 'low', 'fallback'] as const)
      .map((quality) => crystalRenderScale(quality, 4));
    for (let index = 1; index < ceilings.length; index += 1) {
      expect(ceilings[index]!).toBeLessThan(ceilings[index - 1]!);
    }
  });
});
