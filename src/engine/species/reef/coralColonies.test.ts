import { describe, expect, it } from 'vitest';
import { buildReefComposition } from './composition';
import {
  buildReefCoralColonies,
  REEF_CORAL_COLONIES_VERSION,
  REEF_CORAL_MAX_COUNT,
} from './coralColonies';
import { buildReefCore, REEF_CORE_YEAR_DAYS } from './reefCore';
import { buildReefSurfaceSystem } from './surfaceSystem';
import { buildReefYearStructures } from './yearStructures';

const identity = {
  coupleId: 'couple:phase-5',
  relationshipStartDate: '2022-12-26',
};

function coloniesAt(years: number, extraDays = 60) {
  const core = buildReefCore({
    ...identity,
    daysTogether: Math.floor(years * REEF_CORE_YEAR_DAYS + extraDays),
  });
  const yearStructures = buildReefYearStructures({ core });
  const composition = buildReefComposition({ core, yearStructures });
  const surfaces = buildReefSurfaceSystem({ core, composition });
  const colonies = buildReefCoralColonies({ core, surfaces });
  return { core, surfaces, colonies };
}

describe('reef coral colonization phase 5', () => {
  it('is deterministic for identical reef state', () => {
    const first = coloniesAt(8).colonies;
    const second = coloniesAt(8).colonies;
    expect(second).toEqual(first);
    expect(first.version).toBe(REEF_CORAL_COLONIES_VERSION);
  });

  it('anchors every colony to one eligible Phase 4 patch', () => {
    const { surfaces, colonies } = coloniesAt(16);
    const patchById = new Map(surfaces.patches.map((patch) => [patch.id, patch]));
    const patchIds = new Set<string>();

    for (const colony of colonies.colonies) {
      const patch = patchById.get(colony.patchId);
      expect(patch).toBeDefined();
      expect(patch?.eligible).toBe(true);
      expect(patch?.sourceKind).not.toBe('CORE');
      expect(colony.sourceId).toBe(patch?.sourceId);
      expect(patchIds.has(colony.patchId)).toBe(false);
      patchIds.add(colony.patchId);
    }
  });

  it('uses at most one baseline colony per yearly structure', () => {
    const { colonies } = coloniesAt(30);
    const yearly = colonies.colonies.filter((colony) => colony.sourceKind === 'YEAR_STRUCTURE');
    const sourceIds = new Set(yearly.map((colony) => colony.sourceId));
    expect(sourceIds.size).toBe(yearly.length);
  });

  it('keeps mature earlier yearly colony identity and morphology immutable', () => {
    const five = coloniesAt(5).colonies.colonies.filter(
      (colony) => colony.sourceKind === 'YEAR_STRUCTURE',
    );
    const nine = coloniesAt(9).colonies.colonies.filter(
      (colony) => colony.sourceKind === 'YEAR_STRUCTURE' && colony.birthYear <= 5,
    );

    expect(nine.map((colony) => colony.id)).toEqual(five.map((colony) => colony.id));
    for (let index = 0; index < five.length; index += 1) {
      const before = five[index]!;
      const after = nine[index]!;
      expect(after.patchId).toBe(before.patchId);
      expect(after.seed).toBe(before.seed);
      expect(after.morphotype).toBe(before.morphotype);
      expect(after.radius).toBe(before.radius);
      expect(after.height).toBe(before.height);
      expect(after.branchCount).toBe(before.branchCount);
      expect(after.tangentRotation).toBe(before.tangentRotation);
      expect(after.position).toEqual(before.position);
      expect(after.normal).toEqual(before.normal);
    }
  });

  it('enforces colony competition spacing without moving accepted colonies', () => {
    const { colonies } = coloniesAt(40);
    for (let left = 0; left < colonies.colonies.length; left += 1) {
      const a = colonies.colonies[left]!;
      for (let right = left + 1; right < colonies.colonies.length; right += 1) {
        const b = colonies.colonies[right]!;
        const distance = Math.hypot(
          a.position.x - b.position.x,
          a.position.y - b.position.y,
          a.position.z - b.position.z,
        );
        expect(distance + 1e-6).toBeGreaterThanOrEqual(
          a.separationRadius + b.separationRadius,
        );
      }
    }
  });

  it('emits valid growth, orientation and size metadata', () => {
    const { colonies } = coloniesAt(20);
    expect(colonies.colonies.length).toBeGreaterThan(0);
    for (const colony of colonies.colonies) {
      expect(colony.growth).toBeGreaterThanOrEqual(0);
      expect(colony.growth).toBeLessThanOrEqual(1);
      expect(colony.vitality).toBeGreaterThanOrEqual(0);
      expect(colony.vitality).toBeLessThanOrEqual(1);
      expect(colony.radius).toBeGreaterThan(0);
      expect(colony.height).toBeGreaterThan(0);
      expect(Math.hypot(colony.normal.x, colony.normal.y, colony.normal.z)).toBeCloseTo(1, 5);
    }
  });

  it('stays bounded at the 50 year horizon', () => {
    const { colonies } = coloniesAt(50, 0);
    expect(colonies.diagnostics.colonyCount).toBeGreaterThan(10);
    expect(colonies.diagnostics.colonyCount).toBeLessThanOrEqual(REEF_CORAL_MAX_COUNT);
    expect(colonies.diagnostics.boundedForMobile).toBe(true);
    expect(colonies.diagnostics.platformColonyCount).toBeGreaterThan(0);
    expect(colonies.diagnostics.yearlyColonyCount).toBeGreaterThan(0);
    expect(colonies.diagnostics.averageVitality).toBeGreaterThan(0);
  });
});
