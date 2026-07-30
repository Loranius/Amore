import { evaluateGrowthSite, type CandidateEvaluation } from './competition';
import {
  clamp,
  clamp01,
  directionFromAzimuthElevation,
  dot,
  round6,
  roundVec,
  seededUnit,
} from './math';
import {
  buildGrowthSurfaceAtlasFromMass,
  type GrowthSurfaceRegion,
} from './surfaceAtlas';
import { attachmentFromSite, sampleGrowthRegionSite } from './surface';
import type {
  BuildGrowthStateInput,
  GrowthBody,
  GrowthColonyState,
  GrowthDiagnostics,
  GrowthEngineConfig,
  GrowthState,
  GrowthSurfaceOccupancy,
  UniversalGrowthBlueprint,
  UniversalGrowthInstruction,
} from './types';

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateConfig(config: GrowthEngineConfig): void {
  if (!config.rulesVersion.trim()) throw new Error('Growth Engine requires a non-empty rulesVersion.');
  if (!Number.isInteger(config.candidateCount) || config.candidateCount < 1) {
    throw new Error('Growth Engine candidateCount must be a positive integer.');
  }
  if (!Number.isInteger(config.maxBodies) || config.maxBodies < 1) {
    throw new Error('Growth Engine maxBodies must be a positive integer.');
  }
  if (!Number.isFinite(config.minAngularSeparationRad) || config.minAngularSeparationRad <= 0) {
    throw new Error('Growth Engine minAngularSeparationRad must be positive.');
  }
  if (!Number.isFinite(config.collisionPadding) || config.collisionPadding < 0) {
    throw new Error('Growth Engine collisionPadding must be non-negative.');
  }
}

function validateBlueprint(blueprint: UniversalGrowthBlueprint): void {
  if (!blueprint.species.trim()) throw new Error('Growth blueprint requires a species.');
  if (!blueprint.sourceBlueprintVersion.trim()) {
    throw new Error('Growth blueprint requires a sourceBlueprintVersion.');
  }

  const ids = new Set<string>();
  for (const instruction of [blueprint.root, ...blueprint.instructions]) {
    if (!instruction.id.trim()) throw new Error('Growth instruction requires a non-empty id.');
    if (ids.has(instruction.id)) throw new Error(`Duplicate growth instruction id: "${instruction.id}".`);
    ids.add(instruction.id);
    if (!Number.isFinite(instruction.axialScale) || instruction.axialScale <= 0) {
      throw new Error(`Growth instruction "${instruction.id}" requires positive axialScale.`);
    }
    if (!Number.isFinite(instruction.radialScale) || instruction.radialScale <= 0) {
      throw new Error(`Growth instruction "${instruction.id}" requires positive radialScale.`);
    }
    if (
      !Number.isFinite(instruction.surfaceRadiusScale)
      || instruction.surfaceRadiusScale <= 0
      || instruction.surfaceRadiusScale > 1
    ) {
      throw new Error(`Growth instruction "${instruction.id}" requires surfaceRadiusScale in (0, 1].`);
    }
  }
}

function renderedScale(maturity: number): { length: number; radius: number } {
  const m = clamp01(maturity);
  return {
    length: 0.15 + Math.sqrt(m) * 0.85,
    radius: 0.32 + m * 0.68,
  };
}

function rootBody(blueprint: UniversalGrowthBlueprint): GrowthBody {
  const instruction = blueprint.root;
  const render = renderedScale(instruction.maturity);
  return {
    id: instruction.id,
    instructionId: instruction.id,
    sourceId: instruction.sourceId,
    species: blueprint.species,
    kind: instruction.kind,
    tier: instruction.tier,
    attributes: instruction.attributes,
    sequence: instruction.sequence,
    colonyId: instruction.colonyId,
    epochIndex: instruction.epochIndex,
    seed: instruction.seed,
    emphasized: instruction.emphasized,
    generation: 0,
    hostBodyId: null,
    attachment: null,
    anchor: { x: 0, y: 0, z: 0 },
    direction: roundVec(directionFromAzimuthElevation(
      instruction.preferredAzimuthRad,
      instruction.preferredElevation,
    )),
    skeletonLength: round6(instruction.axialScale),
    skeletonRadius: round6(instruction.radialScale),
    surfaceRadiusScale: round6(instruction.surfaceRadiusScale),
    renderedLength: round6(instruction.axialScale * render.length),
    renderedRadius: round6(instruction.radialScale * render.radius),
    maturity: round6(clamp01(instruction.maturity)),
    growthEnergy: 1,
    competition: 0,
    crowding: 0,
  };
}

function regionHostAffinity(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
): number {
  const root = host.generation === 0;
  const sameColony = instruction.colonyId !== null && host.colonyId === instruction.colonyId;

  if (instruction.hostPreference === 'root') return root ? 1 : 0.08;
  if (instruction.hostPreference === 'same-colony') {
    if (sameColony) return 1;
    return root ? 0.6 : 0.22;
  }
  if (instruction.hostPreference === 'surface') {
    if (sameColony) return 0.96;
    return root ? 0.42 : 0.88;
  }
  if (sameColony) return 0.94;
  return root ? 0.72 : 0.68;
}

function regionPriority(
  region: GrowthSurfaceRegion,
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
): number {
  const preferred = directionFromAzimuthElevation(
    instruction.preferredAzimuthRad,
    instruction.preferredElevation,
  );
  const alignment = clamp01((dot(region.surfaceNormal, preferred) + 1) * 0.5);
  const upwardExposure = clamp01((region.surfaceNormal.y + 1) * 0.5);
  const deterministicVariation = seededUnit(
    instruction.seed,
    `surface-region:${region.id}`,
  );

  return round6(
    region.growthPotential * 2.25
      + regionHostAffinity(host, instruction) * 2.1
      + alignment * 0.7
      + (1 - region.surfaceStress) * 0.32
      + (1 - region.localDensity) * 0.24
      + upwardExposure * 0.12
      + deterministicVariation * 0.1,
  );
}

interface RankedSurfaceRegion {
  readonly region: GrowthSurfaceRegion;
  readonly host: GrowthBody;
  readonly priority: number;
}

function chooseCandidate(
  species: string,
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): { evaluation: CandidateEvaluation; usedFallback: boolean; rejectedCount: number } {
  const bodyById = new Map(bodies.map((body) => [body.id, body] as const));
  const atlas = buildGrowthSurfaceAtlasFromMass({ species, bodies, occupiedSites });
  const maximumGeneration = Math.max(1, instruction.maxGeneration);
  const eligible = atlas.regions.filter((region) => {
    const host = bodyById.get(region.sourceBodyId);
    return host !== undefined && host.generation < maximumGeneration;
  });
  const active = eligible.filter((region) => region.growthPotential > 0);
  const exposed = eligible.filter((region) => region.exposed);
  const pool = active.length > 0 ? active : exposed.length > 0 ? exposed : eligible;
  const ranked: RankedSurfaceRegion[] = pool.map((region) => {
    const host = bodyById.get(region.sourceBodyId);
    if (!host) throw new Error(`Surface Atlas references missing body "${region.sourceBodyId}".`);
    return {
      region,
      host,
      priority: regionPriority(region, host, instruction),
    };
  });

  ranked.sort((left, right) => (
    right.priority - left.priority
    || compareIds(left.region.id, right.region.id)
  ));

  const evaluations = ranked
    .slice(0, config.candidateCount)
    .map((entry, candidateIndex) => evaluateGrowthSite(
      sampleGrowthRegionSite(entry.host, entry.region, instruction, candidateIndex),
      instruction,
      bodies,
      occupiedSites,
      config,
    ));

  evaluations.sort((left, right) => (
    right.score - left.score
    || compareIds(left.site.surfaceRegionId ?? '', right.site.surfaceRegionId ?? '')
    || left.site.candidateIndex - right.site.candidateIndex
  ));
  const accepted = evaluations.find((evaluation) => !evaluation.rejected);
  const selected = accepted ?? evaluations[0];
  if (!selected) throw new Error(`Growth Engine produced no Surface Atlas candidates for "${instruction.id}".`);

  return {
    evaluation: selected,
    usedFallback: active.length === 0 || accepted === undefined,
    rejectedCount: evaluations.filter((evaluation) => evaluation.rejected).length,
  };
}

function depositInstruction(
  blueprint: UniversalGrowthBlueprint,
  instruction: UniversalGrowthInstruction,
  bodies: GrowthBody[],
  occupiedSites: GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
  diagnostics: GrowthDiagnostics,
): void {
  const blockedSameColony = instruction.colonyId !== null && bodies.some(
    (body) => body.colonyId === instruction.colonyId && body.generation >= instruction.maxGeneration,
  );

  const { evaluation, usedFallback, rejectedCount } = chooseCandidate(
    blueprint.species,
    instruction,
    bodies,
    occupiedSites,
    config,
  );
  diagnostics.rejectedCandidateCount += rejectedCount;
  if (usedFallback) diagnostics.fallbackInstructionIds.push(instruction.id);

  const host = evaluation.site.host;
  const generation = Math.min(host.generation + 1, Math.max(1, instruction.maxGeneration));
  if (blockedSameColony && host.colonyId !== instruction.colonyId) {
    diagnostics.generationClampedInstructionIds.push(instruction.id);
  }

  const energyFloor = instruction.emphasized ? 0.72 : instruction.tier === 'micro' ? 0.26 : 0.34;
  const growthEnergy = clamp(
    1 - evaluation.competition * 0.58 - Math.min(0.28, evaluation.crowding * 0.045),
    energyFloor,
    1,
  );
  const skeletonLength = instruction.axialScale * (0.72 + growthEnergy * 0.28);
  const skeletonRadius = instruction.radialScale * (0.8 + growthEnergy * 0.2);
  const render = renderedScale(instruction.maturity);

  const body: GrowthBody = {
    id: instruction.id,
    instructionId: instruction.id,
    sourceId: instruction.sourceId,
    species: blueprint.species,
    kind: instruction.kind,
    tier: instruction.tier,
    attributes: instruction.attributes,
    sequence: instruction.sequence,
    colonyId: instruction.colonyId,
    epochIndex: instruction.epochIndex,
    seed: instruction.seed,
    emphasized: instruction.emphasized,
    generation,
    hostBodyId: host.id,
    attachment: attachmentFromSite(evaluation.site),
    anchor: evaluation.site.anchor,
    direction: evaluation.site.direction,
    skeletonLength: round6(skeletonLength),
    skeletonRadius: round6(skeletonRadius),
    surfaceRadiusScale: round6(instruction.surfaceRadiusScale),
    renderedLength: round6(skeletonLength * render.length),
    renderedRadius: round6(skeletonRadius * render.radius),
    maturity: round6(clamp01(instruction.maturity)),
    growthEnergy: round6(growthEnergy),
    competition: evaluation.competition,
    crowding: evaluation.crowding,
  };

  bodies.push(body);
  occupiedSites.push({
    siteKey: evaluation.site.siteKey,
    bodyId: body.id,
    ...(evaluation.site.surfaceRegionId === null
      ? {}
      : { surfaceRegionId: evaluation.site.surfaceRegionId }),
    hostBodyId: host.id,
    hostT: evaluation.site.hostT,
    hostAngleRad: evaluation.site.hostAngleRad,
  });

  if (evaluation.competition >= 0.5 || evaluation.crowding >= 2.5) {
    diagnostics.crowdedInstructionIds.push(instruction.id);
  }
  diagnostics.maxCompetition = Math.max(diagnostics.maxCompetition, evaluation.competition);
}

function buildColonies(
  blueprint: UniversalGrowthBlueprint,
  bodies: readonly GrowthBody[],
): GrowthColonyState[] {
  const instructionWeight = new Map(
    blueprint.instructions.map((instruction) => [instruction.id, instruction.weight] as const),
  );
  return blueprint.colonies.map((colony) => {
    const members = bodies.filter((body) => body.colonyId === colony.id);
    const rootBody = [...members].sort(
      (left, right) => left.generation - right.generation || left.sequence - right.sequence || compareIds(left.id, right.id),
    )[0];
    return {
      id: colony.id,
      kind: colony.kind,
      epochIndex: colony.epochIndex,
      seed: colony.seed,
      bodyIds: members.map((body) => body.id),
      rootBodyId: rootBody?.id ?? null,
      totalWeight: round6(members.reduce((sum, body) => sum + (instructionWeight.get(body.id) ?? 0), 0)),
      maxGeneration: members.reduce((max, body) => Math.max(max, body.generation), 0),
    };
  });
}

/**
 * Pure deterministic Universal Growth Engine.
 *
 * Placement reads only previously deposited bodies. Therefore appending a new
 * instruction cannot move, resize or reattach historical bodies.
 */
export function buildGrowthState(input: BuildGrowthStateInput): GrowthState {
  validateConfig(input.config);
  validateBlueprint(input.blueprint);

  const blueprint = input.blueprint;
  const ordered = [...blueprint.instructions].sort(
    (left, right) => left.sequence - right.sequence || compareIds(left.id, right.id),
  );
  const capacity = Math.max(0, input.config.maxBodies - 1);
  const accepted = ordered.slice(0, capacity);
  const truncated = ordered.slice(capacity).map((instruction) => instruction.id);

  const bodies: GrowthBody[] = [rootBody(blueprint)];
  const occupiedSites: GrowthSurfaceOccupancy[] = [];
  const diagnostics: GrowthDiagnostics = {
    truncatedInstructionIds: truncated,
    fallbackInstructionIds: [],
    generationClampedInstructionIds: [],
    crowdedInstructionIds: [],
    rejectedCandidateCount: 0,
    maxCompetition: 0,
  };

  for (const instruction of accepted) {
    depositInstruction(blueprint, instruction, bodies, occupiedSites, input.config, diagnostics);
  }

  diagnostics.maxCompetition = round6(diagnostics.maxCompetition);
  diagnostics.fallbackInstructionIds.sort();
  diagnostics.generationClampedInstructionIds.sort();
  diagnostics.crowdedInstructionIds.sort();

  return {
    growthStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceBlueprintVersion: blueprint.sourceBlueprintVersion,
    engineVersion: blueprint.engineVersion,
    speciesRulesVersion: blueprint.speciesRulesVersion,
    species: blueprint.species,
    artifactSeed: blueprint.artifactSeed,
    bodies,
    surfaceMap: {
      surfaceMapVersion: 1,
      occupiedSites,
    },
    colonies: buildColonies(blueprint, bodies),
    diagnostics,
  };
}
