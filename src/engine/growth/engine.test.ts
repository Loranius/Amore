import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_GROWTH_ENGINE_CONFIG } from './config';
import { buildGrowthState } from './engine';
import type { GrowthBody, UniversalGrowthBlueprint } from './types';

const AS_OF = '2026-07-29T09:00:00Z';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.7, remembrance: 0.55 },
    portalActivity: 0.5,
  },
  {
    id: 'first-trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.9, remembrance: 0.35 },
    portalActivity: 0.3,
  },
  {
    id: 'photo-day',
    occurredAt: '2024-09-04T12:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.62, culture: 0.18 },
    portalActivity: 0.16,
  },
  {
    id: 'anniversary-one',
    occurredAt: '2025-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { stability: 0.72, significance: 0.58, remembrance: 0.45 },
    portalActivity: 0.22,
  },
];

function growthBlueprint(events: readonly EvolutionEventInput[]): UniversalGrowthBlueprint {
  const artifact = buildArtifactBlueprint({
    coupleId: 'growth-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const crystal = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: AS_OF, rulesVersion: '1.0.0' },
  });
  return crystalToGrowthBlueprint(crystal);
}

function stableBody(body: GrowthBody): Omit<GrowthBody, 'renderedLength' | 'renderedRadius' | 'maturity'> {
  const { renderedLength: _renderedLength, renderedRadius: _renderedRadius, maturity: _maturity, ...stable } = body;
  return stable;
}

describe('Universal Growth Engine', () => {
  it('is deterministic and independent of instruction array order', () => {
    const blueprint = growthBlueprint(BASE_EVENTS);
    const forward = buildGrowthState({ blueprint, config: DEFAULT_GROWTH_ENGINE_CONFIG });
    const reversed = buildGrowthState({
      blueprint: { ...blueprint, instructions: [...blueprint.instructions].reverse() },
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });

    expect(reversed).toEqual(forward);
  });

  it('attaches every non-root body to an existing analytical surface', () => {
    const state = buildGrowthState({
      blueprint: growthBlueprint(BASE_EVENTS),
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const ids = new Set(state.bodies.map((body) => body.id));

    expect(state.bodies).toHaveLength(BASE_EVENTS.length + 1);
    expect(state.bodies[0]?.hostBodyId).toBeNull();
    expect(state.surfaceMap.occupiedSites).toHaveLength(BASE_EVENTS.length);

    for (const body of state.bodies.slice(1)) {
      expect(body.hostBodyId).not.toBeNull();
      expect(ids.has(body.hostBodyId!)).toBe(true);
      expect(body.attachment?.hostBodyId).toBe(body.hostBodyId);
      expect(body.attachment?.burialDepth).toBeGreaterThan(0);
      expect(body.generation).toBeGreaterThan(0);
      expect(body.competition).toBeGreaterThanOrEqual(0);
      expect(body.competition).toBeLessThanOrEqual(1);
      expect(body.growthEnergy).toBeGreaterThan(0);
      expect(body.growthEnergy).toBeLessThanOrEqual(1);
      expect(body.renderedLength).toBeLessThanOrEqual(body.skeletonLength);
      expect(body.renderedRadius).toBeLessThanOrEqual(body.skeletonRadius);
      const magnitude = Math.hypot(body.direction.x, body.direction.y, body.direction.z);
      expect(magnitude).toBeCloseTo(1, 5);
      expect(body.direction.y).toBeGreaterThan(0);
    }
  });

  it('keeps historical placement and adult dimensions unchanged when a later event is appended', () => {
    const earlierBlueprint = growthBlueprint(BASE_EVENTS);
    const earlier = buildGrowthState({
      blueprint: earlierBlueprint,
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const later = buildGrowthState({
      blueprint: growthBlueprint([
        ...BASE_EVENTS,
        {
          id: 'fulfilled-dream',
          occurredAt: '2026-05-20T12:00:00Z',
          source: 'wishlist@1',
          evidence: 'verified',
          channels: { achievement: 0.92, significance: 0.58 },
          portalActivity: 0.28,
        },
      ]),
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });

    expect(later.bodies).toHaveLength(earlier.bodies.length + 1);
    for (const oldBody of earlier.bodies) {
      const nextBody = later.bodies.find((body) => body.id === oldBody.id);
      expect(nextBody).toBeDefined();
      expect(stableBody(nextBody!)).toEqual(stableBody(oldBody));
    }
  });

  it('builds colony state without creating orphan members', () => {
    const state = buildGrowthState({
      blueprint: growthBlueprint(BASE_EVENTS),
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const bodyIds = new Set(state.bodies.map((body) => body.id));

    for (const colony of state.colonies) {
      for (const bodyId of colony.bodyIds) expect(bodyIds.has(bodyId)).toBe(true);
      if (colony.bodyIds.length > 0) expect(colony.rootBodyId).not.toBeNull();
      expect(colony.maxGeneration).toBeGreaterThanOrEqual(0);
    }
  });

  it('truncates safely at the configured body budget', () => {
    const blueprint = growthBlueprint(BASE_EVENTS);
    const state = buildGrowthState({
      blueprint,
      config: { ...DEFAULT_GROWTH_ENGINE_CONFIG, maxBodies: 3 },
    });

    expect(state.bodies).toHaveLength(3);
    expect(state.diagnostics.truncatedInstructionIds).toEqual(
      blueprint.instructions.slice(2).map((instruction) => instruction.id),
    );
  });
});
