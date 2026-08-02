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

  it('faces outward like every other body', () => {
    // Regression: the substrate reused buildCrystalMesh's index winding but
    // laid its rings out with the opposite handedness (cos → x, sin → z), so
    // every face pointed inward. Back-face culling then dropped the outer shell
    // and drew the interior — the mound read as a crater, and ADR-0003's
    // promise that the rock hides each crystal's base cap silently held only
    // because the crystals happened to sit on top of the hole.
    //
    // Signed volume from the winding is the check that cannot be satisfied by
    // accident: it is positive only when the triangles wind counter-clockwise
    // seen from outside.
    const { substrate, geometry } = pipeline();
    const signedVolume = (mesh: typeof substrate): number => {
      const p = mesh.positions;
      let volume = 0;
      for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const a = mesh.indices[offset]! * 3;
        const b = mesh.indices[offset + 1]! * 3;
        const c = mesh.indices[offset + 2]! * 3;
        volume += (
          p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!)
          - p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!)
          + p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
        ) / 6;
      }
      return volume;
    };

    expect(signedVolume(substrate)).toBeGreaterThan(0);
    // Same orientation as the crystals it stands with, not merely non-zero.
    for (const mesh of geometry.meshes) {
      expect(signedVolume(mesh)).toBeGreaterThan(0);
    }

    // And the normals agree with the winding: every one points away from the
    // solid's centre.
    const { center } = substrate.bounds;
    for (let offset = 0; offset < substrate.positions.length; offset += 3) {
      const outward = substrate.normals[offset]! * (substrate.positions[offset]! - center.x)
        + substrate.normals[offset + 1]! * (substrate.positions[offset + 1]! - center.y)
        + substrate.normals[offset + 2]! * (substrate.positions[offset + 2]! - center.z);
      expect(outward).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for the same couple', () => {
    expect(pipeline().substrate).toEqual(pipeline().substrate);
  });
});

describe('crystal substrate ground spread (ADR-0004)', () => {
  it('widens with the monarch`s published spread and still covers every base', () => {
    // Places visited reach geometry only as a multiplier on the monarch's
    // attributes; the volume never learns what a place is.
    const { growth, substrate } = pipeline();
    const travelled = {
      ...growth,
      bodies: growth.bodies.map((body) => (
        body.id === 'crystal:mother'
          ? { ...body, attributes: { ...body.attributes, groundSpread: 1.4 } }
          : body
      )),
    };
    const wider = buildCrystalGeometry({
      growth: travelled,
      composition: buildCrystalComposition({
        growth: travelled,
        config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
      }),
      config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
    }).meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;

    expect(wider.bounds.max.x).toBeGreaterThan(substrate.bounds.max.x * 1.2);

    // The load-bearing guarantee still holds at the wider size.
    const rim = Math.min(Math.abs(wider.bounds.min.x), Math.abs(wider.bounds.max.x));
    for (const body of travelled.bodies) {
      expect(Math.hypot(body.anchor.x, body.anchor.z) + body.renderedRadius).toBeLessThan(rim);
    }
    expect(wider.bounds.min.y).toBeLessThan(Math.min(...travelled.bodies.map((b) => b.anchor.y)));
  });
});
