import { describe, expect, it } from 'vitest';
import type { GrowthSurfaceRegion } from './surfaceAtlas';
import { sampleGrowthRegionSite } from './surface';
import type { GrowthBody, UniversalGrowthInstruction } from './types';

const host = {
  id: 'mother', species: 'crystal', generation: 0, seed: 42,
  anchor: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 },
  skeletonLength: 1.64, skeletonRadius: 0.34, surfaceRadiusScale: 0.76,
} as GrowthBody;

const region = {
  id: 'mother:region:4:3', sourceBodyId: 'mother', bandIndex: 4, sectorIndex: 3,
  hostT: 0.9, azimuthRad: 1.2,
  surfacePosition: { x: 0.12, y: 1.476, z: 0.04 },
  surfaceNormal: { x: 0.94, y: 0.08, z: 0.33 },
  growthPotential: 0.8, surfaceStress: 0.1, localDensity: 0.1,
  growthShadow: 0, competitionPressure: 0,
} as GrowthSurfaceRegion;

function instruction(role: 'dominant' | 'satellite') {
  return {
    id: role, seed: 123456, preferredAzimuthRad: 0.7, preferredElevation: 0.72,
    directionInheritance: 0.3, minUpwardComponent: 0.42,
    radialScale: 0.2, attachmentDepth: 0.4,
    growthCenterRole: role,
  } as UniversalGrowthInstruction;
}

describe('Crystal basal placement sampler', () => {
  it('moves a dominant from an upper atlas region into the monarch basal band', () => {
    const site = sampleGrowthRegionSite(host, region, instruction('dominant'), 0);
    expect(site.hostT).toBeGreaterThanOrEqual(0.15);
    expect(site.hostT).toBeLessThanOrEqual(0.33);
    expect(site.surfacePoint.y).toBeCloseTo(host.skeletonLength * site.hostT, 5);
  });

  it('preserves the atlas height for local supporting members', () => {
    const site = sampleGrowthRegionSite(host, region, instruction('satellite'), 0);
    expect(site.hostT).toBe(0.9);
    expect(site.surfacePoint).toEqual(region.surfacePosition);
  });
});
