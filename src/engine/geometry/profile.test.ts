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
    const angle = row.rotation + row.facetPhase;
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

  it('keeps the mother silhouette visibly organic even at low LOD', () => {
    const mother = motherBody();
    const profile = buildCrystalProfile(mother, 'low');
    const leanMagnitude = Math.hypot(profile.axisLeanX, profile.axisLeanZ);

    expect(profile.archetype).toBe('prismatic');
    expect(profile.burialStartY).toBe(0);
    expect(profile.burialCompression).toBe(1);
    expect(Math.abs(profile.twistTotal)).toBeGreaterThanOrEqual(0.11);
    expect(leanMagnitude).toBeGreaterThanOrEqual(mother.renderedRadius * 0.129);
    expect(profile.scaleX).toBe(0.78);
    expect(profile.scaleZ).toBe(1.12);
    expect(profile.segments).toBe(6);
    expect(profile.rows).toHaveLength(7);
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
