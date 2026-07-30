import { describe, expect, it } from 'vitest';
import {
  buildGrowthSurfaceAtlas,
  buildGrowthSurfaceAtlasFromMass,
} from './surfaceAtlas';
import type {
  GrowthBody,
  GrowthCenterRole,
  GrowthState,
  GrowthSurfaceOccupancy,
  GrowthTier,
  GrowthVec3,
} from './types';

function growthBody(input: {
  id: string;
  sequence: number;
  seed: number;
  anchor: GrowthVec3;
  radius: number;
  length: number;
  generation?: number;
  maturity?: number;
  tier?: GrowthTier;
  growthCenterId?: string;
  growthCenterRole?: GrowthCenterRole;
}): GrowthBody {
  const generation = input.generation ?? 0;
  return {
    id: input.id,
    instructionId: input.id,
    sourceId: input.id,
    species: 'crystal',
    kind: generation === 0 ? 'crystal:mother' : 'crystal:event-spire',
    tier: input.tier ?? (generation === 0 ? 'king' : 'support'),
    attributes: {},
    sequence: input.sequence,
    colonyId: input.growthCenterId ?? null,
    epochIndex: 0,
    seed: input.seed,
    emphasized: false,
    generation,
    hostBodyId: generation === 0 ? null : 'mother',
    attachment: null,
    anchor: input.anchor,
    direction: { x: 0, y: 1, z: 0 },
    skeletonLength: input.length,
    skeletonRadius: input.radius,
    surfaceRadiusScale: 0.76,
    renderedLength: input.length,
    renderedRadius: input.radius,
    maturity: input.maturity ?? 0.8,
    growthEnergy: 1,
    competition: generation === 0 ? 0 : 0.18,
    crowding: generation === 0 ? 0 : 0.45,
    ...(input.growthCenterId === undefined
      ? {}
      : { growthCenterId: input.growthCenterId }),
    ...(input.growthCenterRole === undefined
      ? {}
      : { growthCenterRole: input.growthCenterRole }),
  };
}

const MOTHER = growthBody({
  id: 'mother',
  sequence: -1,
  seed: 101,
  anchor: { x: 0, y: 0, z: 0 },
  radius: 0.34,
  length: 1.64,
});

const SUPPORT = growthBody({
  id: 'support',
  sequence: 0,
  seed: 202,
  anchor: { x: 0.22, y: 0.28, z: 0.02 },
  radius: 0.16,
  length: 0.82,
  generation: 1,
});

const LATER = growthBody({
  id: 'later',
  sequence: 1,
  seed: 303,
  anchor: { x: -0.24, y: 0.34, z: 0.04 },
  radius: 0.14,
  length: 0.68,
  generation: 1,
  maturity: 0.55,
});

function growthState(
  bodies: GrowthBody[] = [MOTHER, SUPPORT],
  occupiedSites: GrowthSurfaceOccupancy[] = [],
): GrowthState {
  return {
    growthStateVersion: 1,
    rulesVersion: 'surface-atlas-test@1',
    sourceBlueprintVersion: 'crystal:test',
    engineVersion: '1.0.0',
    speciesRulesVersion: '1.0.0',
    species: 'crystal',
    artifactSeed: 777,
    bodies,
    surfaceMap: {
      surfaceMapVersion: 1,
      occupiedSites,
    },
    colonies: [],
    diagnostics: {
      truncatedInstructionIds: [],
      fallbackInstructionIds: [],
      generationClampedInstructionIds: [],
      crowdedInstructionIds: [],
      rejectedCandidateCount: 0,
      maxCompetition: 0,
    },
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('Growth Surface Atlas', () => {
  it('is deterministic and independent of body array order', () => {
    const forward = buildGrowthSurfaceAtlas(growthState([MOTHER, SUPPORT]));
    const reversed = buildGrowthSurfaceAtlas(growthState([SUPPORT, MOTHER]));

    expect(reversed).toEqual(forward);
  });

  it('builds the same atlas from an in-progress aggregate mass', () => {
    const state = growthState();

    expect(buildGrowthSurfaceAtlasFromMass({
      species: state.species,
      bodies: state.bodies,
      occupiedSites: state.surfaceMap.occupiedSites,
    })).toEqual(buildGrowthSurfaceAtlas(state));
  });

  it('publishes finite normalized regions over the whole aggregate surface', () => {
    const atlas = buildGrowthSurfaceAtlas(growthState());
    const ids = new Set(atlas.regions.map((region) => region.id));

    expect(atlas.surfaceAtlasVersion).toBe(1);
    expect(atlas.bodyCount).toBe(2);
    expect(atlas.regionCount).toBe(80);
    expect(ids.size).toBe(atlas.regionCount);
    expect(atlas.exposedRegionCount).toBeGreaterThan(0);
    expect(atlas.activeRegionCount).toBeGreaterThan(0);

    for (const region of atlas.regions) {
      expect(Number.isFinite(region.surfacePosition.x)).toBe(true);
      expect(Number.isFinite(region.surfacePosition.y)).toBe(true);
      expect(Number.isFinite(region.surfacePosition.z)).toBe(true);
      expect(Math.hypot(
        region.surfaceNormal.x,
        region.surfaceNormal.y,
        region.surfaceNormal.z,
      )).toBeCloseTo(1, 5);
      expect(region.surfaceStress).toBeGreaterThanOrEqual(0);
      expect(region.surfaceStress).toBeLessThanOrEqual(1);
      expect(region.growthPotential).toBeGreaterThanOrEqual(0);
      expect(region.growthPotential).toBeLessThanOrEqual(1);
      expect(region.localDensity).toBeGreaterThanOrEqual(0);
      expect(region.localDensity).toBeLessThanOrEqual(1);
      expect(region.growthShadow).toBeGreaterThanOrEqual(0);
      expect(region.growthShadow).toBeLessThanOrEqual(1);
      expect(region.competitionPressure).toBeGreaterThanOrEqual(0);
      expect(region.competitionPressure).toBeLessThanOrEqual(1);
      if (!region.exposed) expect(region.growthPotential).toBe(0);
    }
  });

  it('lets large mature crystals cast stronger shadows than small immature bodies', () => {
    const large = growthBody({
      id: 'large-shadow',
      sequence: 0,
      seed: 404,
      anchor: { x: 0.42, y: 0.28, z: 0.02 },
      radius: 0.22,
      length: 1.15,
      generation: 1,
      maturity: 0.95,
      tier: 'support',
      growthCenterId: 'center-shadow',
      growthCenterRole: 'dominant',
    });
    const small = growthBody({
      id: 'small-shadow',
      sequence: 0,
      seed: 404,
      anchor: { x: 0.42, y: 0.28, z: 0.02 },
      radius: 0.07,
      length: 0.28,
      generation: 1,
      maturity: 0.1,
      tier: 'micro',
      growthCenterId: 'center-shadow',
      growthCenterRole: 'micro',
    });
    const largeAtlas = buildGrowthSurfaceAtlas(growthState([MOTHER, large]));
    const smallAtlas = buildGrowthSurfaceAtlas(growthState([MOTHER, small]));
    const smallById = new Map(smallAtlas.regions.map((region) => [region.id, region] as const));
    const paired = largeAtlas.regions.filter((region) => (
      region.sourceBodyId === MOTHER.id
      && region.exposed
      && smallById.get(region.id)?.exposed === true
    ));

    expect(paired.length).toBeGreaterThan(0);
    expect(Math.max(...paired.map((region) => region.growthShadow))).toBeGreaterThan(
      Math.max(...paired.map((region) => smallById.get(region.id)!.growthShadow)) + 0.2,
    );
    expect(mean(paired.map((region) => region.growthPotential))).toBeLessThan(
      mean(paired.map((region) => smallById.get(region.id)!.growthPotential)),
    );
  });

  it('adds extra competition only between bodies of the same Growth Center', () => {
    const dominant = growthBody({
      id: 'center-dominant',
      sequence: 0,
      seed: 505,
      anchor: { x: 0, y: 0, z: 0 },
      radius: 0.25,
      length: 1,
      generation: 1,
      maturity: 0.9,
      tier: 'support',
      growthCenterId: 'center-a',
      growthCenterRole: 'dominant',
    });
    const sameCenter = growthBody({
      id: 'center-satellite',
      sequence: 1,
      seed: 606,
      anchor: { x: 0.25, y: 0.2, z: 0 },
      radius: 0.1,
      length: 0.4,
      generation: 2,
      maturity: 0.8,
      tier: 'companion',
      growthCenterId: 'center-a',
      growthCenterRole: 'satellite',
    });
    const otherCenter = {
      ...sameCenter,
      id: 'other-center-satellite',
      instructionId: 'other-center-satellite',
      growthCenterId: 'center-b',
      colonyId: 'center-b',
    } satisfies GrowthBody;
    const sameAtlas = buildGrowthSurfaceAtlas(growthState([dominant, sameCenter]));
    const otherAtlas = buildGrowthSurfaceAtlas(growthState([dominant, otherCenter]));
    const sameRegions = sameAtlas.regions.filter((region) => region.sourceBodyId === dominant.id);
    const otherRegions = otherAtlas.regions.filter((region) => region.sourceBodyId === dominant.id);

    expect(Math.max(...sameRegions.map((region) => region.competitionPressure))).toBeGreaterThan(0);
    expect(Math.max(...otherRegions.map((region) => region.competitionPressure))).toBe(0);
  });

  it('keeps historical region identity and coordinates stable after later growth', () => {
    const earlier = buildGrowthSurfaceAtlas(growthState([MOTHER, SUPPORT]));
    const later = buildGrowthSurfaceAtlas(growthState([MOTHER, SUPPORT, LATER]));

    for (const oldRegion of earlier.regions) {
      const current = later.regions.find((region) => region.id === oldRegion.id);
      expect(current).toBeDefined();
      expect({
        sourceBodyId: current?.sourceBodyId,
        bandIndex: current?.bandIndex,
        sectorIndex: current?.sectorIndex,
        hostT: current?.hostT,
        azimuthRad: current?.azimuthRad,
        surfacePosition: current?.surfacePosition,
        surfaceNormal: current?.surfaceNormal,
        maturity: current?.maturity,
      }).toEqual({
        sourceBodyId: oldRegion.sourceBodyId,
        bandIndex: oldRegion.bandIndex,
        sectorIndex: oldRegion.sectorIndex,
        hostT: oldRegion.hostT,
        azimuthRad: oldRegion.azimuthRad,
        surfacePosition: oldRegion.surfacePosition,
        surfaceNormal: oldRegion.surfaceNormal,
        maturity: oldRegion.maturity,
      });
    }
  });

  it('removes an explicitly reserved atlas region from future growth potential', () => {
    const initial = buildGrowthSurfaceAtlas(growthState());
    const target = initial.regions.find((region) => (
      region.sourceBodyId === MOTHER.id && region.exposed
    ));
    expect(target).toBeDefined();

    const occupied = buildGrowthSurfaceAtlas(growthState(
      [MOTHER, SUPPORT],
      [{
        siteKey: 'occupied-test-site',
        bodyId: SUPPORT.id,
        surfaceRegionId: target!.id,
        hostBodyId: MOTHER.id,
        hostT: 0,
        hostAngleRad: target!.azimuthRad + Math.PI,
      }],
    ));
    const updated = occupied.regions.find((region) => region.id === target!.id);

    expect(updated?.occupied).toBe(true);
    expect(updated?.growthPotential).toBe(0);
  });
});
