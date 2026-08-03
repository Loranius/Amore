import { describe, expect, it } from 'vitest';
import type { GrowthBody } from '../growth';
import {
  add,
  orthonormalBasis,
  round6,
  scale,
  seededUnit,
} from '../growth/math';
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
    expect(first.rows.some((row) => Math.abs(row.facetPhase) > 1e-6)).toBe(true);

    // Semantic change (faceting pass, 2026-08-02): the top slice no longer
    // *equals* the body-wide twist and lean. Those two are smooth curves that
    // move the whole silhouette together, and a shape whose every slice agrees
    // with its neighbours has no edges in it — the crystal read as a spun ball.
    // Each slice now turns and drifts on its own, so the top carries the
    // accumulated turn plus its own drift, and is only *anchored* by the
    // body-wide values.
    const lastRow = first.rows[first.rows.length - 1]!;
    expect(Math.sign(lastRow.rotation)).toBe(Math.sign(first.twistTotal));
    expect(Math.abs(lastRow.rotation)).toBeGreaterThan(Math.abs(first.twistTotal));
    expect(lastRow.centerOffsetX).not.toBe(first.axisLeanX);
    // The tip drifts off the axis, but by a fraction of its own radius — it
    // must not swing so far that the crystal leans over.
    const tipDrift = Math.hypot(
      lastRow.centerOffsetX - first.axisLeanX,
      lastRow.centerOffsetZ - first.axisLeanZ,
    );
    expect(tipDrift).toBeGreaterThan(0);
    expect(tipDrift).toBeLessThan(body.renderedRadius * 0.2);

    // Neighbouring slices must actually disagree — this is the property the
    // whole pass exists for, and the one a future simplification would break.
    for (let index = 1; index < first.rows.length; index += 1) {
      const turn = Math.abs(first.rows[index]!.rotation - first.rows[index - 1]!.rotation);
      expect(turn).toBeGreaterThan(0.02);
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

  it('uses row ellipse, axis offset, twist and facet phase in mesh vertices', () => {
    const body = crystalBody();
    const mesh = buildCrystalMesh(body, 'high');
    const rowIndex = Math.min(2, mesh.profile.rows.length - 1);
    const row = mesh.profile.rows[rowIndex]!;
    const segment = 0;
    const { tangent, bitangent } = orthonormalBasis(body.direction);
    const center = add(
      add(
        add(mesh.profile.geometryAnchor, scale(body.direction, row.y)),
        scale(tangent, row.centerOffsetX),
      ),
      scale(bitangent, row.centerOffsetZ),
    );
    const angleStep = (Math.PI * 2) / mesh.profile.segments;
    const facetAngleJitter = (seededUnit(body.seed, 'geometry:facet-angle:0') - 0.5) * angleStep * 0.28;
    const rowAngleJitter = (seededUnit(body.seed, `geometry:facet-angle-row:${rowIndex}:0`) - 0.5)
      * angleStep * 0.07;
    const angle = facetAngleJitter + rowAngleJitter + row.rotation + row.facetPhase;
    const facetJitter = seededUnit(body.seed, 'geometry:facet:0') - 0.5;
    const rowJitter = seededUnit(body.seed, `geometry:facet-row:${rowIndex}:0`) - 0.5;
    const jitter = 1 + facetJitter * 0.07 + rowJitter * 0.026;
    const expected = add(
      center,
      add(
        scale(tangent, Math.cos(angle) * row.radiusX * jitter),
        scale(bitangent, Math.sin(angle) * row.radiusZ * jitter),
      ),
    );
    const offset = (rowIndex * mesh.profile.segments + segment) * 3;

    expect(mesh.positions.slice(offset, offset + 3)).toEqual([
      round6(expected.x),
      round6(expected.y),
      round6(expected.z),
    ]);
  });

  it('gives ring facets irregular widths instead of a perfectly even polygon', () => {
    // A hand-cut gem reads as organic because its facets vary in width; a
    // perfectly even polygon reads as a machined/plastic prism (visual QA
    // finding on the Amore crystal preview, 2026-08-02).
    const body = crystalBody();
    const mesh = buildCrystalMesh(body, 'high');
    const segments = mesh.profile.segments;
    const rowIndex = Math.min(2, mesh.profile.rows.length - 1);
    const { tangent, bitangent } = orthonormalBasis(body.direction);
    const row = mesh.profile.rows[rowIndex]!;
    const center = add(
      add(
        add(mesh.profile.geometryAnchor, scale(body.direction, row.y)),
        scale(tangent, row.centerOffsetX),
      ),
      scale(bitangent, row.centerOffsetZ),
    );

    const rowStart = rowIndex * segments;
    const angles: number[] = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const offset = (rowStart + segment) * 3;
      const vertex = {
        x: mesh.positions[offset]!,
        y: mesh.positions[offset + 1]!,
        z: mesh.positions[offset + 2]!,
      };
      const local = {
        x: (vertex.x - center.x) * tangent.x + (vertex.y - center.y) * tangent.y + (vertex.z - center.z) * tangent.z,
        z: (vertex.x - center.x) * bitangent.x + (vertex.y - center.y) * bitangent.y + (vertex.z - center.z) * bitangent.z,
      };
      angles.push(Math.atan2(local.z, local.x));
    }

    const gaps: number[] = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      let gap = angles[next]! - angles[segment]!;
      while (gap <= 0) gap += Math.PI * 2;
      gaps.push(gap);
    }

    // Non-degenerate: winding stays monotonic, no facet collapses or crosses
    // its neighbour.
    expect(gaps.every((gap) => gap > 0.001)).toBe(true);
    expect(gaps.reduce((sum, gap) => sum + gap, 0)).toBeCloseTo(Math.PI * 2, 5);

    // Irregular: facet widths are not all equal, unlike a plain even polygon.
    const maxGap = Math.max(...gaps);
    const minGap = Math.min(...gaps);
    expect(maxGap - minGap).toBeGreaterThan(0.01);
  });

  it('keeps the mother silhouette visibly organic even at low LOD', () => {
    const mother = motherBody();
    const profile = buildCrystalProfile(mother, 'low');
    const leanMagnitude = Math.hypot(profile.axisLeanX, profile.axisLeanZ);

    expect(profile.archetype).toBe('prismatic');
    expect(profile.burialStartY).toBe(0);
    expect(profile.burialCompression).toBe(1);
    expect(Math.abs(profile.twistTotal)).toBeGreaterThanOrEqual(0.11);
    expect(leanMagnitude).toBeGreaterThanOrEqual(mother.renderedRadius * 0.129);
    // Cross-section rounded from 1.44:1 to 1.18:1 and the taper extended into
    // one extra row (2026-08-02 monarch reshape) — the monarch was reading as
    // a flat slab with a capped cylinder silhouette. Asymmetry is retained
    // deliberately; it just no longer dominates the shape.
    expect(profile.scaleX).toBe(0.9);
    expect(profile.scaleZ).toBe(1.06);
    // Eight rows became ten in the faceting pass (2026-08-02): the shaft ran
    // from 0.12 to 0.62 of its height without a single horizontal edge, and
    // that unbroken stretch is what read as a ball.
    expect(profile.rows).toHaveLength(10);
  });

  it('keeps the facet count off the level-of-detail knob', () => {
    // ADR-0004 made facets data: the monarch earns them with the couple's
    // photos. Reducing them on a weaker phone would show the same couple a
    // differently shaped crystal, which is the same defect the device body
    // cap had. LOD reduces rows and drops small bodies instead.
    const body = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 13 } };

    for (const lod of ['high', 'medium', 'low'] as const) {
      expect(buildCrystalProfile(body, lod).segments).toBe(13);
    }
  });

  it('refuses a facet count that would not close into a solid', () => {
    const tooFew = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 1 } };
    const tooMany = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 500 } };

    expect(buildCrystalProfile(tooFew, 'high').segments).toBeGreaterThanOrEqual(4);
    expect(buildCrystalProfile(tooMany, 'high').segments).toBeLessThanOrEqual(24);
  });

  it('tapers the monarch continuously instead of holding a cylinder', () => {
    // The monarch is the composition's focal point, so its silhouette carries
    // the most weight. Holding near-full radius up the shaft and then cutting
    // to a point reads as a capped column rather than a spire.
    //
    // Measured on radiusX, the actual rendered ellipse radius. `row.radius` is
    // the conservative trim envelope — it folds in the axis-lean offset, which
    // grows up the body, so it is not a silhouette measurement and can peak
    // above the true shoulder.
    const profile = buildCrystalProfile(motherBody(), 'high');
    const rows = profile.rows;
    const top = rows[rows.length - 1]!.y;
    const widestIndex = rows.reduce(
      (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
      0,
    );
    const widest = rows[widestIndex]!.radiusX;

    // The shoulder sits low on the body, not halfway up it.
    expect(rows[widestIndex]!.y).toBeLessThan(top * 0.3);

    // Sample the silhouette rather than asserting strict row-to-row descent:
    // the profile carries deliberate per-row asymmetry noise, and demanding
    // monotonicity would be asserting that noise away.
    const radiusNear = (fraction: number): number => {
      const targetY = top * fraction;
      return rows.reduce(
        (best, row) => (
          Math.abs(row.y - targetY) < Math.abs(best.y - targetY) ? row : best
        ),
        rows[0]!,
      ).radiusX;
    };

    expect(radiusNear(0.6)).toBeLessThan(widest * 0.9);
    expect(radiusNear(0.8)).toBeLessThan(widest * 0.7);
    expect(radiusNear(1)).toBeLessThan(widest * 0.1);
  });

  it('tests trim occupancy against the bent elliptical shell, not a straight radius envelope', () => {
    const mother = motherBody();
    const mesh = buildCrystalMesh(mother, 'low');
    const row = mesh.profile.rows[3]!;
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
  it('turns every slice against the one below it, within one facet width', () => {
    // The property the whole faceting pass rests on. A lathe whose rings share
    // an orientation has one long vertical strip per facet running the entire
    // height; nothing on that strip tells the eye where a face begins.
    for (const facetCount of [6, 8, 13, 24]) {
      const body = {
        ...motherBody(),
        attributes: { ...motherBody().attributes, facetCount },
      };
      const profile = buildCrystalProfile(body, 'high');
      const facetWidth = (Math.PI * 2) / facetCount;
      let signs = new Set<number>();

      for (let index = 1; index < profile.rows.length; index += 1) {
        const turn = profile.rows[index]!.rotation - profile.rows[index - 1]!.rotation;
        expect(Math.abs(turn)).toBeGreaterThan(0.02);
        // Never more than a fraction of a facet: a turn approaching one full
        // facet would shear every quad into a sliver instead of a face.
        expect(Math.abs(turn)).toBeLessThan(facetWidth * 0.6);
        signs.add(Math.sign(turn));
      }

      // One direction the whole way up. A crystal that reverses its twist
      // halfway reads as a mistake rather than as growth.
      expect(signs.size).toBe(1);
    }
  });

  it('never lets the turn cost more than the facets are worth', () => {
    // A 24-facet monarch has facets 15° wide. Turning each slice by the same
    // absolute angle as a 6-facet one would shear them into slivers, so the
    // step has to shrink as facets narrow.
    const turnFor = (facetCount: number): number => {
      const profile = buildCrystalProfile(
        { ...motherBody(), attributes: { ...motherBody().attributes, facetCount } },
        'high',
      );
      return Math.abs(profile.rows[1]!.rotation - profile.rows[0]!.rotation);
    };

    expect(turnFor(24)).toBeLessThan(turnFor(6));
  });

  it('drifts each slice sideways and finishes the tip off the axis', () => {
    const profile = buildCrystalProfile(motherBody(), 'high');
    const offsets = profile.rows.map((row) => ({ x: row.centerOffsetX, z: row.centerOffsetZ }));

    // No two consecutive slices sit on the same axis point.
    for (let index = 1; index < offsets.length; index += 1) {
      const moved = Math.hypot(
        offsets[index]!.x - offsets[index - 1]!.x,
        offsets[index]!.z - offsets[index - 1]!.z,
      );
      expect(moved).toBeGreaterThan(0);
    }

    // And the apex is not centred over the base.
    const tip = offsets[offsets.length - 1]!;
    expect(Math.hypot(tip.x, tip.z)).toBeGreaterThan(0);
  });

  it('varies each slice radius by 5-10% and stays a crystal, not a stack of coins', () => {
    const profile = buildCrystalProfile(motherBody(), 'high');
    for (const row of profile.rows) {
      // radiusX/radiusZ carry scale, pulse and the per-slice swing together;
      // what must hold is that neither collapses or blows up.
      expect(row.radiusX).toBeGreaterThan(0);
      expect(row.radiusZ).toBeGreaterThan(0);
      expect(row.radiusX / row.radiusZ).toBeGreaterThan(0.5);
      expect(row.radiusX / row.radiusZ).toBeLessThan(2);
    }

    // Consecutive slices differ, but the profile still tapers monotonically
    // enough to read as one crystal: no slice is wider than the widest below
    // it by more than the swing allows.
    const widths = profile.rows.map((row) => Math.max(row.radiusX, row.radiusZ));
    const widest = Math.max(...widths);
    expect(widths[widths.length - 1]).toBeLessThan(widest * 0.3);
  });

  it('is still deterministic for the same body', () => {
    expect(buildCrystalProfile(motherBody(), 'high'))
      .toEqual(buildCrystalProfile(motherBody(), 'high'));
    expect(buildCrystalMesh(motherBody(), 'high'))
      .toEqual(buildCrystalMesh(motherBody(), 'high'));
  });
});

describe('crystal faceting — triangulation', () => {
  it('alternates the quad diagonal instead of splitting every quad alike', () => {
    // Regression: every quad was split a→c, so every triangle in the body
    // shared one pair of edge directions and the whole surface caught light at
    // a single angle. Checked structurally rather than visually: the shell must
    // contain both diagonals.
    const mesh = buildCrystalMesh(motherBody(), 'high');
    const segments = mesh.profile.segments;
    const rowCount = mesh.profile.rows.length;
    const shellStart = segments; // base cap first
    const shellEnd = shellStart + (rowCount - 1) * segments * 2;

    const diagonals = new Set<string>();
    for (let triangle = shellStart; triangle < shellEnd; triangle += 2) {
      const offset = triangle * 3;
      // Second vertex of the first triangle of each quad identifies the split:
      // a,b,c for one diagonal and a,b,d for the other.
      const third = mesh.indices[offset + 2]!;
      const rowIndex = Math.floor((triangle - shellStart) / (segments * 2));
      const nextStart = (rowIndex + 1) * segments;
      diagonals.add(third === nextStart + ((Math.floor((triangle - shellStart) / 2) % segments))
        ? 'a-c'
        : 'a-d');
    }

    expect(diagonals.size).toBe(2);
  });

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
