import {
  angularDistance,
  clamp01,
  directionFromAzimuthElevation,
  dot,
  round6,
  segmentDistance,
} from './math';
import { bodyEnd, type GrowthSiteCandidate } from './surface';
import type {
  GrowthBody,
  GrowthEngineConfig,
  GrowthSurfaceOccupancy,
  UniversalGrowthInstruction,
} from './types';

export interface CandidateEvaluation {
  site: GrowthSiteCandidate;
  score: number;
  competition: number;
  crowding: number;
  minClearance: number;
  angularSeparation: number;
  rejected: boolean;
}

function hostAffinity(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
): number {
  const root = host.generation === 0;
  const sameColony = instruction.colonyId !== null && host.colonyId === instruction.colonyId;

  if (instruction.hostPreference === 'root') return root ? 1 : 0.12;
  if (instruction.hostPreference === 'same-colony') {
    if (sameColony) return 1;
    return root ? 0.68 : 0.3;
  }
  if (instruction.hostPreference === 'surface') {
    if (sameColony) return 0.95;
    return root ? 0.48 : 0.82;
  }
  if (sameColony) return 0.92;
  return root ? 0.78 : 0.64;
}

function nearestSiteAngle(
  site: GrowthSiteCandidate,
  occupiedSites: readonly GrowthSurfaceOccupancy[],
): number {
  let nearest = Math.PI;
  for (const occupied of occupiedSites) {
    if (occupied.hostBodyId !== site.host.id) continue;
    nearest = Math.min(nearest, angularDistance(site.hostAngleRad, occupied.hostAngleRad));
  }
  return nearest;
}

export function evaluateGrowthSite(
  site: GrowthSiteCandidate,
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): CandidateEvaluation {
  const candidateEnd = {
    x: site.anchor.x + site.direction.x * instruction.axialScale,
    y: site.anchor.y + site.direction.y * instruction.axialScale,
    z: site.anchor.z + site.direction.z * instruction.axialScale,
  };

  let minClearance = Number.POSITIVE_INFINITY;
  let maxOverlap = 0;
  let geometricCrowding = 0;

  for (const body of bodies) {
    if (body.id === site.host.id) continue;
    const distance = segmentDistance(site.anchor, candidateEnd, body.anchor, bodyEnd(body));
    const combinedRadius = instruction.radialScale + body.skeletonRadius + config.collisionPadding;
    const clearance = distance - combinedRadius;
    minClearance = Math.min(minClearance, clearance);
    if (clearance < 0) maxOverlap = Math.max(maxOverlap, -clearance / Math.max(combinedRadius, 1e-6));

    const influenceRadius = combinedRadius * 3.2;
    if (distance < influenceRadius) geometricCrowding += 1 - distance / influenceRadius;
  }

  if (!Number.isFinite(minClearance)) minClearance = 1;

  const geometricCompetition = clamp01(
    maxOverlap * 0.76 + Math.min(1, geometricCrowding / 5) * 0.24,
  );
  const competition = clamp01(
    geometricCompetition
    + site.competitionPressure * 0.22
    + site.growthShadow * 0.12,
  );
  const crowding = geometricCrowding
    + site.competitionPressure * 1.8
    + site.growthShadow * 0.7;
  const angularSeparation = nearestSiteAngle(site, occupiedSites);
  const angularScore = clamp01(angularSeparation / config.minAngularSeparationRad);
  const clearanceScore = clamp01((minClearance + instruction.radialScale * 0.75) / 0.9);
  const preferred = directionFromAzimuthElevation(
    instruction.preferredAzimuthRad,
    instruction.preferredElevation,
  );
  const alignment = clamp01((dot(site.direction, preferred) + 1) * 0.5);
  const generationScore = clamp01(1 - site.host.generation / Math.max(1, instruction.maxGeneration + 1));
  const affinity = hostAffinity(site.host, instruction);
  const geologicalScore = site.surfacePotential * 1.45
    + (1 - site.surfaceStress) * 0.3
    + (1 - site.localDensity) * 0.25
    + (1 - site.growthShadow) * 0.4
    + (1 - site.competitionPressure) * 0.3;

  const score = round6(
    clearanceScore * 2.5
      + angularScore * 1.15
      + affinity * 1.05
      + alignment * 0.65
      + generationScore * 0.35
      + geologicalScore
      - competition * 2.8
      - Math.min(1, crowding / 4) * 0.45
      - site.growthShadow * 0.35
      - site.competitionPressure * 0.55,
  );

  return {
    site,
    score,
    competition: round6(competition),
    crowding: round6(crowding),
    minClearance: round6(minClearance),
    angularSeparation: round6(angularSeparation),
    rejected: maxOverlap > 0.88
      || angularSeparation < config.minAngularSeparationRad * 0.24
      || (site.surfaceRegionId !== null && site.surfacePotential <= 0),
  };
}
