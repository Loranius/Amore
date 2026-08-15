import { describe, expect, it } from 'vitest';
import { buildReefComposition } from './composition';
import { buildReefCore, REEF_CORE_YEAR_DAYS } from './reefCore';
import {
  buildReefSurfaceSystem,
  REEF_SURFACE_CORE_SAMPLES,
  REEF_SURFACE_MAX_PATCHES,
  REEF_SURFACE_MIN_NORMAL_Y,
  REEF_SURFACE_MIN_SUITABILITY,
  REEF_SURFACE_PLATFORM_SAMPLES,
  REEF_SURFACE_VERSION,
  REEF_SURFACE_YEAR_SAMPLES,
} from './surfaceSystem';
import { buildReefYearStructures } from './yearStructures';

const identity = {
  coupleId: 'couple:phase-4',
  relationshipStartDate: '2022-12-26',
};

function surfaceAt(years: number, extraDays = 60) {
  const core = buildReefCore({
    ...identity,
    daysTogether: Math.floor(years * REEF_CORE_YEAR_DAYS + extraDays),
  });
  const yearStructures = buildReefYearStructures({ core });
  const composition = buildReefComposition({ core, yearStructures });
  const surfaces = buildReefSurfaceSystem({ core, composition });
  return { core, yearStructures, composition, surfaces };
}

describe('reef surface system phase 4', () => {
  it('is deterministic for identical reef state', () => {
    const first = surfaceAt(8).surfaces;
    const second = surfaceAt(8).surfaces;
    expect(second).toEqual(first);
    expect(first.version).toBe(REEF_SURFACE_VERSION);
  });

  it('creates the bounded core, platform and yearly surface budgets', () => {
    const { surfaces } = surfaceAt(10);
    expect(surfaces.diagnostics.corePatchCount).toBe(REEF_SURFACE_CORE_SAMPLES);
    expect(surfaces.diagnostics.platformPatchCount).toBe(REEF_SURFACE_PLATFORM_SAMPLES);
    expect(surfaces.diagnostics.yearPatchCount).toBe(10 * REEF_SURFACE_YEAR_SAMPLES);
    expect(surfaces.diagnostics.patchCount).toBe(
      REEF_SURFACE_CORE_SAMPLES + REEF_SURFACE_PLATFORM_SAMPLES + 10 * REEF_SURFACE_YEAR_SAMPLES,
    );
    expect(surfaces.diagnostics.boundedForMobile).toBe(true);
  });

  it('emits finite normalized geometry metadata only', () => {
    const { surfaces } = surfaceAt(12);
    for (const patch of surfaces.patches) {
      const values = [
        patch.position.x,
        patch.position.y,
        patch.position.z,
        patch.normal.x,
        patch.normal.y,
        patch.normal.z,
        patch.slopeDegrees,
        patch.height01,
        patch.exposure,
        patch.stability,
        patch.suitability,
        patch.capacity,
      ];
      expect(values.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(patch.normal.x, patch.normal.y, patch.normal.z)).toBeCloseTo(1, 5);
      expect(patch.height01).toBeGreaterThanOrEqual(0);
      expect(patch.height01).toBeLessThanOrEqual(1);
      expect(patch.exposure).toBeGreaterThanOrEqual(0);
      expect(patch.exposure).toBeLessThanOrEqual(1);
      expect(patch.suitability).toBeGreaterThanOrEqual(0);
      expect(patch.suitability).toBeLessThanOrEqual(1);
      expect(patch.capacity).toBeGreaterThanOrEqual(0);
      expect(patch.capacity).toBeLessThanOrEqual(1);
    }
  });

  it('never marks underside or weak patches as coral-eligible', () => {
    const { surfaces } = surfaceAt(20);
    const eligible = surfaces.patches.filter((patch) => patch.eligible);
    expect(eligible.length).toBeGreaterThan(0);
    for (const patch of eligible) {
      expect(patch.normal.y).toBeGreaterThanOrEqual(REEF_SURFACE_MIN_NORMAL_Y);
      expect(patch.stability).toBeGreaterThanOrEqual(0.42);
      expect(patch.suitability).toBeGreaterThanOrEqual(REEF_SURFACE_MIN_SUITABILITY);
      expect(patch.capacity).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('keeps old yearly surface identities stable when later years appear', () => {
    const five = surfaceAt(5).surfaces.patches.filter((patch) => patch.sourceKind === 'YEAR_STRUCTURE');
    const nine = surfaceAt(9).surfaces.patches.filter((patch) => patch.sourceKind === 'YEAR_STRUCTURE');
    expect(five).toHaveLength(5 * REEF_SURFACE_YEAR_SAMPLES);
    expect(nine).toHaveLength(9 * REEF_SURFACE_YEAR_SAMPLES);

    for (let index = 0; index < five.length; index += 1) {
      const before = five[index]!;
      const after = nine[index]!;
      expect(after.id).toBe(before.id);
      expect(after.seed).toBe(before.seed);
      expect(after.sourceId).toBe(before.sourceId);
      expect(after.surfaceClass).toBe(before.surfaceClass);
      expect(after.normal).toEqual(before.normal);
      expect(after.suitability).toBe(before.suitability);
      expect(after.position.x).toBe(before.position.x);
      expect(after.position.z).toBe(before.position.z);
    }
  });

  it('keeps a just-born yearly structure unavailable until it has physical growth', () => {
    const exactAnniversary = surfaceAt(1, 0).surfaces.patches.filter(
      (patch) => patch.sourceKind === 'YEAR_STRUCTURE',
    );
    expect(exactAnniversary).toHaveLength(REEF_SURFACE_YEAR_SAMPLES);
    expect(exactAnniversary.every((patch) => patch.capacity === 0 && !patch.eligible)).toBe(true);
  });

  it('stays within the mobile patch ceiling at the 50 year horizon', () => {
    const { surfaces } = surfaceAt(50, 0);
    expect(surfaces.diagnostics.patchCount).toBe(REEF_SURFACE_MAX_PATCHES);
    expect(surfaces.diagnostics.boundedForMobile).toBe(true);
    expect(surfaces.diagnostics.eligiblePatchCount).toBeGreaterThan(100);
    expect(surfaces.diagnostics.totalCapacity).toBeGreaterThan(0);
  });
});
