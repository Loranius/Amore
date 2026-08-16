import { describe, expect, it } from 'vitest';
import {
  buildReefRockBiofilmProfile,
  REEF_ROCK_BIOFILM_VERSION,
} from './reefRockBiofilm';

describe('reef rock biofilm profile', () => {
  it('keeps a young quiet reef mostly clean', () => {
    const profile = buildReefRockBiofilmProfile({
      identitySeed: 42,
      completedYears: 0,
      colonization: 0,
      biodiversity: 0,
      substrateMaturity: 0,
    });

    expect(profile.version).toBe(REEF_ROCK_BIOFILM_VERSION);
    expect(profile.coverage).toBe(0.08);
    expect(profile.algaeTintStrength).toBe(0.025);
    expect(profile.creviceDarkening).toBe(0.035);
    expect(profile.roughnessVariation).toBe(0.025);
  });

  it('ages mature ecological rock without turning it into a full biofilm carpet', () => {
    const young = buildReefRockBiofilmProfile({
      identitySeed: 7,
      completedYears: 1,
      colonization: 0.12,
      biodiversity: 0.08,
      substrateMaturity: 0.18,
    });
    const mature = buildReefRockBiofilmProfile({
      identitySeed: 7,
      completedYears: 30,
      colonization: 1,
      biodiversity: 1,
      substrateMaturity: 1,
    });

    expect(mature.coverage).toBeGreaterThan(young.coverage);
    expect(mature.algaeTintStrength).toBeGreaterThan(young.algaeTintStrength);
    expect(mature.creviceDarkening).toBeGreaterThan(young.creviceDarkening);
    expect(mature.roughnessVariation).toBeGreaterThan(young.roughnessVariation);
    expect(mature.coverage).toBeLessThanOrEqual(0.58);
    expect(mature.algaeTintStrength).toBeLessThanOrEqual(0.11);
    expect(mature.creviceDarkening).toBeLessThanOrEqual(0.12);
  });

  it('keeps the pattern deterministic per pair identity', () => {
    const common = {
      completedYears: 8,
      colonization: 0.64,
      biodiversity: 0.52,
      substrateMaturity: 0.7,
    };
    const first = buildReefRockBiofilmProfile({ identitySeed: 123_456, ...common });
    const second = buildReefRockBiofilmProfile({ identitySeed: 123_456, ...common });
    const otherPair = buildReefRockBiofilmProfile({ identitySeed: 654_321, ...common });

    expect(second).toEqual(first);
    expect(otherPair.patternSeed).not.toBe(first.patternSeed);
    expect(otherPair.coverage).toBe(first.coverage);
  });
});
