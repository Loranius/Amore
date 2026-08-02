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

    const lastRow = first.rows[first.rows.length - 1]!;
    expect(lastRow.rotation).toBe(first.twistTotal);
    expect(lastRow.centerOffsetX).toBe(first.axisLeanX);
    expect(lastRow.centerOffsetZ).toBe(first.axisLeanZ);

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
    expect(profile.rows).toHaveLength(8);
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
