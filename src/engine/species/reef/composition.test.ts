import { describe, expect, it } from 'vitest';
import { buildReefCore, REEF_CORE_YEAR_DAYS } from './reefCore';
import { buildReefYearStructures } from './yearStructures';
import {
  buildReefComposition,
  REEF_COMPOSITION_VERSION,
  scoreReefComposition,
} from './composition';

const identity = {
  coupleId: 'couple:phase-3',
  relationshipStartDate: '2022-12-26',
};

function coreAt(years: number, extraDays = 60) {
  return buildReefCore({
    ...identity,
    daysTogether: Math.floor(years * REEF_CORE_YEAR_DAYS + extraDays),
  });
}

function compositionAt(years: number, extraDays = 60) {
  const core = coreAt(years, extraDays);
  const yearStructures = buildReefYearStructures({ core });
  return { core, yearStructures, composition: buildReefComposition({ core, yearStructures }) };
}

describe('reef composition phase 3', () => {
  it('is deterministic for identical input', () => {
    const first = compositionAt(8).composition;
    const second = compositionAt(8).composition;
    expect(second).toEqual(first);
    expect(first.version).toBe(REEF_COMPOSITION_VERSION);
  });

  it('keeps earlier year transforms immutable when a later year appears', () => {
    const fourYears = compositionAt(4).composition;
    const fiveYears = compositionAt(5).composition;

    expect(fourYears.structures).toHaveLength(4);
    expect(fiveYears.structures).toHaveLength(5);
    for (let index = 0; index < fourYears.structures.length; index += 1) {
      const before = fourYears.structures[index]!;
      const after = fiveYears.structures[index]!;
      expect(after.id).toBe(before.id);
      expect(after.seed).toBe(before.seed);
      expect(after.center).toEqual(before.center);
      expect(after.rotationY).toBe(before.rotationY);
      expect(after.composition.attempt).toBe(before.composition.attempt);
    }
  });

  it('never changes permanent structure identity or morphology', () => {
    const { yearStructures, composition } = compositionAt(12);
    for (let index = 0; index < yearStructures.structures.length; index += 1) {
      const source = yearStructures.structures[index]!;
      const composed = composition.structures[index]!;
      expect(composed.id).toBe(source.id);
      expect(composed.yearIndex).toBe(source.yearIndex);
      expect(composed.seed).toBe(source.seed);
      expect(composed.archetype).toBe(source.archetype);
      expect(composed.shape).toEqual(source.shape);
      expect(composed.footprintRadius).toBe(source.footprintRadius);
      expect(composed.composition.sourceSignature).toBe(source.signature);
    }
  });

  it('uses the agreed weighted composition formula exactly', () => {
    const { core, composition } = compositionAt(7);
    const result = scoreReefComposition(core, composition.structures);
    const score = result.score;
    const expected = Math.round((
      score.coreVisibility * 0.25
      + score.openWater * 0.20
      + score.heightBalance * 0.15
      + score.radialBalance * 0.15
      + score.silhouette * 0.15
      + score.collision * 0.10
    ) * 1_000_000) / 1_000_000;
    expect(score.total).toBe(expected);
  });

  it('keeps the normal generated layout collision free', () => {
    const { composition } = compositionAt(25);
    expect(composition.diagnostics.collisionFree).toBe(true);
    expect(composition.diagnostics.minimumClearance ?? 0).toBeGreaterThanOrEqual(0);
    expect(composition.diagnostics.structureCount).toBe(25);
  });

  it('repairs only the current bad structure when an overlap is injected', () => {
    const core = coreAt(4);
    const source = buildReefYearStructures({ core });
    const first = source.structures[0]!;
    const second = source.structures[1]!;
    const broken = {
      ...source,
      structures: [
        first,
        {
          ...second,
          center: { ...second.center, x: first.center.x, z: first.center.z },
        },
        ...source.structures.slice(2),
      ],
    };

    const composed = buildReefComposition({ core, yearStructures: broken });
    expect(composed.structures[0]!.center).toEqual(first.center);
    expect(composed.structures[0]!.rotationY).toBe(first.rotationY);
    expect(composed.structures[1]!.composition.adjusted).toBe(true);
    expect(composed.diagnostics.collisionFree).toBe(true);
  });

  it('preserves open water and a readable core at the 50 year horizon', () => {
    const { composition } = compositionAt(50, 0);
    expect(composition.structures).toHaveLength(50);
    expect(composition.diagnostics.freeWaterFraction).toBeGreaterThan(0.2);
    expect(composition.diagnostics.waterWindowCount).toBeGreaterThanOrEqual(3);
    expect(composition.diagnostics.coreVisibility).toBeGreaterThanOrEqual(0.35);
  });
});
