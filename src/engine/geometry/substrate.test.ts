import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { orthonormalBasis } from '../growth/math';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID, crystalVeinRadiusAt } from './substrate';

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

/**
 * How far a point sits outside the vein's outline, in scene units.
 *
 * The vein is star-shaped about the origin, so a point lies inside exactly when
 * its distance from the origin is within the outline's reach along its own
 * bearing. That is the only containment test the shape admits — a bounding-box
 * rim radius, which is what the round plate used, means nothing here.
 */
function outsideVeinBy(
  bodies: ReturnType<typeof pipeline>['growth']['bodies'],
  artifactSeed: number,
  x: number,
  z: number,
): number {
  return Math.hypot(x, z) - crystalVeinRadiusAt(bodies, artifactSeed, Math.atan2(x, z));
}

/** The furthest the vein reaches in any direction. */
function veinReach(
  bodies: ReturnType<typeof pipeline>['growth']['bodies'],
  artifactSeed: number,
): number {
  let reach = 0;
  for (let step = 0; step < 720; step += 1) {
    reach = Math.max(reach, crystalVeinRadiusAt(bodies, artifactSeed, (step / 720) * Math.PI * 2));
  }
  return reach;
}

describe('crystal substrate', () => {
  it('covers every crystal footprint', () => {
    // This is the load-bearing property. ADR-0003 keeps each crystal's base cap
    // intact and sinks it below y=0 on the promise that the substrate occludes
    // it; a crystal standing past the vein's edge would expose exactly that cap.
    //
    // Checked around each base disc rather than at its centre, because the vein
    // is not radially symmetric: a crystal can sit well inside the vein's reach
    // along its own bearing and still hang over the edge sideways.
    const { growth } = pipeline();

    expect(growth.bodies.length).toBeGreaterThan(1);
    for (const body of growth.bodies) {
      // The base cap of a leaning crystal is a tilted disc, so its shadow on
      // the platform is an ellipse, not a circle. Walking the cap in the
      // body's own frame is what makes this hold for a year crystal at 45°;
      // a circle of `renderedRadius` around the anchor would understate it by
      // up to a factor of √2 and quietly pass while a cap showed.
      const { tangent, bitangent } = orthonormalBasis(body.direction);
      for (let step = 0; step < 180; step += 1) {
        const angle = (step / 180) * Math.PI * 2;
        const cos = Math.cos(angle) * body.renderedRadius;
        const sin = Math.sin(angle) * body.renderedRadius;
        const margin = outsideVeinBy(
          growth.bodies,
          growth.artifactSeed,
          body.anchor.x + tangent.x * cos + bitangent.x * sin,
          body.anchor.z + tangent.z * cos + bitangent.z * sin,
        );
        expect(margin, body.id).toBeLessThan(0);
      }
    }
  });

  it('reaches below the deepest published mesh, not just the deepest anchor', () => {
    // Regression: the vein sized its depth from `body.anchor.y`, and the
    // monarch's anchor is exactly y=0 — she is sunk into the vein by her
    // *profile* (MONARCH_GROUND_SINK), which anchors know nothing about. The
    // vein came out shallower than the base cap it exists to hide, and only
    // happened to cover it because the node was wide enough.
    const { growth, geometry, substrate } = pipeline();
    const deepestMesh = Math.min(...geometry.meshes
      .filter((mesh) => mesh.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID)
      .map((mesh) => mesh.bounds.min.y));

    expect(deepestMesh).toBeLessThan(Math.min(...growth.bodies.map((body) => body.anchor.y)));
    expect(substrate.bounds.min.y).toBeLessThan(deepestMesh);
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
      const { growth } = pipeline(events);
      const widestBody = Math.max(...growth.bodies.map(
        (body) => Math.hypot(body.anchor.x, body.anchor.z) + body.renderedRadius,
      ));
      const reach = veinReach(growth.bodies, growth.artifactSeed);

      expect(reach).toBeGreaterThan(widestBody);
      // And local to the crystal group. The vein shares the dais with the gold
      // rings and the runes; one that ran out to them would read as a second
      // fracture system rather than as the seam the crystals grew out of.
      expect(reach).toBeLessThan(widestBody * 1.6 + 0.15);
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

    // Per-triangle, by which part of the solid the triangle belongs to. The
    // vein's outline is deeply concave between branches, so "every normal
    // points away from the bounding-box centre" — what the round plate was
    // held to — is simply false here and would have to be deleted rather than
    // fixed. These three statements are stronger, because each one is exact:
    //
    //  - the floor cap faces straight down, so the underside is closed;
    //  - the top face faces straight up, so it is flat, with no depression;
    //  - every wall normal leans away from the origin, which is the defining
    //    property of a star-shaped solid and the reason the branches can merge
    //    without the mesh folding through itself.
    const top = substrate.bounds.max.y;
    const floor = substrate.bounds.min.y;
    const seen = { floor: 0, top: 0, wall: 0 };
    for (let offset = 0; offset < substrate.indices.length; offset += 3) {
      const corners = [
        substrate.indices[offset]!,
        substrate.indices[offset + 1]!,
        substrate.indices[offset + 2]!,
      ];
      const heights = corners.map((index) => substrate.positions[index * 3 + 1]!);
      const normal = {
        x: substrate.normals[corners[0]! * 3]!,
        y: substrate.normals[corners[0]! * 3 + 1]!,
        z: substrate.normals[corners[0]! * 3 + 2]!,
      };
      if (heights.every((height) => Math.abs(height - floor) < 1e-6)) {
        seen.floor += 1;
        expect(normal.y).toBeLessThan(-0.99);
      } else if (heights.every((height) => Math.abs(height - top) < 1e-6)) {
        seen.top += 1;
        expect(normal.y).toBeGreaterThan(0.99);
      } else {
        seen.wall += 1;
        const centroidX = corners.reduce((sum, i) => sum + substrate.positions[i * 3]!, 0) / 3;
        const centroidZ = corners.reduce((sum, i) => sum + substrate.positions[i * 3 + 2]!, 0) / 3;
        expect(normal.x * centroidX + normal.z * centroidZ).toBeGreaterThan(0);
      }
    }
    expect(seen.floor).toBeGreaterThan(0);
    expect(seen.top).toBeGreaterThan(0);
    expect(seen.wall).toBeGreaterThan(0);
  });

  it('is deterministic for the same couple', () => {
    expect(pipeline().substrate).toEqual(pipeline().substrate);
  });
});

describe('crystal substrate ground spread (ADR-0004)', () => {
  /** Same growth state with a different published `groundSpread` on the monarch. */
  function withSpread(growth: ReturnType<typeof pipeline>['growth'], spread: number) {
    return {
      ...growth,
      bodies: growth.bodies.map((body) => (
        body.id === 'crystal:mother'
          ? { ...body, attributes: { ...body.attributes, groundSpread: spread } }
          : body
      )),
    };
  }

  it('runs the vein further out with the monarch`s published spread', () => {
    // Places visited reach geometry only as a number on the monarch's
    // attributes; the volume never learns what a place is.
    //
    // What that number does has changed. It used to scale the whole substrate
    // radius, which could only ever grow a circle — the shape the vein exists
    // to replace. It now lengthens the branches, so travel shows as the seam
    // running further into the stone rather than as a bigger pad.
    const { growth } = pipeline();
    const homebody = withSpread(growth, 1);
    const travelled = withSpread(growth, 1.45);

    const near = veinReach(homebody.bodies, growth.artifactSeed);
    const far = veinReach(travelled.bodies, growth.artifactSeed);
    expect(far).toBeGreaterThan(near * 1.15);

    // Saturating, and still local to the crystal group at any input: the gold
    // rings and the runes own the rest of the dais.
    const absurd = veinReach(withSpread(growth, 12).bodies, growth.artifactSeed);
    expect(absurd).toBeCloseTo(far, 6);
    const widestBody = Math.max(...growth.bodies.map(
      (body) => Math.hypot(body.anchor.x, body.anchor.z) + body.renderedRadius,
    ));
    expect(absurd).toBeLessThan(widestBody * 1.6 + 0.15);
  });

  it('still covers every base at the widest spread', () => {
    // A longer branch may only add area — the union it is part of is what
    // carries ADR-0003 — so the guarantee has to survive the extreme.
    const { growth } = pipeline();
    const travelled = withSpread(growth, 1.5);
    const wider = buildCrystalGeometry({
      growth: travelled,
      composition: buildCrystalComposition({
        growth: travelled,
        config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
      }),
      config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
    }).meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;

    for (const body of travelled.bodies) {
      const { tangent, bitangent } = orthonormalBasis(body.direction);
      for (let step = 0; step < 180; step += 1) {
        const angle = (step / 180) * Math.PI * 2;
        const cos = Math.cos(angle) * body.renderedRadius;
        const sin = Math.sin(angle) * body.renderedRadius;
        expect(outsideVeinBy(
          travelled.bodies,
          growth.artifactSeed,
          body.anchor.x + tangent.x * cos + bitangent.x * sin,
          body.anchor.z + tangent.z * cos + bitangent.z * sin,
        ), body.id).toBeLessThan(0);
      }
    }
    expect(wider.bounds.min.y).toBeLessThan(Math.min(...travelled.bodies.map((b) => b.anchor.y)));
  });
});

describe('crystal substrate — quartz vein shape', () => {
  it('is an irregular seam, not a disc', () => {
    // The brief, in one measurement: "не круглої/овальної/радіально
    // симетричної форми". A round plate has one radius; this shape has to
    // reach several times further along its branches than it does into the
    // stone between them, or it is the pad review already rejected.
    const { growth } = pipeline();
    let narrowest = Number.POSITIVE_INFINITY;
    let widest = 0;
    for (let step = 0; step < 720; step += 1) {
      const radius = crystalVeinRadiusAt(
        growth.bodies,
        growth.artifactSeed,
        (step / 720) * Math.PI * 2,
      );
      narrowest = Math.min(narrowest, radius);
      widest = Math.max(widest, radius);
    }

    expect(widest).toBeGreaterThan(narrowest * 2);
  });

  it('sends a branch to every crystal and a node under the monarch', () => {
    // The shape is not decorative noise: it is built from where the crystals
    // actually meet the stone, which is why the reach along a year crystal's
    // own bearing clears that crystal while the far side of the vein does not
    // have to.
    const { growth } = pipeline();
    const monarch = growth.bodies.reduce(
      (widest, body) => (body.renderedRadius > widest.renderedRadius ? body : widest),
      growth.bodies[0]!,
    );

    // Wide node at the monarch: the vein is thickest where the druse stands.
    const acrossTheNode = Math.min(
      ...Array.from({ length: 8 }, (_, step) => crystalVeinRadiusAt(
        growth.bodies,
        growth.artifactSeed,
        (step / 8) * Math.PI * 2,
      )),
    );
    expect(acrossTheNode).toBeGreaterThan(monarch.renderedRadius * 1.5);

    for (const body of growth.bodies) {
      if (body.id === monarch.id) continue;
      const distance = Math.hypot(body.anchor.x, body.anchor.z);
      const bearing = Math.atan2(body.anchor.x, body.anchor.z);
      expect(
        crystalVeinRadiusAt(growth.bodies, growth.artifactSeed, bearing),
        body.id,
      ).toBeGreaterThan(distance + body.renderedRadius);
    }
  });

  it('lies practically flush with the platform and keeps a flat top', () => {
    // Two rejected shapes in one check. The vein must not stand up as an inlay
    // — it is proud of the stone by a fraction of a crystal — and its top must
    // not dish, because the "central circular depression" is exactly what the
    // old cut plate read as.
    const { growth, substrate } = pipeline();
    const tallest = Math.max(...growth.bodies.map((body) => body.renderedLength));
    const proud = substrate.bounds.max.y;

    expect(proud).toBeGreaterThan(0);
    expect(proud).toBeLessThan(tallest * 0.06);

    for (let offset = 0; offset < substrate.positions.length; offset += 3) {
      const height = substrate.positions[offset + 1]!;
      // Every vertex is either on the flat top or on the buried floor; there is
      // no intermediate height for a bowl or a collar to live at.
      const onTop = Math.abs(height - substrate.bounds.max.y) < 1e-6;
      const onFloor = Math.abs(height - substrate.bounds.min.y) < 1e-6;
      expect(onTop || onFloor).toBe(true);
    }
  });

  it('never opens a hole under a crystal', () => {
    // A branch that split around a body would remove the very stone that hides
    // its base cap, which is the one thing ADR-0003 asks this mesh for. The
    // outline is star-shaped about the origin, so the vein is solid all the way
    // from the node out to each edge — this is that property, measured.
    const { growth } = pipeline();

    for (const body of growth.bodies) {
      const bearing = Math.atan2(body.anchor.x, body.anchor.z);
      const edge = crystalVeinRadiusAt(growth.bodies, growth.artifactSeed, bearing);
      for (let step = 1; step <= 24; step += 1) {
        const along = (Math.hypot(body.anchor.x, body.anchor.z) * step) / 24;
        expect(along, body.id).toBeLessThanOrEqual(edge);
      }
    }
  });

  it('stands its crystals in the vein without any two of them touching', () => {
    // The lean is what makes this worth measuring rather than assuming.
    // `childDistance` guarantees clearance between two *axes* at the ground;
    // once the children tip 45–55° outward, whether they stay apart higher up
    // is a fact about the whole colony, not about one arithmetic floor. They
    // diverge as they rise — so the tightest point is the base — but nothing
    // in the placement says so, and this is what would catch it changing.
    const { growth } = pipeline();
    const bodies = growth.bodies;
    const at = (body: typeof bodies[number], t: number) => ({
      x: body.anchor.x + body.direction.x * t,
      y: body.anchor.y + body.direction.y * t,
      z: body.anchor.z + body.direction.z * t,
    });

    for (let left = 0; left < bodies.length; left += 1) {
      for (let right = left + 1; right < bodies.length; right += 1) {
        const one = bodies[left]!;
        const other = bodies[right]!;
        let closest = Number.POSITIVE_INFINITY;
        for (let u = 0; u <= 40; u += 1) {
          for (let v = 0; v <= 40; v += 1) {
            const a = at(one, (u / 40) * one.renderedLength);
            const b = at(other, (v / 40) * other.renderedLength);
            closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
          }
        }
        expect(
          closest - one.renderedRadius - other.renderedRadius,
          `${one.id} vs ${other.id}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('tips every child outward, 45–55° off the monarch', () => {
    // The half of the lean that geometry cares about: a child leaning *inward*
    // would drive its tip through the monarch and its base out of the vein.
    // Checked on the built bodies rather than on `childRadialBias`, because
    // between the two sits `ensureUpward` — which stood the whole crown back
    // up while the adapter still published the old floor.
    const { growth } = pipeline();
    const leaning = growth.bodies.filter(
      (body) => body.kind === 'crystal:annual' || body.kind === 'crystal:skirt',
    );

    expect(leaning.length).toBeGreaterThan(0);
    for (const body of leaning) {
      const distance = Math.hypot(body.anchor.x, body.anchor.z);
      expect(distance, body.id).toBeGreaterThan(0);
      const outward = (body.direction.x * body.anchor.x + body.direction.z * body.anchor.z)
        / distance;
      expect(outward, body.id).toBeGreaterThan(0);

      const abovePlatform = (Math.asin(Math.max(-1, Math.min(1, body.direction.y))) * 180)
        / Math.PI;
      expect(90 - abovePlatform, body.id).toBeGreaterThanOrEqual(44);
      expect(90 - abovePlatform, body.id).toBeLessThanOrEqual(56);
    }
  });

  it('is deterministic and stays inside the published bounds', () => {
    const first = pipeline().substrate;
    expect(pipeline().substrate).toEqual(first);
    expect(first.positions.every(Number.isFinite)).toBe(true);
    expect(first.normals.every(Number.isFinite)).toBe(true);
    for (let offset = 0; offset < first.positions.length; offset += 3) {
      expect(first.positions[offset]!).toBeGreaterThanOrEqual(first.bounds.min.x);
      expect(first.positions[offset]!).toBeLessThanOrEqual(first.bounds.max.x);
      expect(first.positions[offset + 1]!).toBeGreaterThanOrEqual(first.bounds.min.y);
      expect(first.positions[offset + 1]!).toBeLessThanOrEqual(first.bounds.max.y);
      expect(first.positions[offset + 2]!).toBeGreaterThanOrEqual(first.bounds.min.z);
      expect(first.positions[offset + 2]!).toBeLessThanOrEqual(first.bounds.max.z);
    }
  });
});
