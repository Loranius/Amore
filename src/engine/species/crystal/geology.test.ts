import { describe, expect, it } from 'vitest';
import type {
  GrowthBody,
  GrowthCenterRole,
  GrowthCenterState,
  GrowthState,
  GrowthTier,
  GrowthVec3,
} from '../../growth';
import { buildCrystalGeologyState } from './geology';

function body(input: {
  id: string;
  sequence: number;
  centerId: string | null;
  role: GrowthCenterRole | null;
  anchor: GrowthVec3;
  length: number;
  radius: number;
  tier?: GrowthTier;
  generation?: number;
  maturity?: number;
  growthEnergy?: number;
  hostBodyId?: string | null;
}): GrowthBody {
  return {
    id: input.id,
    instructionId: input.id,
    sourceId: input.id,
    species: 'crystal',
    kind: input.role === 'micro' ? 'crystal:inclusion' : 'crystal:satellite',
    tier: input.tier ?? 'companion',
    attributes: {},
    sequence: input.sequence,
    colonyId: input.centerId,
    epochIndex: Math.floor(Math.max(0, input.sequence) / 8),
    seed: input.sequence + 101,
    emphasized: input.role === 'dominant',
    generation: input.generation ?? 1,
    hostBodyId: input.hostBodyId ?? null,
    attachment: null,
    anchor: input.anchor,
    direction: { x: 0, y: 1, z: 0 },
    skeletonLength: input.length,
    skeletonRadius: input.radius,
    surfaceRadiusScale: 0.64,
    renderedLength: input.length,
    renderedRadius: input.radius,
    maturity: input.maturity ?? 0.8,
    growthEnergy: input.growthEnergy ?? 1,
    competition: 0,
    crowding: 0,
    growthCenterId: input.centerId,
    growthCenterRole: input.role,
  };
}

function center(id: string, bodyIds: string[], dominantBodyId: string | null): GrowthCenterState {
  return {
    id,
    sourceInstructionId: dominantBodyId ?? `${id}:source`,
    sourceId: dominantBodyId,
    kind: 'growth-center:test',
    epochIndex: 0,
    seed: id.length * 101,
    bodyIds,
    dominantBodyId,
    surfaceRegionId: null,
    totalWeight: bodyIds.length,
    maxGeneration: 3,
  };
}

function growthState(
  bodies: GrowthBody[],
  growthCenters: GrowthCenterState[],
): GrowthState {
  return {
    growthStateVersion: 1,
    rulesVersion: 'geology-test@1',
    sourceBlueprintVersion: 'crystal:1:growth-centers@1',
    engineVersion: '1.0.0',
    speciesRulesVersion: '1.0.0',
    species: 'crystal',
    artifactSeed: 777,
    bodies,
    surfaceMap: {
      surfaceMapVersion: 1,
      occupiedSites: [],
    },
    colonies: [],
    growthCenters,
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

const OLD_MICRO = body({
  id: 'old:micro',
  sequence: 2,
  centerId: 'center:old',
  role: 'micro',
  anchor: { x: 0, y: 0, z: 0 },
  length: 0.5,
  radius: 0.08,
  tier: 'micro',
  maturity: 0.92,
});

const LATER_DOMINANT = body({
  id: 'later:dominant',
  sequence: 8,
  centerId: 'center:later',
  role: 'dominant',
  anchor: { x: 0.03, y: 0.02, z: 0 },
  length: 1,
  radius: 0.22,
  tier: 'support',
  maturity: 1,
});

const LATER_MICRO = body({
  id: 'later:micro',
  sequence: 8,
  centerId: 'center:later',
  role: 'micro',
  anchor: { x: 0.03, y: 0.02, z: 0 },
  length: 0.2,
  radius: 0.03,
  tier: 'micro',
  maturity: 0.1,
  growthEnergy: 0.4,
});

describe('Crystal geological burial', () => {
  it('is deterministic and independent of body array order', () => {
    const centers = [
      center('center:old', [OLD_MICRO.id], null),
      center('center:later', [LATER_DOMINANT.id], LATER_DOMINANT.id),
    ];
    const forward = buildCrystalGeologyState(growthState([OLD_MICRO, LATER_DOMINANT], centers));
    const reversed = buildCrystalGeologyState(growthState([LATER_DOMINANT, OLD_MICRO], centers));

    expect(reversed).toEqual(forward);
  });

  it('lets a large mature later dominant bury an old micro body more than a young micro body', () => {
    const dominantState = buildCrystalGeologyState(growthState(
      [OLD_MICRO, LATER_DOMINANT],
      [
        center('center:old', [OLD_MICRO.id], null),
        center('center:later', [LATER_DOMINANT.id], LATER_DOMINANT.id),
      ],
    ));
    const microState = buildCrystalGeologyState(growthState(
      [OLD_MICRO, LATER_MICRO],
      [
        center('center:old', [OLD_MICRO.id], null),
        center('center:later', [LATER_MICRO.id], null),
      ],
    ));
    const dominantBurial = dominantState.bodies.find((entry) => entry.bodyId === OLD_MICRO.id)!;
    const microBurial = microState.bodies.find((entry) => entry.bodyId === OLD_MICRO.id)!;

    expect(dominantBurial.burialRatio).toBeGreaterThan(0.42);
    expect(dominantBurial.burialRatio).toBeGreaterThan(microBurial.burialRatio);
    expect(dominantBurial.buriedByBodyIds).toContain(LATER_DOMINANT.id);
    expect(dominantBurial.buriedByGrowthCenterIds).toEqual(['center:later']);
    expect(dominantBurial.exposedTipRatio).toBeGreaterThanOrEqual(0.18);
  });

  it('does not let earlier bodies or members of the same center create geological burial', () => {
    const earlierCover = { ...LATER_DOMINANT, id: 'earlier', sequence: 0 };
    const sameCenterCover = {
      ...LATER_DOMINANT,
      id: 'same-center',
      sequence: 7,
      growthCenterId: 'center:old',
      colonyId: 'center:old',
    };
    const geology = buildCrystalGeologyState(growthState(
      [earlierCover, OLD_MICRO, sameCenterCover],
      [center('center:old', [OLD_MICRO.id, sameCenterCover.id], null)],
    ));
    const oldBurial = geology.bodies.find((entry) => entry.bodyId === OLD_MICRO.id)!;

    expect(oldBurial.burialRatio).toBe(0);
    expect(oldBurial.buriedByBodyIds).toEqual([]);
  });

  it('publishes normalized center maturation and burial pressure', () => {
    const satellite = body({
      id: 'old:satellite',
      sequence: 1,
      centerId: 'center:old',
      role: 'satellite',
      anchor: { x: -0.08, y: 0.02, z: 0 },
      length: 0.45,
      radius: 0.09,
      hostBodyId: OLD_MICRO.id,
    });
    const geology = buildCrystalGeologyState(growthState(
      [satellite, OLD_MICRO, LATER_DOMINANT],
      [
        center('center:old', [satellite.id, OLD_MICRO.id], satellite.id),
        center('center:later', [LATER_DOMINANT.id], LATER_DOMINANT.id),
      ],
    ));

    for (const maturation of geology.centers) {
      expect(maturation.maturity).toBeGreaterThanOrEqual(0);
      expect(maturation.maturity).toBeLessThanOrEqual(1);
      expect(maturation.structuralCompleteness).toBeGreaterThanOrEqual(0);
      expect(maturation.structuralCompleteness).toBeLessThanOrEqual(1);
      expect(maturation.cohesion).toBeGreaterThanOrEqual(0);
      expect(maturation.cohesion).toBeLessThanOrEqual(1);
      expect(maturation.burialPressure).toBeGreaterThanOrEqual(0);
      expect(maturation.burialPressure).toBeLessThanOrEqual(1);
      expect(maturation.exposedTipRatio).toBeGreaterThan(0);
      expect(maturation.exposedTipRatio).toBeLessThanOrEqual(1);
    }

    expect(geology.centers.find((entry) => entry.id === 'center:old')?.burialPressure).toBeGreaterThan(0);
    expect(geology.centers.find((entry) => entry.id === 'center:later')?.burialPressure).toBe(0);
  });
});
