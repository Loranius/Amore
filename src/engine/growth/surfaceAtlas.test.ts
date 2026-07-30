import { describe, expect, it } from 'vitest';
import {
  buildGrowthSurfaceAtlas,
  buildGrowthSurfaceAtlasFromMass,
} from './surfaceAtlas';
import type {
  GrowthBody,
  GrowthState,
  GrowthSurfaceOccupancy,
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
}): GrowthBody {
  const generation = input.generation ?? 0;
  return {
    id: input.id,
    instructionId: input.id,
    sourceId: input.id,
    species: 'crystal',
    kind: generation === 0 ? 'crystal:mother' : 'crystal:event-spire',
    tier: generation === 0 ? 'king' : 'support',
    attributes: {},
    sequence: input.sequence,
    colonyId: null,
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
      if (!region.exposed) expect(region.growthPotential).toBe(0);
    }
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
