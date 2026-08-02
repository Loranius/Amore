import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_GROWTH_ENGINE_CONFIG } from './config';
import { buildGrowthState } from './engine';
import type { GrowthBody, UniversalGrowthBlueprint } from './types';

/** The monarch's id, as published by the crystal species adapter. */
const MONARCH_BODY_ID = 'crystal:mother';

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

  // Companion crystals are ground-rooted as of the 2026-08-02 composition
  // change: a formation that leads its own Growth Centre nucleates in the
  // substrate beside the monarch rather than out of her shaft, so it has no
  // host body, no attachment and no reserved atlas region. Only its local
  // members still attach to a host.
  const isGroundRooted = (body: { growthCenterRole?: string | null }): boolean =>
    (body.growthCenterRole ?? null) === 'dominant';

  it('attaches every hosted body to a reserved aggregate Surface Atlas region', () => {
    const blueprint = growthBlueprint(BASE_EVENTS);
    const state = buildGrowthState({
      blueprint,
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const ids = new Set(state.bodies.map((body) => body.id));
    const occupancyByBodyId = new Map(
      state.surfaceMap.occupiedSites.map((site) => [site.bodyId, site] as const),
    );

    expect(state.bodies).toHaveLength(blueprint.instructions.length + 1);
    expect(state.bodies[0]?.hostBodyId).toBeNull();
    expect(state.surfaceMap.occupiedSites).toHaveLength(blueprint.instructions.length);

    const groundRooted = state.bodies.slice(1).filter(isGroundRooted);
    expect(groundRooted.length).toBeGreaterThan(0);
    for (const body of groundRooted) {
      expect(body.hostBodyId).toBeNull();
      expect(body.attachment).toBeNull();
      expect(body.generation).toBe(0);
    }

    for (const body of state.bodies.slice(1).filter((item) => !isGroundRooted(item))) {
      const occupancy = occupancyByBodyId.get(body.id);
      const surfaceRegionId = body.attachment?.surfaceRegionId;

      expect(body.hostBodyId).not.toBeNull();
      expect(ids.has(body.hostBodyId!)).toBe(true);
      expect(body.attachment?.hostBodyId).toBe(body.hostBodyId);
      expect(surfaceRegionId).toBe(`${body.hostBodyId}:${surfaceRegionId?.split(':').slice(-3).join(':')}`);
      expect(occupancy?.surfaceRegionId).toBe(surfaceRegionId);
      expect(occupancy?.hostBodyId).toBe(body.hostBodyId);
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

  it('never deposits two bodies into the same Surface Atlas region', () => {
    const state = buildGrowthState({
      blueprint: growthBlueprint(BASE_EVENTS),
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    // Every crystal stands in the substrate (ADR-0003), so none of them
    // reserves an atlas region. The uniqueness rule still has to hold for any
    // that do — it just has nothing to constrain for this species today.
    const regionIds = state.surfaceMap.occupiedSites
      .map((site) => site.surfaceRegionId)
      .filter((regionId): regionId is string => regionId !== undefined);

    expect(regionIds).toEqual([]);
    expect(new Set(regionIds).size).toBe(regionIds.length);
  });

  it('builds one compact local Growth Center per evolution formation', () => {
    const blueprint = growthBlueprint(BASE_EVENTS);
    const state = buildGrowthState({ blueprint, config: DEFAULT_GROWTH_ENGINE_CONFIG });
    const centers = state.growthCenters ?? [];
    const bodyById = new Map(state.bodies.map((body) => [body.id, body] as const));

    expect(blueprint.growthCenters).toHaveLength(BASE_EVENTS.length);
    expect(centers).toHaveLength(BASE_EVENTS.length);
    expect(state.colonies.map((colony) => colony.id)).toEqual(centers.map((center) => center.id));

    for (const center of centers) {
      expect(center.dominantBodyId).toBe(center.sourceInstructionId);
      // The centre's dominant now nucleates in the substrate, so the centre
      // reserves no atlas region of its own.
      expect(center.surfaceRegionId).toBeNull();
      // One crystal per event and nothing grows on it (ADR-0003), so a centre
      // is exactly its dominant.
      expect(center.bodyIds).toEqual([center.dominantBodyId]);

      const dominant = bodyById.get(center.dominantBodyId!);
      expect(dominant?.growthCenterRole).toBe('dominant');
      expect(dominant?.growthCenterId).toBe(center.id);

      for (const bodyId of center.bodyIds) {
        const body = bodyById.get(bodyId)!;
        expect(body.growthCenterId).toBe(center.id);
        if (body.growthCenterRole === 'dominant') continue;
        const host = bodyById.get(body.hostBodyId!);
        expect(host?.growthCenterId).toBe(center.id);
      }
    }
  });

  it('keeps the Crystal Species compact, upward and rooted around one focal mother', () => {
    const state = buildGrowthState({
      blueprint: growthBlueprint(BASE_EVENTS),
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const mother = state.bodies[0]!;
    const bodyById = new Map(state.bodies.map((body) => [body.id, body] as const));

    expect(mother.kind).toBe('crystal:mother');
    expect(mother.direction.y).toBeGreaterThanOrEqual(0.9);
    expect(mother.skeletonLength).toBeGreaterThan(
      Math.max(...state.bodies.slice(1).map((body) => body.skeletonLength)),
    );

    for (const body of state.bodies.slice(1)) {
      if (body.kind === 'crystal:event-spire') {
        // Stands in the ground beside the monarch rather than on her shaft.
        expect(body.hostBodyId).toBeNull();
        expect(body.generation).toBe(0);
        expect(body.anchor.y).toBeLessThanOrEqual(0);
        expect(Math.hypot(body.anchor.x, body.anchor.z)).toBeGreaterThan(0);
        expect(body.direction.y).toBeGreaterThanOrEqual(0.62);
        expect(body.skeletonLength).toBeLessThanOrEqual(1.3);
      } else if (body.kind === 'crystal:satellite') {
        expect(body.direction.y).toBeGreaterThanOrEqual(0.34);
        expect(body.skeletonLength).toBeLessThanOrEqual(0.84);
      } else if (body.kind === 'crystal:inclusion') {
        expect(body.direction.y).toBeGreaterThanOrEqual(0.24);
        expect(body.skeletonLength).toBeLessThanOrEqual(0.42);
      }

      if (body.growthCenterRole !== 'dominant') {
        const host = bodyById.get(body.hostBodyId!);
        expect(host?.growthCenterId).toBe(body.growthCenterId);
        expect(body.generation).toBeGreaterThan(host?.generation ?? 0);
      }
    }
  });

  it('keeps every historical body byte-stable when a later event is appended', () => {
    const earlierBlueprint = growthBlueprint(BASE_EVENTS);
    const laterBlueprint = growthBlueprint([
      ...BASE_EVENTS,
      {
        id: 'fulfilled-dream',
        occurredAt: '2026-05-20T12:00:00Z',
        source: 'wishlist@1',
        evidence: 'verified',
        channels: { achievement: 0.92, significance: 0.58 },
        portalActivity: 0.28,
      },
    ]);
    const earlier = buildGrowthState({
      blueprint: earlierBlueprint,
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });
    const later = buildGrowthState({
      blueprint: laterBlueprint,
      config: DEFAULT_GROWTH_ENGINE_CONFIG,
    });

    expect(later.bodies).toHaveLength(
      earlier.bodies.length + laterBlueprint.instructions.length - earlierBlueprint.instructions.length,
    );
    // ADR-0004 draws the line at the anniversary. Two bodies are *supposed*
    // to answer to a new event: the monarch, who answers to everything, and
    // the year currently in progress. Every closed year is a record of that
    // year and must not move again — which is the property this test exists
    // for, since the whole druse used to reshuffle on any new row.
    //
    // `competition`, `crowding` and `growthEnergy` are excluded because they
    // are readings of the neighbourhood rather than properties of the body:
    // the ring genuinely does get busier, and since ground-rooted bodies are
    // no longer scaled by growth energy, these three decide nothing.
    const NEIGHBOURHOOD_READINGS = ['competition', 'crowding', 'growthEnergy'] as const;
    const authoritative = (body: GrowthBody): Record<string, unknown> => {
      const copy: Record<string, unknown> = { ...body };
      for (const key of NEIGHBOURHOOD_READINGS) delete copy[key];
      return copy;
    };
    const isClosedYear = (body: { id: string; maturity?: number }): boolean =>
      body.id.startsWith('crystal:year:') && body.maturity === 1;

    const closedYears = earlier.bodies.filter(isClosedYear);
    expect(closedYears.length).toBeGreaterThan(0);
    for (const oldBody of closedYears) {
      const nextBody = later.bodies.find((body) => body.id === oldBody.id);
      expect(nextBody).toBeDefined();
      expect(authoritative(nextBody!)).toEqual(authoritative(oldBody));
    }

    // And the carve-out is not a licence for nothing to happen: assert both
    // exceptions actually did respond, so they cannot hide a regression.
    const byId = (bodies: typeof earlier.bodies, id: string) => bodies.find((b) => b.id === id)!;
    expect(byId(later.bodies, MONARCH_BODY_ID).renderedRadius)
      .toBeGreaterThan(byId(earlier.bodies, MONARCH_BODY_ID).renderedRadius);

    const currentYearId = earlier.bodies.filter((body) => body.id.startsWith('crystal:year:')).at(-1)!.id;
    expect(byId(later.bodies, currentYearId).renderedLength)
      .toBeGreaterThan(byId(earlier.bodies, currentYearId).renderedLength);
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
    expect(state.growthCenters?.[0]?.dominantBodyId).not.toBeNull();
  });
});
