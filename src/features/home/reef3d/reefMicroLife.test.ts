import { describe, expect, it } from 'vitest';
import { buildReefMicroLifePlan, REEF_MICRO_LIFE_VERSION } from './reefMicroLife';

describe('reef micro life plan', () => {
  it('stays empty when there is no photo or media history', () => {
    const plan = buildReefMicroLifePlan({
      identitySeed: 42,
      foundationRadius: 5,
      photoCount: 0,
      mediaCount: 0,
    });

    expect(plan.version).toBe(REEF_MICRO_LIFE_VERSION);
    expect(plan.desired).toEqual({
      encrustingPatches: 0,
      sponges: 0,
      creviceAccents: 0,
    });
    expect(plan.candidates).toEqual([]);
  });

  it('turns photo history into capped encrusting life without one-photo-one-mesh growth', () => {
    const small = buildReefMicroLifePlan({
      identitySeed: 7,
      foundationRadius: 5,
      photoCount: 8,
      mediaCount: 0,
    });
    const large = buildReefMicroLifePlan({
      identitySeed: 7,
      foundationRadius: 5,
      photoCount: 800,
      mediaCount: 0,
    });

    expect(small.desired.encrustingPatches).toBeGreaterThan(0);
    expect(large.desired.encrustingPatches).toBeGreaterThan(small.desired.encrustingPatches);
    expect(large.desired.encrustingPatches).toBeLessThanOrEqual(40);
    expect(large.candidates.length).toBeLessThanOrEqual(240);
  });

  it('keeps the existing mature-media threshold for sponge unlocks', () => {
    const before = buildReefMicroLifePlan({
      identitySeed: 11,
      foundationRadius: 4,
      photoCount: 12,
      mediaCount: 19,
    });
    const after = buildReefMicroLifePlan({
      identitySeed: 11,
      foundationRadius: 4,
      photoCount: 12,
      mediaCount: 20,
    });

    expect(before.desired.sponges).toBe(0);
    expect(after.desired.sponges).toBeGreaterThan(0);
  });

  it('is deterministic and keeps probes inside the living foundation band', () => {
    const input = {
      identitySeed: 912345,
      foundationRadius: 6.2,
      photoCount: 120,
      mediaCount: 48,
    };
    const first = buildReefMicroLifePlan(input);
    const second = buildReefMicroLifePlan(input);

    expect(second).toEqual(first);
    for (const candidate of first.candidates) {
      const radius = Math.hypot(candidate.x, candidate.z);
      expect(candidate.radialRatio).toBeGreaterThanOrEqual(0.16);
      expect(candidate.radialRatio).toBeLessThanOrEqual(0.94);
      expect(radius).toBeLessThanOrEqual(input.foundationRadius * 0.94 + 1e-6);
    }
  });
});
