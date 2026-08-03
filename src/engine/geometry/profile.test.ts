import { describe, expect, it } from 'vitest';
import type { GrowthBody } from '../growth';
import { add, orthonormalBasis, scale } from '../growth/math';
import { buildCrystalMesh } from './mesh';
import { buildCrystalProfile } from './profile';
import { pointInsideCrystalSolid } from './trim';

function crystalBody(overrides: Partial<GrowthBody> = {}): GrowthBody {
  return {
    id: 'crystal-body-1',
    instructionId: 'instruction-1',
    sourceId: 'event-1',
    species: 'crystal',
    kind: 'crystal:formation',
    tier: 'support',
    attributes: {
      formationKind: 'event',
      archetype: 'blade',
    },
    sequence: 1,
    colonyId: 'colony-1',
    epochIndex: 1,
    seed: 1_234_567,
    emphasized: false,
    generation: 1,
    hostBodyId: 'crystal-host-1',
    attachment: {
      siteKey: 'site-1',
      surfaceRegionId: 'region-1',
      hostBodyId: 'crystal-host-1',
      hostT: 0.34,
      hostAngleRad: 0.72,
      point: { x: 0.1, y: 0.2, z: -0.1 },
      normal: { x: 0, y: 1, z: 0 },
      burialDepth: 0.22,
    },
    anchor: { x: 0.25, y: 0.1, z: -0.18 },
    direction: { x: 0, y: 1, z: 0 },
    skeletonLength: 1.8,
    skeletonRadius: 0.24,
    surfaceRadiusScale: 0.82,
    renderedLength: 1.64,
    renderedRadius: 0.21,
    maturity: 0.78,
    growthEnergy: 0.66,
    competition: 0.18,
    crowding: 0.12,
    growthCenterId: 'center-1',
    growthCenterRole: 'dominant',
    ...overrides,
  };
}

function motherBody(): GrowthBody {
  return crystalBody({
    id: 'mother',
    kind: 'crystal:mother',
    tier: 'king',
    attributes: { formationKind: 'mother', archetype: 'massive' },
    generation: 0,
    hostBodyId: null,
    attachment: null,
    growthCenterRole: 'dominant',
  });
}

describe('Crystal organic profile phase 3a', () => {
  it('builds deterministic asymmetric rows with lean, twist and burial metadata', () => {
    const body = crystalBody();
    const first = buildCrystalProfile(body, 'high');
    const repeated = buildCrystalProfile(body, 'high');

    expect(repeated).toEqual(first);
    expect(first.twistTotal).not.toBe(0);
    expect(Math.abs(first.axisLeanX) + Math.abs(first.axisLeanZ)).toBeGreaterThan(0);
    expect(first.burialStartY).toBe(first.extraSink);
    expect(first.burialCompression).toBeGreaterThanOrEqual(0.62);
    expect(first.burialCompression).toBeLessThanOrEqual(0.76);
    expect(first.rows.some((row) => Math.abs(row.radiusX - row.radiusZ) > 1e-6)).toBe(true);
    // facetPhase is gone by design: it rotated the ring per row, which is one
    // of the four things that made side faces non-planar.
    expect(first.rows.every((row) => row.facetPhase === 0)).toBe(true);

    // Reverted (2026-08-03): slices used to turn and drift individually, and
    // that is what made side faces non-planar — the mosaic. A crystal twists
    // and leans as one piece or not at all, so every slice now carries the same
    // rotation, and the lean is a straight translation from base to tip.
    const lastRow = first.rows[first.rows.length - 1]!;
    for (const row of first.rows) {
      expect(row.rotation).toBe(first.twistTotal);
      expect(row.facetPhase).toBe(0);
    }
    expect(lastRow.centerOffsetX).toBeCloseTo(first.axisLeanX, 6);
    expect(lastRow.centerOffsetZ).toBeCloseTo(first.axisLeanZ, 6);

    for (const row of first.rows) {
      expect(row.radius).toBeGreaterThan(0);
      expect(row.radiusX).toBeGreaterThan(0);
      expect(row.radiusZ).toBeGreaterThan(0);
      expect([
        row.y,
        row.radius,
        row.radiusX,
        row.radiusZ,
        row.centerOffsetX,
        row.centerOffsetZ,
        row.rotation,
        row.facetPhase,
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it('keeps the mother silhouette visibly organic even at low LOD', () => {
    const mother = motherBody();
    const profile = buildCrystalProfile(mother, 'low');
    const leanMagnitude = Math.hypot(profile.axisLeanX, profile.axisLeanZ);

    expect(profile.archetype).toBe('prismatic');
    expect(profile.burialStartY).toBe(0);
    expect(profile.burialCompression).toBe(1);
    expect(Math.abs(profile.twistTotal)).toBeGreaterThanOrEqual(0.11);
    // Lean ceiling dropped from 0.26 to 0.09 of the radius (2026-08-03): the
    // monarch is the colony's axis and has to read as near-vertical. It still
    // leans — a perfectly upright crystal reads as placed rather than grown.
    expect(leanMagnitude).toBeGreaterThan(0);
    expect(leanMagnitude).toBeLessThanOrEqual(mother.renderedRadius * 0.09);
    // Cross-section rounded from 1.44:1 to 1.18:1 and the taper extended into
    // one extra row (2026-08-02 monarch reshape) — the monarch was reading as
    // a flat slab with a capped cylinder silhouette. Asymmetry is retained
    // deliberately; it just no longer dominates the shape.
    expect(profile.scaleX).toBe(0.9);
    expect(profile.scaleZ).toBe(1.06);
    // Three to five slices: base, shoulder, zero to two crown bevels, tip.
    // The four intermediate shaft slices were removed (2026-08-03) — each was
    // another horizontal band across every side face, and once the faces are
    // genuinely flat the bands are all the eye sees.
    expect(profile.rows.length).toBeGreaterThanOrEqual(3);
    expect(profile.rows.length).toBeLessThanOrEqual(5);
  });

  it('keeps the facet count off the level-of-detail knob', () => {
    // ADR-0004 made facets data: the monarch earns them with the couple's
    // photos. Reducing them on a weaker phone would show the same couple a
    // differently shaped crystal, which is the same defect the device body
    // cap had.
    const body = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 13 } };
    const counts = (['high', 'medium', 'low'] as const)
      .map((lod) => buildCrystalProfile(body, lod).ring!.length);

    expect(new Set(counts).size).toBe(1);
  });

  it('spends earned facets on chamfers rather than on more sides', () => {
    // Semantic change (2026-08-03): earning facets used to add sides, up to 24
    // of them, and every face came out narrow. Visual review called the result
    // a "pink obelisk" — narrow faces read as noise, not as a cut stone. The
    // main faces are fixed at six or seven now, and everything earned beyond
    // them cuts one specific edge instead.
    const ringFor = (facetCount: number) => buildCrystalProfile(
      { ...motherBody(), attributes: { ...motherBody().attributes, facetCount } },
      'high',
    ).ring!;

    for (const facetCount of [6, 9, 13, 24]) {
      const ring = ringFor(facetCount);
      const main = ring.filter((facet) => !facet.chamfer);
      expect(main.length).toBeGreaterThanOrEqual(6);
      expect(main.length).toBeLessThanOrEqual(7);
    }

    // More photos still make a richer crystal — just not a narrower one.
    expect(ringFor(13).filter((f) => f.chamfer).length)
      .toBeGreaterThan(ringFor(6).filter((f) => f.chamfer).length);
    // And the richness has a ceiling, so a couple with thousands of photos
    // still has a prism.
    expect(ringFor(500).filter((f) => f.chamfer).length).toBeLessThanOrEqual(12);
  });

  it('refuses a facet count that would not close into a solid', () => {
    const tooFew = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 1 } };
    const tooMany = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 500 } };

    expect(buildCrystalProfile(tooFew, 'high').segments).toBeGreaterThanOrEqual(4);
    expect(buildCrystalProfile(tooMany, 'high').segments).toBeLessThanOrEqual(24);
  });

  it('builds the monarch as a prism with a shoulder, not as a bullet', () => {
    // Semantic change (2026-08-03, reference pass): the monarch used to be
    // widest at 12% of its height and taper from there. That is a bullet — and
    // it is why the owner still read it as "a ball sticking out of the ground"
    // after the faceting pass: no amount of facets rescues a silhouette with no
    // straight run and no corner in it.
    //
    // The reference crystals are narrower at the base, swell gently up the
    // shaft, and break at a shoulder into a short sharp termination. That
    // shoulder is the widest point and it sits high.
    //
    // Measured on radiusX, the actual rendered ellipse radius. `row.radius` is
    // the conservative trim envelope — it folds in the axis-lean offset, which
    // grows up the body, so it is not a silhouette measurement.
    const profile = buildCrystalProfile(motherBody(), 'high');
    const rows = profile.rows;
    const top = rows[rows.length - 1]!.y;
    const widestIndex = rows.reduce(
      (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
      0,
    );
    const widest = rows[widestIndex]!.radiusX;

    // The shoulder sits where a quartz termination begins.
    expect(rows[widestIndex]!.y / top).toBeGreaterThanOrEqual(0.6);
    expect(rows[widestIndex]!.y / top).toBeLessThanOrEqual(0.82);

    const radiusNear = (fraction: number): number => {
      const targetY = top * fraction;
      return rows.reduce(
        (best, row) => (
          Math.abs(row.y - targetY) < Math.abs(best.y - targetY) ? row : best
        ),
        rows[0]!,
      ).radiusX;
    };

    // Narrower at the base, but only just: the radius is nearly stable up the
    // shaft so the sides read as parallel and the shoulder is the only place
    // the silhouette turns a corner.
    expect(radiusNear(0)).toBeLessThan(widest * 0.95);
    expect(radiusNear(0)).toBeGreaterThan(widest * 0.8);

    // And the termination is short and decisive rather than a long fade.
    expect(radiusNear(1)).toBeLessThan(widest * 0.1);
  });

  it('gives each crystal its own crown instead of one stamped shape', () => {
    // Shoulder height and the number of chamfers vary per body, so a colony
    // does not read as one model placed several times.
    const shoulders = new Set<number>();
    const rowsAboveShoulder = new Set<number>();

    for (let seed = 1; seed <= 40; seed += 1) {
      const profile = buildCrystalProfile({ ...motherBody(), seed: seed * 7919 }, 'high');
      const rows = profile.rows;
      const top = rows[rows.length - 1]!.y;
      const widestIndex = rows.reduce(
        (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
        0,
      );
      const share = rows[widestIndex]!.y / top;

      // Every crystal keeps a real shoulder in the documented band.
      expect(share).toBeGreaterThanOrEqual(0.6);
      expect(share).toBeLessThanOrEqual(0.82);
      shoulders.add(Math.round(share * 100));
      // Exactly one row above the shoulder — the tip. The crown is one
      // straight run from the shoulder ring to the point on every crystal: the
      // intermediate rows that used to vary here sat on `pow(along, 0.8)`,
      // which falls faster than a straight line right after the shoulder, and
      // that is the inward curve visual review rejected (2026-08-03).
      rowsAboveShoulder.add(rows.length - 1 - widestIndex);
    }

    expect(shoulders.size).toBeGreaterThan(5);
    expect([...rowsAboveShoulder]).toEqual([1]);
  });

  it('keeps the monarch nearer vertical than the crystals around it', () => {
    // The monarch is the axis of the colony. Its lean used to be the largest of
    // any body (0.26 against 0.1 for a default child) — the one crystal that
    // has to read as the centre was leaning hardest while the children it
    // should have leaned against stood straight.
    const leanOf = (body: Parameters<typeof buildCrystalProfile>[0]): number => {
      const profile = buildCrystalProfile(body, 'high');
      return Math.hypot(profile.axisLeanX, profile.axisLeanZ) / body.renderedRadius;
    };

    let motherLeans = 0;
    let childLeans = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      motherLeans += leanOf({ ...motherBody(), seed: seed * 6151 });
      childLeans += leanOf({ ...crystalBody(), seed: seed * 6151 });
    }

    expect(motherLeans / 30).toBeLessThan(childLeans / 30);
  });

  it('tests trim occupancy against the bent elliptical shell, not a straight radius envelope', () => {
    const mother = motherBody();
    const mesh = buildCrystalMesh(mother, 'low');
    // The shoulder — the widest slice, and the one whose occupancy test is
    // most load-bearing. Addressed by role rather than by index: the crown's
    // intermediate rows are gone (2026-08-03), so a fixed index no longer
    // points anywhere in particular.
    const row = mesh.profile.rows.reduce(
      (widest, candidate) => (candidate.radiusX > widest.radiusX ? candidate : widest),
      mesh.profile.rows[0]!,
    );
    const { tangent, bitangent } = orthonormalBasis(mother.direction);
    const center = add(
      add(
        add(mesh.profile.geometryAnchor, scale(mother.direction, row.y)),
        scale(tangent, row.centerOffsetX),
      ),
      scale(bitangent, row.centerOffsetZ),
    );
    const solid = { body: mother, profile: mesh.profile, bounds: mesh.bounds };
    const inside = add(center, scale(tangent, row.radiusX * 0.95));
    const outside = add(center, scale(tangent, row.radiusX * 1.05));

    expect(pointInsideCrystalSolid(center, solid, 0)).toBe(true);
    expect(pointInsideCrystalSolid(inside, solid, 0)).toBe(true);
    expect(pointInsideCrystalSolid(outside, solid, 0)).toBe(false);
  });
});

describe('crystal faceting — slices', () => {
  it('is still deterministic for the same body', () => {
    expect(buildCrystalProfile(motherBody(), 'high'))
      .toEqual(buildCrystalProfile(motherBody(), 'high'));
    expect(buildCrystalMesh(motherBody(), 'high'))
      .toEqual(buildCrystalMesh(motherBody(), 'high'));
  });
});

describe('crystal faceting — triangulation', () => {
  it('keeps every triangle wound outward after the split alternates', () => {
    // Both splits are valid triangulations of the same quad, but only if they
    // wind the same way. Signed volume is positive only when they do.
    for (const body of [motherBody(), crystalBody()]) {
      const mesh = buildCrystalMesh(body, 'high');
      let volume = 0;
      for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const a = mesh.indices[offset]! * 3;
        const b = mesh.indices[offset + 1]! * 3;
        const c = mesh.indices[offset + 2]! * 3;
        const p = mesh.positions;
        volume += (
          p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!)
          - p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!)
          + p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
        ) / 6;
      }
      expect(volume).toBeGreaterThan(0);
    }
  });
});

describe('crystal faceting — flat faces', () => {
  /**
   * The invariant the whole 2026-08-03 revert exists for.
   *
   * A side face is two triangles. If its four corners are coplanar the two
   * share a normal and the user sees one clean plane; if they are not, the two
   * take different normals and the crystal renders as a mosaic of small
   * triangles — which is exactly what visual review rejected.
   *
   * Per-slice turn, drift, radius swing and facet phase each break it, and each
   * was present. This test is what stops any of them coming back.
   */
  const maxCoplanarityError = (mesh: ReturnType<typeof buildCrystalMesh>): number => {
    const vertex = (index: number) => ({
      x: mesh.positions[index * 3]!,
      y: mesh.positions[index * 3 + 1]!,
      z: mesh.positions[index * 3 + 2]!,
    });
    const normalOf = (a: number, b: number, c: number) => {
      const p = vertex(a);
      const q = vertex(b);
      const r = vertex(c);
      const u = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
      const v = { x: r.x - p.x, y: r.y - p.y, z: r.z - p.z };
      const n = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      };
      const len = Math.hypot(n.x, n.y, n.z);
      return len < 1e-12 ? null : { x: n.x / len, y: n.y / len, z: n.z / len };
    };

    const segments = mesh.profile.ring!.length;
    const rowCount = mesh.profile.rows.length;
    // Base cap comes first, then the shell quads, two triangles each.
    const shellStart = segments;
    let worst = 0;
    for (let quad = 0; quad < (rowCount - 1) * segments; quad += 1) {
      const first = (shellStart + quad * 2) * 3;
      const second = first + 3;
      if (second + 2 >= mesh.indices.length) break;
      const a = normalOf(mesh.indices[first]!, mesh.indices[first + 1]!, mesh.indices[first + 2]!);
      const b = normalOf(mesh.indices[second]!, mesh.indices[second + 1]!, mesh.indices[second + 2]!);
      if (!a || !b) continue;
      const dot = a.x * b.x + a.y * b.y + a.z * b.z;
      worst = Math.max(worst, Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI));
    }
    return worst;
  };

  it('keeps both triangles of every side face in one plane', () => {
    for (const body of [motherBody(), crystalBody()]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const mesh = buildCrystalMesh({ ...body, seed: seed * 5077 }, 'high');
        // A tenth of a degree is float noise; a mosaic is tens of degrees.
        expect(maxCoplanarityError(mesh)).toBeLessThan(0.1);
      }
    }
  });

  it('keeps faces flat for a crystal that earned chamfers', () => {
    // Chamfers add ring entries, and a ring entry that varied with height would
    // reintroduce the defect on exactly the crystals that earned the most.
    for (const facetCount of [6, 10, 18, 24]) {
      const mesh = buildCrystalMesh(
        { ...motherBody(), attributes: { ...motherBody().attributes, facetCount } },
        'high',
      );
      expect(maxCoplanarityError(mesh)).toBeLessThan(0.1);
    }
  });

  it('draws few large faces rather than many small ones', () => {
    // The count is the other half of the complaint: 24 narrow sides read as
    // noise however flat each one is.
    const mesh = buildCrystalMesh(
      { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 24 } },
      'high',
    );
    const ring = mesh.profile.ring!;

    expect(ring.filter((facet) => !facet.chamfer).length).toBeLessThanOrEqual(7);
    // Base, shaft, shoulder, crown, tip — a handful of horizontal bands, not
    // the eight to ten the previous build stacked up.
    expect(mesh.profile.rows.length).toBeLessThanOrEqual(6);
  });

  it('runs the crown straight from shoulder to point', () => {
    // The crown used to bow inward: its intermediate rows sat on
    // `pow(along, 0.8)`, and an exponent under one falls faster than a straight
    // line right after the shoulder, pinching the radius there and easing out
    // again toward the tip.
    //
    // Checked as a property of the silhouette rather than as a row count, so a
    // future build may put rows back in the crown as long as they stay on the
    // line.
    for (const body of [motherBody(), crystalBody()]) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const rows = buildCrystalProfile({ ...body, seed: seed * 4093 }, 'high').rows;
        const shoulder = rows.reduce(
          (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
          0,
        );
        const tip = rows[rows.length - 1]!;
        const start = rows[shoulder]!;
        const span = tip.y - start.y;
        if (span <= 1e-9) continue;

        for (let index = shoulder + 1; index < rows.length - 1; index += 1) {
          const row = rows[index]!;
          const along = (row.y - start.y) / span;
          const straight = start.radiusX + (tip.radiusX - start.radiusX) * along;
          // Any crown row must sit on the line joining shoulder and tip.
          expect(Math.abs(row.radiusX - straight)).toBeLessThan(start.radiusX * 0.02);
        }
      }
    }
  });

  it('leans the whole crystal instead of each slice', () => {
    // "Нахиляється весь кристал, а не кожен його горизонтальний зріз окремо."
    const profile = buildCrystalProfile(crystalBody(), 'high');
    const rows = profile.rows;
    const top = rows[rows.length - 1]!;

    // Offsets rise straight from zero at the base to the full lean at the tip.
    for (let index = 1; index < rows.length; index += 1) {
      expect(Math.abs(rows[index]!.centerOffsetX)).toBeGreaterThanOrEqual(
        Math.abs(rows[index - 1]!.centerOffsetX) - 1e-9,
      );
    }
    expect(Math.hypot(top.centerOffsetX, top.centerOffsetZ)).toBeGreaterThan(0);
  });
});
