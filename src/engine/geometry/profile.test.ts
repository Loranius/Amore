import { describe, expect, it } from 'vitest';
import type { GrowthBody } from '../growth';
import { add, orthonormalBasis, scale } from '../growth/math';
import { buildCrystalMesh } from './mesh';
import { intersectHalfSpaces, polytopeTolerance } from './polytope';
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
  it('publishes a deterministic solid with lean, burial metadata and an envelope', () => {
    const body = crystalBody();
    const first = buildCrystalProfile(body, 'high');
    const repeated = buildCrystalProfile(body, 'high');

    expect(repeated).toEqual(first);
    expect(Math.abs(first.axisLeanX) + Math.abs(first.axisLeanZ)).toBeGreaterThan(0);
    expect(first.burialStartY).toBe(first.extraSink);
    expect(first.burialCompression).toBeGreaterThanOrEqual(0.62);
    expect(first.burialCompression).toBeLessThanOrEqual(0.76);

    // Twist is published as zero and no longer earned (ADR-0006). It is the one
    // thing the plane model gave up: a twist rotates every height by a
    // different angle, which is not an affine map of the solid, so it bends a
    // flat face into a helicoid — and a helicoid can only be drawn as triangles
    // that disagree about their normal. That is the mosaic. The crystal's
    // asymmetry now comes from its faces being unequal instead.
    expect(first.twistTotal).toBe(0);
    expect(first.rows.every((row) => row.rotation === 0)).toBe(true);
    expect(first.rows.every((row) => row.facetPhase === 0)).toBe(true);

    // The cut set is the shape; the rows only report it.
    const planes = first.planes!;
    expect(planes.length).toBeGreaterThan(6);
    expect(planes.filter((plane) => plane.kind === 'base')).toHaveLength(1);
    expect(planes.filter((plane) => plane.kind === 'prism').length).toBeGreaterThanOrEqual(5);
    expect(planes.filter((plane) => plane.kind === 'crown').length).toBeGreaterThanOrEqual(4);
    for (const plane of planes) {
      // Unit to within `round6` on each component, which is what the published
      // state can carry.
      expect(Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z)).toBeCloseTo(1, 5);
      expect(Number.isFinite(plane.offset)).toBe(true);
    }

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

  it('keeps the published envelope outside the solid it describes', () => {
    // `rows` stopped being the recipe and became a report (ADR-0006), and the
    // one thing a report must not do is understate. Everything downstream that
    // still reads rows — the trim's occupancy test above all — treats them as
    // "the body is at most this wide here", so an envelope that cut inside the
    // crystal would let the trim delete triangles that are genuinely visible.
    for (const body of [motherBody(), crystalBody()]) {
      for (let seed = 1; seed <= 8; seed += 1) {
        const shaped = { ...body, seed: seed * 3571 };
        const profile = buildCrystalProfile(shaped, 'high');
        const polytope = intersectHalfSpaces(
          profile.planes!,
          polytopeTolerance(shaped.renderedRadius),
        )!;
        const rows = profile.rows;

        for (const vertex of polytope.vertices) {
          // The row at or above this vertex's height is the one that has to
          // contain it.
          const row = rows.find((candidate) => candidate.y >= vertex.y - 1e-6) ?? rows[rows.length - 1]!;
          const previous = rows[Math.max(0, rows.indexOf(row) - 1)]!;
          const widestX = Math.max(row.radiusX, previous.radiusX);
          const widestZ = Math.max(row.radiusZ, previous.radiusZ);
          expect(Math.abs(vertex.x)).toBeLessThanOrEqual(widestX + 1e-6);
          expect(Math.abs(vertex.z)).toBeLessThanOrEqual(widestZ + 1e-6);
        }
      }
    }
  });

  it('keeps the mother silhouette visibly organic even at low LOD', () => {
    const mother = motherBody();
    const profile = buildCrystalProfile(mother, 'low');
    const leanMagnitude = Math.hypot(profile.axisLeanX, profile.axisLeanZ);

    expect(profile.archetype).toBe('prismatic');
    expect(profile.burialStartY).toBe(0);
    expect(profile.burialCompression).toBe(1);
    // Lean ceiling dropped from 0.26 to 0.09 of the radius (2026-08-03): the
    // monarch is the colony's axis and has to read as near-vertical. It still
    // leans — a perfectly upright crystal reads as placed rather than grown.
    expect(leanMagnitude).toBeGreaterThan(0);
    expect(leanMagnitude).toBeLessThanOrEqual(mother.renderedRadius * 0.09);
    // Cross-section rounded from 1.44:1 to 1.18:1 (2026-08-02 monarch reshape)
    // — the monarch was reading as a flat slab. Asymmetry is retained
    // deliberately; it just no longer dominates the shape.
    expect(profile.scaleX).toBe(0.9);
    expect(profile.scaleZ).toBe(1.06);
    // Low LOD spends fewer crown planes and no bevels, but it must still be the
    // same crystal: the habit is semantics (ADR-0004), not detail.
    const planes = profile.planes!;
    expect(planes.filter((plane) => plane.kind === 'bevel')).toHaveLength(0);
    expect(planes.filter((plane) => plane.kind === 'prism').length)
      .toBe(buildCrystalProfile(mother, 'high').planes!.filter((plane) => plane.kind === 'prism').length);
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
    // Shoulder height varies per body, so a colony does not read as one model
    // placed several times — and it varies within a band, so a crystal never
    // becomes a spike or a dome.
    //
    // The shoulder is measured off the published envelope, which since
    // ADR-0006 is sampled at the solid's own vertex heights and so reports the
    // silhouette exactly rather than at a fixed grid.
    const shoulders = new Set<number>();

    for (let seed = 1; seed <= 40; seed += 1) {
      const profile = buildCrystalProfile({ ...motherBody(), seed: seed * 7919 }, 'high');
      const rows = profile.rows;
      const top = rows[rows.length - 1]!.y;
      const widestIndex = rows.reduce(
        (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
        0,
      );
      const share = rows[widestIndex]!.y / top;

      // Every crystal keeps a real shoulder, high on the body.
      expect(share).toBeGreaterThanOrEqual(0.5);
      expect(share).toBeLessThanOrEqual(0.9);
      shoulders.add(Math.round(share * 100));

      // Below the shoulder the body only widens, above it only narrows. That is
      // what makes the silhouette a prism with a corner in it rather than a
      // bullet or a barrel — and it was not true while the crown planes were
      // built from an inverted angle, which put the widest slice at the base on
      // half of all seeds.
      // Tolerance is a fraction of the body, not float noise: the envelope
      // measures the furthest point from the axis, and the crystal leans, so
      // the far side of a narrowing termination can still drift outward by a
      // fraction of a percent. A bullet or a barrel misses by tens of percent.
      const slack = rows[widestIndex]!.radiusX * 0.02;
      for (let index = 1; index <= widestIndex; index += 1) {
        expect(rows[index]!.radiusX).toBeGreaterThanOrEqual(rows[index - 1]!.radiusX - slack);
      }
      for (let index = widestIndex + 1; index < rows.length; index += 1) {
        expect(rows[index]!.radiusX).toBeLessThanOrEqual(rows[index - 1]!.radiusX + slack);
      }
    }

    // Twenty distinct shoulder heights over forty seeds: each crystal's own.
    expect(shoulders.size).toBeGreaterThan(10);
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

  it('tests trim occupancy against the solid itself, not against an envelope', () => {
    // Since ADR-0006 the body publishes the half-spaces it was cut from, so
    // "is this point inside" is answered exactly rather than against an
    // elliptical approximation of a polygonal cross-section. That matters
    // because the envelope is deliberately conservative — it circumscribes the
    // section — and a trim run against it would keep triangles that are
    // genuinely hidden.
    const mother = motherBody();
    const mesh = buildCrystalMesh(mother, 'low');
    const solid = { body: mother, profile: mesh.profile, bounds: mesh.bounds };
    const polytope = intersectHalfSpaces(
      mesh.profile.planes!,
      polytopeTolerance(mother.renderedRadius),
    )!;

    // The centroid is inside; every vertex is on the boundary; a point pushed
    // out along any face normal is outside.
    const centroid = polytope.vertices.reduce(
      (sum, vertex) => ({
        x: sum.x + vertex.x / polytope.vertices.length,
        y: sum.y + vertex.y / polytope.vertices.length,
        z: sum.z + vertex.z / polytope.vertices.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const { tangent, bitangent } = orthonormalBasis(mother.direction);
    const toWorld = (local: { x: number; y: number; z: number }) => add(
      add(
        add(mesh.profile.geometryAnchor, scale(tangent, local.x)),
        scale(mother.direction, local.y),
      ),
      scale(bitangent, -local.z),
    );

    expect(pointInsideCrystalSolid(toWorld(centroid), solid, 0)).toBe(true);
    for (const vertex of polytope.vertices) {
      expect(pointInsideCrystalSolid(toWorld(vertex), solid, 1e-4)).toBe(true);
    }
    for (const plane of mesh.profile.planes!) {
      if (plane.kind === 'safety') continue;
      const outside = {
        x: centroid.x + plane.normal.x * 10,
        y: centroid.y + plane.normal.y * 10,
        z: centroid.z + plane.normal.z * 10,
      };
      expect(pointInsideCrystalSolid(toWorld(outside), solid, 0)).toBe(false);
    }
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

describe('crystal faceting — flat faces (ADR-0006)', () => {
  /**
   * The invariant the whole plane model exists for.
   *
   * A crystal is the intersection of its published half-spaces, so every face
   * is a plane and every triangle cut from that face must lie in it. This is
   * what lets the faces be as unequal as a real crystal's — different widths,
   * pitches, lengths, shoulder heights — without any of them bending. The lathe
   * that came before could only vary a face by bending it, which is why any
   * attempt at natural variation came back as a mosaic of small triangles.
   *
   * Measured against the face's own plane rather than between neighbouring
   * triangles: with a fan of five or six triangles per face, pairwise
   * comparison would let a slow drift through.
   */
  const worstFaceTilt = (
    body: ReturnType<typeof motherBody>,
    minimumAreaShare: number,
  ): number => {
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
    let worst = 0;

    for (const face of polytope.faces) {
      const plane = planes[face.planeIndex]!;
      const triangles: { normal: number[]; area: number }[] = [];
      let faceArea = 0;
      for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
        const a = polytope.vertices[face.loop[0]!]!;
        const b = polytope.vertices[face.loop[corner]!]!;
        const c = polytope.vertices[face.loop[corner + 1]!]!;
        const u = [b.x - a.x, b.y - a.y, b.z - a.z];
        const v = [c.x - a.x, c.y - a.y, c.z - a.z];
        const cross = [
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ];
        const length = Math.hypot(cross[0]!, cross[1]!, cross[2]!);
        faceArea += length * 0.5;
        if (length < 1e-14) continue;
        triangles.push({ normal: cross.map((value) => value / length), area: length * 0.5 });
      }

      for (const triangle of triangles) {
        if (triangle.area < faceArea * minimumAreaShare) continue;
        const alignment = Math.abs(
          triangle.normal[0]! * plane.normal.x
          + triangle.normal[1]! * plane.normal.y
          + triangle.normal[2]! * plane.normal.z,
        );
        worst = Math.max(worst, Math.acos(Math.min(1, alignment)) * (180 / Math.PI));
      }
    }
    return worst;
  };

  it('keeps every triangle of a face in that face`s plane', () => {
    for (const body of [motherBody(), crystalBody()]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        // Under half a degree is `round6` quantisation on coordinates this
        // small — measured at 0.27° over 500 seeds — while a mosaic is tens of
        // degrees. Triangles carrying under a hundredth of their face are
        // sub-pixel splinters of the fan and are excluded: their normals are
        // dominated by the same rounding and they cover nothing.
        expect(worstFaceTilt({ ...body, seed: seed * 5077 }, 0.01)).toBeLessThan(0.45);
      }
    }
  });

  it('keeps faces flat for a crystal that earned bevels', () => {
    // Bevels add planes, and a plane that varied with height would reintroduce
    // the defect on exactly the crystals that earned the most.
    for (const facetCount of [6, 10, 18, 24]) {
      const body = {
        ...motherBody(),
        attributes: { ...motherBody().attributes, facetCount },
      };
      expect(worstFaceTilt(body, 0.01)).toBeLessThan(0.45);
    }
  });

  it('draws few large faces rather than many small ones', () => {
    // The count is the other half of the original complaint: 24 narrow sides
    // read as noise however flat each one is.
    const body = {
      ...motherBody(),
      attributes: { ...motherBody().attributes, facetCount: 24 },
    };
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
    const kinds = polytope.faces.map((face) => planes[face.planeIndex]!.kind);

    expect(kinds.filter((kind) => kind === 'prism').length).toBeLessThanOrEqual(7);
    expect(kinds.filter((kind) => kind === 'base')).toHaveLength(1);
    // The safety box exists to keep a degenerate seed bounded. If it ever cuts
    // a real crystal the shape is being decided by a guard rail rather than by
    // the geology, which is a bug however well it renders.
    expect(kinds.filter((kind) => kind === 'safety')).toHaveLength(0);
    expect(polytope.faces.length).toBeLessThanOrEqual(24);
  });

  it('makes the faces genuinely unequal, not merely irregular', () => {
    // The requirement in one measurement. Natural quartz keeps the hexagonal
    // habit but no two faces are the same size, so the largest prism face has
    // to be substantially larger than the smallest — and the crystal has to
    // stay recognisably a prism while it happens.
    const body = motherBody();
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;

    const prismAreas = polytope.faces
      .filter((face) => planes[face.planeIndex]!.kind === 'prism')
      .map((face) => {
        let area = 0;
        for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
          const a = polytope.vertices[face.loop[0]!]!;
          const b = polytope.vertices[face.loop[corner]!]!;
          const c = polytope.vertices[face.loop[corner + 1]!]!;
          const u = [b.x - a.x, b.y - a.y, b.z - a.z];
          const v = [c.x - a.x, c.y - a.y, c.z - a.z];
          area += Math.hypot(
            u[1]! * v[2]! - u[2]! * v[1]!,
            u[2]! * v[0]! - u[0]! * v[2]!,
            u[0]! * v[1]! - u[1]! * v[0]!,
          ) * 0.5;
        }
        return area;
      })
      .sort((left, right) => right - left);

    expect(prismAreas.length).toBeGreaterThanOrEqual(5);
    // A lathe gave every face the same area to within its ±5% radius jitter.
    expect(prismAreas[0]!).toBeGreaterThan(prismAreas[prismAreas.length - 1]! * 1.5);
  });

  it('puts each face`s shoulder at its own height and drifts the tip off-axis', () => {
    // "Плечі починаються на трохи різній висоті", "вісь і верхівка зміщуються
    // від центру". Both are properties of the finished solid rather than of a
    // parameter, so both are measured on it.
    const body = motherBody();
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;

    // The top of each prism face is where its shoulder is. They must not agree.
    const shoulders = polytope.faces
      .filter((face) => planes[face.planeIndex]!.kind === 'prism')
      .map((face) => Math.max(...face.loop.map((index) => polytope.vertices[index]!.y)));
    const highest = Math.max(...shoulders);
    const lowest = Math.min(...shoulders);
    expect(highest - lowest).toBeGreaterThan(profile.geometryLength * 0.02);

    // The tip is off the axis.
    const topY = Math.max(...polytope.vertices.map((vertex) => vertex.y));
    const tip = polytope.vertices.filter((vertex) => vertex.y > topY - 1e-6)[0]!;
    expect(Math.hypot(tip.x, tip.z)).toBeGreaterThan(0);
  });

  it('is deterministic and unique per body', () => {
    // The geological identity: the same couple gets the same crystal on every
    // reload, and no two bodies in a colony get the same one.
    const first = buildCrystalProfile(motherBody(), 'high');
    expect(buildCrystalProfile(motherBody(), 'high')).toEqual(first);

    const signatures = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => buildCrystalProfile({ ...motherBody(), seed: seed * 7919 }, 'high').signature,
      ),
    );
    expect(signatures.size).toBe(8);
  });
});
