import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG } from './config';
import { buildCrystalComposition } from './crystalComposition';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.72, remembrance: 0.58 },
    portalActivity: 0.5,
  },
  {
    id: 'first-trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.92, remembrance: 0.36 },
    portalActivity: 0.3,
  },
  {
    id: 'photo-day',
    occurredAt: '2024-09-04T12:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.64, culture: 0.22 },
    portalActivity: 0.16,
  },
  {
    id: 'anniversary-one',
    occurredAt: '2025-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { stability: 0.74, significance: 0.6, remembrance: 0.48 },
    portalActivity: 0.22,
  },
];

function growthState() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'composition-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  });
  return buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
}

describe('Crystal Composition', () => {
  it('is deterministic and never mutates GrowthState', () => {
    const growth = growthState();
    const before = JSON.stringify(growth);
    const first = buildCrystalComposition({
      growth,
      config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
    });
    const second = buildCrystalComposition({
      growth,
      config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
    });

    expect(second).toEqual(first);
    expect(JSON.stringify(growth)).toBe(before);
  });

  it('publishes exactly one focal body and bounded scores', () => {
    const growth = growthState();
    const composition = buildCrystalComposition({
      growth,
      config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
    });

    expect(composition.bodies.filter((body) => body.focal)).toHaveLength(1);
    expect(composition.bodies.find((body) => body.focal)?.id).toBe(growth.bodies[0]?.id);
    expect(['cathedral', 'fan', 'druse']).toContain(composition.silhouette);
    for (const value of Object.values(composition.score)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(composition.diagnostics.orphanBodyIds).toEqual([]);
  });

  it('keeps every growth transform byte-for-byte unchanged', () => {
    const growth = growthState();
    const originalTransforms = growth.bodies.map((body) => ({
      id: body.id,
      anchor: body.anchor,
      direction: body.direction,
      skeletonLength: body.skeletonLength,
      skeletonRadius: body.skeletonRadius,
      renderedLength: body.renderedLength,
      renderedRadius: body.renderedRadius,
      hostBodyId: body.hostBodyId,
    }));

    buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });

    expect(growth.bodies.map((body) => ({
      id: body.id,
      anchor: body.anchor,
      direction: body.direction,
      skeletonLength: body.skeletonLength,
      skeletonRadius: body.skeletonRadius,
      renderedLength: body.renderedLength,
      renderedRadius: body.renderedRadius,
      hostBodyId: body.hostBodyId,
    }))).toEqual(originalTransforms);
  });
});

describe('Crystal Composition — rank', () => {
  /**
   * A colony needs more than one rank in it, and for a long time it had exactly
   * one. `roleFor` treated `generation === 0` as "this is the monarch", which
   * was true while every child grew *on* her and stopped being true the moment
   * children became ground-rooted: a body growing out of the substrate is a
   * root of its own colony, so the growth engine gives it generation 0 by
   * design. Every body in the druse then came out `focal`.
   *
   * Measured on three couples before the fix: 19 of 19, 32 of 32 and 36 of 36
   * bodies `focal`, while their tiers were correctly king / support / family /
   * micro the whole time. That is the shape of the bug — a field derived from
   * the wrong one of two things that used to agree.
   */
  it('gives the colony more than one rank', () => {
    const composition = buildCrystalComposition({
      growth: growthState(),
      config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
    });

    const roles = new Set(composition.bodies.map((body) => body.role));
    expect(roles.size).toBeGreaterThan(1);
    expect(composition.bodies.filter((body) => body.role === 'focal')).toHaveLength(1);
  });

  it('reads rank off the tier and not off the generation', () => {
    const growth = growthState();
    // The premise of the bug, asserted so it cannot quietly come back: every
    // body really is generation 0, so generation carries no rank at all.
    expect(growth.bodies.every((body) => body.generation === 0)).toBe(true);
    expect(new Set(growth.bodies.map((body) => body.tier)).size).toBeGreaterThan(1);

    const composition = buildCrystalComposition({
      growth,
      config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
    });
    const tierOf = new Map(growth.bodies.map((body) => [body.id, body.tier]));
    for (const body of composition.bodies) {
      const tier = tierOf.get(body.sourceBodyId);
      if (tier === 'king') expect(body.role).toBe('focal');
      else expect(body.role).not.toBe('focal');
    }
  });
});
