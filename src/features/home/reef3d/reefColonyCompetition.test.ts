import { describe, expect, it } from 'vitest';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import {
  applyReefColonyCompetition,
  REEF_COLONY_COMPETITION_PASS,
  REEF_COLONY_COMPETITION_VERSION,
} from './reefColonyCompetition';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import type { ReefAllocatedSurfaceSlot } from './reefSurfaceSlots';

function emptyCounts(): Record<ReefColonyMorphotype, number> {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

function makePlan(
  entries: readonly {
    morphotype: ReefColonyMorphotype;
    x: number;
    z: number;
    footprint?: number;
  }[],
): { plan: ReefLivingCanopyPlan; slots: ReefAllocatedSurfaceSlot[] } {
  const counts = emptyCounts();
  const colonies = entries.map((entry, index): ReefLivingCanopyColony => {
    counts[entry.morphotype] += 1;
    const footprintRadius = entry.footprint ?? 0.32;
    return {
      id: `reef:competition:${entry.morphotype}:${index}`,
      sourceColonyId: `reef:source:competition:${entry.morphotype}:${index}`,
      sourceModule: entry.morphotype === 'encrusting' ? 'memories' : 'wishlist',
      morphotype: entry.morphotype,
      tier: entry.morphotype === 'encrusting' ? 'micro' : 'primary',
      seed: 7_101 + index * 433 + entry.morphotype.length * 37,
      emphasized: false,
      weight: 0.74,
      maturity: 0.86,
      footprintRadius,
      targetHeight: entry.morphotype === 'encrusting' ? 0.12 : 0.62,
      facingRad: 0.18 + index * 0.27,
      request: {
        id: `reef:competition:request:${index}`,
        sequence: index * 10 + 1,
        epochIndex: 1,
        preferred: { x: entry.x, y: 0.5, z: entry.z },
        footprintRadius,
      },
    };
  });
  return {
    plan: {
      colonies,
      requests: colonies.map((colony) => colony.request),
      morphotypeCounts: counts,
    },
    slots: colonies.map((colony, index): ReefAllocatedSurfaceSlot => ({
      requestId: colony.request.id,
      candidateId: `reef:competition:slot:${index}`,
      kind: 'registry',
      position: { x: entries[index]!.x, y: 0.5, z: entries[index]!.z },
      footprintRadius: colony.request.footprintRadius,
      clearanceRatio: 1,
      displacement: 0,
    })),
  };
}

describe('reef colony competition stage 5', () => {
  it('publishes the competition contract and remains deterministic', () => {
    expect(REEF_COLONY_COMPETITION_VERSION).toBe('reef-colony-competition-v1');
    expect(REEF_COLONY_COMPETITION_PASS).toContain('space-competition');
    const fixture = makePlan([
      { morphotype: 'massive', x: 0, z: 0 },
      { morphotype: 'branching', x: 0.48, z: 0.04 },
      { morphotype: 'plating', x: 1.03, z: 0.05 },
    ]);

    const first = applyReefColonyCompetition(fixture);
    const repeated = applyReefColonyCompetition(fixture);

    expect(repeated).toEqual(first);
    expect(first.diagnostics.pressuredCount).toBeGreaterThan(0);
    expect(first.diagnostics.maximumPressure).toBeGreaterThan(0);
  });

  it('lets crowded branching colonies trade width for height and redirect away', () => {
    const fixture = makePlan([
      { morphotype: 'massive', x: 0, z: 0, footprint: 0.36 },
      { morphotype: 'branching', x: 0.5, z: 0.02, footprint: 0.34 },
    ]);
    const original = fixture.plan.colonies[1]!;
    const result = applyReefColonyCompetition(fixture);
    const competed = result.plan.colonies[1]!;

    expect(competed.footprintRadius).toBeLessThan(original.footprintRadius);
    expect(competed.targetHeight).toBeGreaterThan(original.targetHeight);
    expect(competed.facingRad).not.toBe(original.facingRad);
    expect(result.diagnostics.redirectedCount).toBeGreaterThan(0);
    expect(result.diagnostics.heightCompetitionCount).toBeGreaterThan(0);
  });

  it('permits controlled partial overgrowth for encrusting colonies', () => {
    const fixture = makePlan([
      { morphotype: 'massive', x: 0, z: 0, footprint: 0.32 },
      { morphotype: 'encrusting', x: 0.6, z: 0, footprint: 0.18 },
    ]);
    const original = fixture.plan.colonies[1]!;
    const result = applyReefColonyCompetition(fixture);
    const competed = result.plan.colonies[1]!;

    expect(competed.footprintRadius).toBeGreaterThanOrEqual(original.footprintRadius);
    expect(competed.targetHeight).toBeLessThanOrEqual(original.targetHeight);
    expect(result.diagnostics.partialOvergrowthCount).toBeGreaterThanOrEqual(1);
  });

  it('keeps old colony outcomes append-only when a future colony appears', () => {
    const initial = makePlan([
      { morphotype: 'massive', x: 0, z: 0 },
      { morphotype: 'branching', x: 0.52, z: 0.03 },
      { morphotype: 'plating', x: 1.02, z: 0.08 },
    ]);
    const extended = makePlan([
      { morphotype: 'massive', x: 0, z: 0 },
      { morphotype: 'branching', x: 0.52, z: 0.03 },
      { morphotype: 'plating', x: 1.02, z: 0.08 },
      { morphotype: 'sea-fan', x: 1.34, z: 0.12 },
    ]);

    const first = applyReefColonyCompetition(initial);
    const grown = applyReefColonyCompetition(extended);

    expect(grown.plan.colonies.slice(0, first.plan.colonies.length))
      .toEqual(first.plan.colonies);
    expect(grown.plan.requests.slice(0, first.plan.requests.length))
      .toEqual(first.plan.requests);
  });
});
