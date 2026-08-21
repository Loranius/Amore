import { describe, expect, it } from 'vitest';
import { resolveReefRenderProfile } from './reefPerformanceProfile';

describe('reef renderer performance profile', () => {
  it('keeps strong touch phones on the balanced mobile budget', () => {
    const profile = resolveReefRenderProfile({
      coarsePointer: true,
      deviceMemory: 8,
      devicePixelRatio: 3,
      hardwareConcurrency: 8,
      viewportWidth: 412,
    });

    expect(profile.quality).toBe('balanced');
    expect(profile.maxDpr).toBe(1.2);
    expect(profile.useNativeFish).toBe(false);
    expect(profile.showWhale).toBe(false);
    expect(profile.distantFishSchoolCount).toBe(2);
  });

  it('uses the low tier for constrained devices', () => {
    const profile = resolveReefRenderProfile({
      coarsePointer: true,
      deviceMemory: 2,
      devicePixelRatio: 2,
      hardwareConcurrency: 4,
      viewportWidth: 390,
    });

    expect(profile.quality).toBe('low');
    expect(profile.maxDpr).toBe(1);
    expect(profile.lightweightFishLimit).toBe(6);
    expect(profile.showSessileLife).toBe(false);
  });

  it('retains the full visual budget on capable desktop viewports', () => {
    const profile = resolveReefRenderProfile({
      coarsePointer: false,
      deviceMemory: 8,
      devicePixelRatio: 2,
      hardwareConcurrency: 12,
      viewportWidth: 1440,
    });

    expect(profile.quality).toBe('high');
    expect(profile.useNativeFish).toBe(true);
    expect(profile.showWhale).toBe(true);
    expect(profile.directionalLights).toBe(3);
  });

  it('defaults unknown narrow devices to the balanced tier', () => {
    expect(resolveReefRenderProfile({
      coarsePointer: false,
      devicePixelRatio: 2,
      viewportWidth: 430,
    }).quality).toBe('balanced');
  });
});
