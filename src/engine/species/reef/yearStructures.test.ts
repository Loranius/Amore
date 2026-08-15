import { describe, expect, it } from 'vitest';
import { stableHash32 } from '../../evolution';
import { buildReefCore, REEF_CORE_MAX_DAYS, REEF_CORE_YEAR_DAYS } from './reefCore';
import {
  buildReefYearStructures,
  REEF_YEAR_GROWTH_DAYS,
  REEF_YEAR_STRUCTURES_VERSION,
} from './yearStructures';

const identity = {
  coupleId: 'couple:12-34',
  relationshipStartDate: '2022-12-26',
};

function coreAtYears(years: number, extraDays = 0) {
  return buildReefCore({
    ...identity,
    daysTogether: Math.ceil(years * REEF_CORE_YEAR_DAYS + extraDays),
  });
}

describe('reef year structures phase 2', () => {
  it('is deterministic for identical core input', () => {
    const core = coreAtYears(8, 90);
    const first = buildReefYearStructures({ core });
    const second = buildReefYearStructures({ core });
    expect(second).toEqual(first);
    expect(first.version).toBe(REEF_YEAR_STRUCTURES_VERSION);
  });

  it('creates exactly one main structure per completed relationship year', () => {
    const fourYears = buildReefYearStructures({ core: coreAtYears(4, 45) });
    const fiftyYears = buildReefYearStructures({
      core: buildReefCore({ ...identity, daysTogether: REEF_CORE_MAX_DAYS }),
    });
    expect(fourYears.structures).toHaveLength(4);
    expect(fourYears.structures.map((structure) => structure.yearIndex)).toEqual([1, 2, 3, 4]);
    expect(fiftyYears.structures).toHaveLength(50);
    expect(fiftyYears.structures[49]?.growth).toBe(1);
  });

  it('uses the exact permanent year seed contract', () => {
    const core = coreAtYears(5, 60);
    const result = buildReefYearStructures({ core });
    result.structures.forEach((structure) => {
      expect(structure.seed).toBe(stableHash32(`${core.identity.reefSeed}:year:${structure.yearIndex}`));
    });
  });

  it('never moves or retypes established years when later years are added', () => {
    const yearFour = buildReefYearStructures({ core: coreAtYears(4, 60) });
    const yearNine = buildReefYearStructures({ core: coreAtYears(9, 60) });
    expect(yearNine.structures.slice(0, 4)).toEqual(yearFour.structures);
  });

  it('keeps accepted main-structure footprints collision free', () => {
    const result = buildReefYearStructures({ core: coreAtYears(30, 90) });
    expect(result.diagnostics.collisionFree).toBe(true);
    expect(result.diagnostics.minimumClearance ?? 0).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.waterWindowCount).toBeGreaterThanOrEqual(1);
  });

  it('supports explicit annual saturation without requiring portal module data', () => {
    const core = coreAtYears(4, 60);
    const result = buildReefYearStructures({ core, yearSaturations: [0, 0.25, 0.75, 1] });
    expect(result.structures.map((structure) => structure.saturation)).toEqual([0, 0.25, 0.75, 1]);
    expect(result.structures.every((structure) => structure.saturationSource === 'input')).toBe(true);
    expect(result.structures[0]?.archetype).not.toBe('ARCH');
  });

  it('grows a newly completed annual structure over the thirty-day window', () => {
    const partialCore = buildReefCore({
      ...identity,
      daysTogether: Math.ceil(REEF_CORE_YEAR_DAYS + REEF_YEAR_GROWTH_DAYS / 2),
    });
    const matureCore = buildReefCore({
      ...identity,
      daysTogether: Math.ceil(REEF_CORE_YEAR_DAYS + REEF_YEAR_GROWTH_DAYS + 2),
    });
    const partial = buildReefYearStructures({ core: partialCore }).structures[0];
    const mature = buildReefYearStructures({ core: matureCore }).structures[0];
    expect(partial?.growth).toBeGreaterThan(0);
    expect(partial?.growth).toBeLessThan(1);
    expect(mature?.growth).toBe(1);
    expect(partial?.seed).toBe(mature?.seed);
    expect(partial?.center).toEqual(mature?.center);
    expect(partial?.archetype).toBe(mature?.archetype);
  });
});
