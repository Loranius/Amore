import { describe, expect, it } from 'vitest';
import { stableHash32 } from '../../evolution';
import {
  buildReefCore,
  REEF_CORE_MAX_DAYS,
  REEF_CORE_MAX_YEARS,
  REEF_CORE_SEED_NAMESPACE,
  reefDaysTogether,
} from './reefCore';

const identity = {
  coupleId: 'couple:12-34',
  relationshipStartDate: '2022-12-26',
};

describe('reef core phase 1', () => {
  it('is deterministic for identical input', () => {
    const first = buildReefCore({ ...identity, daysTogether: 1_328 });
    const second = buildReefCore({ ...identity, daysTogether: 1_328 });

    expect(second).toEqual(first);
  });

  it('implements the exact permanent and derived seed contracts', () => {
    const core = buildReefCore({ ...identity, daysTogether: 1_328 });
    const expectedReefSeed = stableHash32(
      `${identity.coupleId}${identity.relationshipStartDate}${REEF_CORE_SEED_NAMESPACE}`,
    );

    expect(core.identity.reefSeed).toBe(expectedReefSeed);
    expect(core.identity.coreSeed).toBe(stableHash32(`${expectedReefSeed}:core`));
    expect(core.identity.platformSeed).toBe(stableHash32(`${expectedReefSeed}:platform`));
  });

  it('keeps permanent identity seeds when only age changes', () => {
    const young = buildReefCore({ ...identity, daysTogether: 50 });
    const mature = buildReefCore({ ...identity, daysTogether: 12_000 });

    expect(mature.identity.reefSeed).toBe(young.identity.reefSeed);
    expect(mature.identity.coreSeed).toBe(young.identity.coreSeed);
    expect(mature.identity.platformSeed).toBe(young.identity.platformSeed);
    expect(mature.identity.identitySignature).toBe(young.identity.identitySignature);
    expect(mature.signature).not.toBe(young.signature);
  });

  it('changes permanent seed when permanent relationship identity changes', () => {
    const baseline = buildReefCore({ ...identity, daysTogether: 1_000 });
    const anotherCouple = buildReefCore({
      ...identity,
      coupleId: 'couple:12-35',
      daysTogether: 1_000,
    });
    const anotherStart = buildReefCore({
      ...identity,
      relationshipStartDate: '2022-12-27',
      daysTogether: 1_000,
    });

    expect(anotherCouple.identity.reefSeed).not.toBe(baseline.identity.reefSeed);
    expect(anotherStart.identity.reefSeed).not.toBe(baseline.identity.reefSeed);
  });

  it('clamps the chronological scale to the 0-50 year contract', () => {
    const beforeStart = buildReefCore({ ...identity, daysTogether: -100 });
    const afterHorizon = buildReefCore({
      ...identity,
      daysTogether: REEF_CORE_MAX_DAYS + 5_000,
    });

    expect(beforeStart.age.daysTogether).toBe(0);
    expect(beforeStart.age.progress).toBe(0);
    expect(afterHorizon.age.daysTogether).toBe(REEF_CORE_MAX_DAYS);
    expect(afterHorizon.age.progress).toBe(1);
    expect(afterHorizon.age.completedYears).toBe(REEF_CORE_MAX_YEARS);
  });

  it('keeps core and platform growth monotonic across the full horizon', () => {
    const checkpoints = [0, 365, 3 * 365, 10 * 365, 25 * 365, REEF_CORE_MAX_DAYS]
      .map((daysTogether) => buildReefCore({ ...identity, daysTogether }));

    for (let index = 1; index < checkpoints.length; index += 1) {
      const previous = checkpoints[index - 1]!;
      const current = checkpoints[index]!;
      expect(current.age.progress).toBeGreaterThan(previous.age.progress);
      expect(current.dimensions.radiusX).toBeGreaterThan(previous.dimensions.radiusX);
      expect(current.dimensions.radiusZ).toBeGreaterThan(previous.dimensions.radiusZ);
      expect(current.dimensions.height).toBeGreaterThan(previous.dimensions.height);
      expect(current.platform.radiusX).toBeGreaterThan(previous.platform.radiusX);
      expect(current.platform.radiusZ).toBeGreaterThan(previous.platform.radiusZ);
    }
  });

  it('derives days together through the accepted explicit-date calendar', () => {
    expect(reefDaysTogether('2022-12-26', '2022-12-26')).toBe(0);
    expect(reefDaysTogether('2022-12-26', '2022-12-27')).toBe(1);
    expect(reefDaysTogether('not-a-date', '2022-12-27')).toBeNull();
  });
});
