import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './substrate';

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
];

function pipeline(events: readonly EvolutionEventInput[] = EVENTS) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'substrate-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const substrate = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
  return { growth, geometry, substrate };
}

describe('crystal substrate', () => {
  it('covers every crystal footprint', () => {
    // This is the load-bearing property. ADR-0003 keeps each crystal's base cap
    // intact and sinks it below y=0 on the promise that the substrate occludes
    // it; a crystal standing past the rim would expose exactly that cap.
    const { growth, substrate } = pipeline();
    const rimRadius = Math.min(
      Math.abs(substrate.bounds.min.x),
      Math.abs(substrate.bounds.max.x),
      Math.abs(substrate.bounds.min.z),
      Math.abs(substrate.bounds.max.z),
    );

    expect(growth.bodies.length).toBeGreaterThan(1);
    for (const body of growth.bodies) {
      const horizontal = Math.hypot(body.anchor.x, body.anchor.z);
      expect(horizontal + body.renderedRadius).toBeLessThan(rimRadius);
    }
  });

  it('reaches below every buried base', () => {
    const { growth, substrate } = pipeline();
    const deepestBody = Math.min(...growth.bodies.map((body) => body.anchor.y));

    expect(substrate.bounds.min.y).toBeLessThan(deepestBody);
  });

  it('is a closed solid that keeps its own underside capped', () => {
    const { substrate } = pipeline();

    expect(substrate.hostBodyId).toBeNull();
    expect(substrate.baseCapRemoved).toBe(false);
    expect(substrate.baseCapTriangleCount).toBeGreaterThan(0);
    expect(substrate.visibleTriangleCount).toBe(substrate.indices.length / 3);
    expect(substrate.positions.every(Number.isFinite)).toBe(true);
    expect(substrate.normals).toHaveLength(substrate.positions.length);
    const vertexCount = substrate.positions.length / 3;
    expect(substrate.indices.every((index) => index >= 0 && index < vertexCount)).toBe(true);
  });

  it('stays a low mound rather than a body competing with the crystals', () => {
    const { growth, substrate } = pipeline();
    const tallest = Math.max(...growth.bodies.map((body) => body.renderedLength));
    const substrateHeight = substrate.bounds.max.y - substrate.bounds.min.y;

    expect(substrateHeight).toBeLessThan(tallest * 0.5);
  });

  it('tracks the footprint it has to cover, not the event count', () => {
    // Companions sit on a ring, so a couple with more events does not
    // necessarily have a wider druse — what the substrate must track is the
    // actual outermost crystal, whatever produced it.
    for (const events of [[EVENTS[0]!], EVENTS]) {
      const { growth, substrate } = pipeline(events);
      const widestBody = Math.max(...growth.bodies.map(
        (body) => Math.hypot(body.anchor.x, body.anchor.z) + body.renderedRadius,
      ));
      const rimRadius = Math.min(Math.abs(substrate.bounds.min.x), Math.abs(substrate.bounds.max.x));

      expect(rimRadius).toBeGreaterThan(widestBody);
      // And not absurdly larger, or the druse would sit on a plate.
      expect(rimRadius).toBeLessThan(widestBody * 2.2 + 0.3);
    }
  });

  it('is deterministic for the same couple', () => {
    expect(pipeline().substrate).toEqual(pipeline().substrate);
  });
});
