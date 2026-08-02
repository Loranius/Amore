import { evaluateGrowthSite, type CandidateEvaluation } from './competition';
import {
  clamp,
  clamp01,
  directionFromAzimuthElevation,
  distance,
  dot,
  round6,
  roundVec,
  seededUnit,
} from './math';
import {
  buildGrowthSurfaceAtlasFromMass,
  type GrowthSurfaceRegion,
} from './surfaceAtlas';
import {
  attachmentFromSite,
  sampleGroundSite,
  sampleGrowthRegionSite,
  sampleGrowthSite,
  hostBurialCapacity,
  type GrowthSiteCandidate,
} from './surface';
import type {
  BuildGrowthStateInput,
  GrowthBody,
  GrowthCenterState,
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
  const instructionById = new Map<string, UniversalGrowthInstruction>();
  for (const instruction of [blueprint.root, ...blueprint.instructions]) {
    if (!instruction.id.trim()) throw new Error('Growth instruction requires a non-empty id.');
    if (ids.has(instruction.id)) throw new Error(`Duplicate growth instruction id: "${instruction.id}".`);
    ids.add(instruction.id);
    instructionById.set(instruction.id, instruction);
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

  if (blueprint.growthCenters === undefined) return;
  const centerIds = new Set<string>();
  for (const center of blueprint.growthCenters) {
    if (!center.id.trim()) throw new Error('Growth Center requires a non-empty id.');
    if (centerIds.has(center.id)) throw new Error(`Duplicate Growth Center id: "${center.id}".`);
    centerIds.add(center.id);
    const source = instructionById.get(center.sourceInstructionId);
    if (!source) {
      throw new Error(`Growth Center "${center.id}" references missing source instruction "${center.sourceInstructionId}".`);
    }
    const memberIds = new Set(center.instructionIds);
    if (memberIds.size !== center.instructionIds.length) {
      throw new Error(`Growth Center "${center.id}" contains duplicate instruction ids.`);
    }
    let dominantCount = 0;
    for (const instructionId of center.instructionIds) {
      const member = instructionById.get(instructionId);
      if (!member) {
        throw new Error(`Growth Center "${center.id}" references missing instruction "${instructionId}".`);
      }
      if ((member.growthCenterId ?? null) !== center.id) {
        throw new Error(`Growth instruction "${instructionId}" does not belong to Growth Center "${center.id}".`);
      }
      if ((member.growthCenterRole ?? null) === 'dominant') dominantCount += 1;
    }
    if (dominantCount !== 1) {
      throw new Error(`Growth Center "${center.id}" requires exactly one dominant instruction.`);
    }
    if ((source.growthCenterRole ?? null) !== 'dominant') {
      throw new Error(`Growth Center "${center.id}" source instruction must be dominant.`);
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
    growthCenterId: instruction.growthCenterId ?? null,
    growthCenterRole: instruction.growthCenterRole ?? null,
  };
}

function hostWeight(host: GrowthBody, instruction: UniversalGrowthInstruction): number {
  const root = host.generation === 0;
  const sameColony = instruction.colonyId !== null && host.colonyId === instruction.colonyId;
  let weight = 1 / (1 + host.generation * 0.45);

  if (instruction.hostPreference === 'root') weight *= root ? 4.4 : 0.16;
  else if (instruction.hostPreference === 'same-colony') weight *= sameColony ? 4.1 : root ? 1.25 : 0.42;
  else if (instruction.hostPreference === 'surface') weight *= root ? 0.72 : sameColony ? 2.6 : 1.55;
  else weight *= sameColony ? 2.3 : root ? 1.35 : 1;

  if (host.tier === 'king') weight *= 1.18;
  if (host.tier === 'micro') weight *= 0.42;
  return Math.max(0.001, weight);
}

function weightedHost(
  hosts: readonly GrowthBody[],
  instruction: UniversalGrowthInstruction,
  candidateIndex: number,
): GrowthBody {
  const root = hosts[0]!;
  if (candidateIndex === 0) return root;

  const sameColony = hosts.filter(
    (host) => instruction.colonyId !== null && host.colonyId === instruction.colonyId,
  );
  if (candidateIndex === 1 && sameColony.length > 0) return sameColony[sameColony.length - 1]!;

  const weights = hosts.map((host) => hostWeight(host, instruction));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = seededUnit(instruction.seed, `host:${candidateIndex}`) * total;
  for (let index = 0; index < hosts.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return hosts[index] ?? root;
  }
  return hosts[hosts.length - 1] ?? root;
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

interface GrowthCenterPlacementContext {
  readonly id: string;
  readonly dominant: GrowthBody;
  readonly influenceRadius: number;
}

function growthCenterPlacementContext(
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
): GrowthCenterPlacementContext | null {
  const id = instruction.growthCenterId ?? null;
  const role = instruction.growthCenterRole ?? null;
  if (id === null || role === null || role === 'dominant') return null;
  const members = bodies.filter((body) => (body.growthCenterId ?? null) === id);
  const dominant = members.find((body) => body.growthCenterRole === 'dominant') ?? members[0];
  if (!dominant) return null;
  return {
    id,
    dominant,
    influenceRadius: round6(
      dominant.skeletonLength * 0.58
      + dominant.skeletonRadius * 3.4
      + instruction.axialScale * 0.72,
    ),
  };
}

function centerRegionBias(
  region: GrowthSurfaceRegion,
  host: GrowthBody,
  context: GrowthCenterPlacementContext | null,
): number {
  if (context === null) return 0;
  const proximity = clamp01(
    1 - distance(region.surfacePosition, context.dominant.anchor) / Math.max(context.influenceRadius, 1e-6),
  );
  const sameCenter = (host.growthCenterId ?? null) === context.id ? 1 : 0;
  const dominantHost = host.id === context.dominant.id ? 1 : 0;
  return sameCenter * 1.55 + dominantHost * 0.55 + proximity * 1.35;
}

function regionPriority(
  region: GrowthSurfaceRegion,
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
  centerContext: GrowthCenterPlacementContext | null,
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
      + centerRegionBias(region, host, centerContext)
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

function chooseAtlasCandidate(
  species: string,
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): { evaluation: CandidateEvaluation; usedFallback: boolean; rejectedCount: number } {
  const bodyById = new Map(bodies.map((body) => [body.id, body] as const));
  const atlas = buildGrowthSurfaceAtlasFromMass({ species, bodies, occupiedSites });
  const maximumGeneration = Math.max(1, instruction.maxGeneration);
  const centerContext = growthCenterPlacementContext(instruction, bodies);
  const eligible = atlas.regions.filter((region) => {
    const host = bodyById.get(region.sourceBodyId);
    if (host === undefined) return false;
    if (centerContext !== null && (host.growthCenterId ?? null) === centerContext.id) {
      return host.generation < centerContext.dominant.generation + maximumGeneration;
    }
    return host.generation < maximumGeneration;
  });
  const centerOwned = centerContext === null
    ? []
    : eligible.filter((region) => {
      const host = bodyById.get(region.sourceBodyId);
      return host !== undefined && (host.growthCenterId ?? null) === centerContext.id;
    });
  const centerOwnedAvailable = centerOwned.filter((region) => (
    region.growthPotential > 0 || (region.exposed && !region.occupied)
  ));
  const localEligible = centerContext === null
    ? eligible
    : eligible.filter((region) => {
      const host = bodyById.get(region.sourceBodyId);
      if (!host) return false;
      if ((host.growthCenterId ?? null) === centerContext.id) return true;
      return distance(region.surfacePosition, centerContext.dominant.anchor) <= centerContext.influenceRadius;
    });
  const usedGlobalCenterFallback = centerContext !== null
    && centerOwnedAvailable.length === 0
    && localEligible.length === 0;
  const candidateDomain = centerContext === null
    ? eligible
    : centerOwnedAvailable.length > 0
      ? centerOwned
      : localEligible.length > 0
        ? localEligible
        : eligible;
  const active = candidateDomain.filter((region) => region.growthPotential > 0);
  const exposed = candidateDomain.filter((region) => region.exposed);
  const pool = active.length > 0 ? active : exposed.length > 0 ? exposed : candidateDomain;
  const ranked: RankedSurfaceRegion[] = pool.map((region) => {
    const host = bodyById.get(region.sourceBodyId);
    if (!host) throw new Error(`Surface Atlas references missing body "${region.sourceBodyId}".`);
    return {
      region,
      host,
      priority: regionPriority(region, host, instruction, centerContext),
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
    usedFallback: usedGlobalCenterFallback || active.length === 0 || accepted === undefined,
    rejectedCount: evaluations.filter((evaluation) => evaluation.rejected).length,
  };
}

function chooseLegacyCandidate(
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): { evaluation: CandidateEvaluation; usedFallback: boolean; rejectedCount: number } {
  const eligibleHosts = bodies.filter((body) => body.generation < Math.max(1, instruction.maxGeneration));
  const hosts = eligibleHosts.length > 0 ? eligibleHosts : [bodies[0]!];
  const evaluations: CandidateEvaluation[] = [];

  for (let candidateIndex = 0; candidateIndex < config.candidateCount; candidateIndex += 1) {
    const host = weightedHost(hosts, instruction, candidateIndex);
    const site = sampleGrowthSite(host, instruction, candidateIndex);
    evaluations.push(evaluateGrowthSite(site, instruction, bodies, occupiedSites, config));
  }

  evaluations.sort((left, right) => right.score - left.score || left.site.candidateIndex - right.site.candidateIndex);
  const accepted = evaluations.find((evaluation) => !evaluation.rejected);
  const selected = accepted ?? evaluations[0];
  if (!selected) throw new Error(`Growth Engine produced no site candidates for "${instruction.id}".`);

  return {
    evaluation: selected,
    usedFallback: accepted === undefined,
    rejectedCount: evaluations.filter((evaluation) => evaluation.rejected).length,
  };
}

/**
 * A crystal formation that leads its own Growth Centre is a companion crystal,
 * not an outgrowth of the monarch. Those root in the ground beside her; only
 * their own local members still attach to a host body.
 */
function isGroundRooted(species: string, instruction: UniversalGrowthInstruction): boolean {
  return species === 'crystal' && (instruction.growthCenterRole ?? null) === 'dominant';
}

function chooseGroundCandidate(
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): { evaluation: CandidateEvaluation; usedFallback: boolean; rejectedCount: number } {
  const root = bodies[0]!;
  const evaluations: CandidateEvaluation[] = [];
  for (let candidateIndex = 0; candidateIndex < config.candidateCount; candidateIndex += 1) {
    const site = sampleGroundSite(root, instruction, candidateIndex);
    evaluations.push(evaluateGrowthSite(site, instruction, bodies, occupiedSites, config));
  }

  evaluations.sort((left, right) => right.score - left.score
    || left.site.candidateIndex - right.site.candidateIndex);
  const accepted = evaluations.find((evaluation) => !evaluation.rejected);
  const selected = accepted ?? evaluations[0];
  if (!selected) throw new Error(`Growth Engine produced no ground candidates for "${instruction.id}".`);

  return {
    evaluation: selected,
    usedFallback: accepted === undefined,
    rejectedCount: evaluations.filter((evaluation) => evaluation.rejected).length,
  };
}

function chooseCandidate(
  species: string,
  instruction: UniversalGrowthInstruction,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
): { evaluation: CandidateEvaluation; usedFallback: boolean; rejectedCount: number } {
  if (isGroundRooted(species, instruction)) {
    return chooseGroundCandidate(instruction, bodies, occupiedSites, config);
  }
  return species === 'crystal'
    ? chooseAtlasCandidate(species, instruction, bodies, occupiedSites, config)
    : chooseLegacyCandidate(instruction, bodies, occupiedSites, config);
}

/**
 * Shrinks a child so the base it buries stays inside its host.
 *
 * A child sinks into its host by roughly `renderedRadius * 0.58` (see the
 * attached branch of buildCrystalProfile). Nothing previously related that
 * depth to how much host there actually is, so a satellite could be assigned
 * to a host thinner than its own burial and punch straight out the far side,
 * leaving the junction unsealed and a base cap visible — the exact failure
 * CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md forbids. Whether it happened came
 * down to placement luck, which is also why uniform radius rescales behaved
 * non-monotonically.
 *
 * Shrinking the child is one of the responses Volume III sanctions for a body
 * that does not fit, and unlike rejecting a site it cannot fall through to a
 * fallback candidate that still does not fit. Small crystals growing on thin
 * hosts is also what real druses do.
 */
function fitRadiusToHost(
  desiredSkeletonRadius: number,
  renderRadiusScale: number,
  site: GrowthSiteCandidate | null,
): number {
  if (site === null) return round6(desiredSkeletonRadius);

  const capacity = hostBurialCapacity(site.host, site.hostT);
  if (!(capacity > 0) || !(renderRadiusScale > 0)) {
    return round6(desiredSkeletonRadius);
  }

  // The sampler already reserved up to 40% of the capacity for burialDepth,
  // and geometry sinks the mesh by extraSink on top of that. Half the capacity
  // for extraSink keeps the total comfortably inside the host.
  const maxRenderedRadius = (capacity * 0.5) / 0.58;
  const maxSkeletonRadius = maxRenderedRadius / renderRadiusScale;
  return round6(Math.min(desiredSkeletonRadius, maxSkeletonRadius));
}

function depositInstruction(
  blueprint: UniversalGrowthBlueprint,
  instruction: UniversalGrowthInstruction,
  bodies: GrowthBody[],
  occupiedSites: GrowthSurfaceOccupancy[],
  config: GrowthEngineConfig,
  diagnostics: GrowthDiagnostics,
): void {
  const localCenterMember = (instruction.growthCenterRole ?? null) !== null
    && instruction.growthCenterRole !== 'dominant';
  const blockedSameColony = !localCenterMember
    && instruction.colonyId !== null
    && bodies.some(
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
  const groundRooted = isGroundRooted(blueprint.species, instruction);
  const centerDominant = localCenterMember && instruction.growthCenterId !== undefined
    ? bodies.find((body) => (body.growthCenterId ?? null) === instruction.growthCenterId
      && body.growthCenterRole === 'dominant')
    : undefined;
  const generationLimit = centerDominant === undefined
    ? Math.max(1, instruction.maxGeneration)
    : centerDominant.generation + Math.max(1, instruction.maxGeneration);
  // A ground-rooted body grows from the substrate, so it is a root of its own
  // colony rather than a descendant of whatever body happens to stand nearby.
  const generation = groundRooted
    ? 0
    : Math.min(host.generation + 1, generationLimit);
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
  const render = renderedScale(instruction.maturity);
  const skeletonRadius = fitRadiusToHost(
    instruction.radialScale * (0.8 + growthEnergy * 0.2),
    render.radius,
    groundRooted ? null : evaluation.site,
  );

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
    // No host body means no junction to seal and no base cap to remove: the
    // body is closed and its base sits under the ground plane.
    hostBodyId: groundRooted ? null : host.id,
    attachment: groundRooted ? null : attachmentFromSite(evaluation.site),
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
    growthCenterId: instruction.growthCenterId ?? null,
    growthCenterRole: instruction.growthCenterRole ?? null,
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
    const root = [...members].sort(
      (left, right) => left.generation - right.generation || left.sequence - right.sequence || compareIds(left.id, right.id),
    )[0];
    return {
      id: colony.id,
      kind: colony.kind,
      epochIndex: colony.epochIndex,
      seed: colony.seed,
      bodyIds: members.map((body) => body.id),
      rootBodyId: root?.id ?? null,
      totalWeight: round6(members.reduce((sum, body) => sum + (instructionWeight.get(body.id) ?? 0), 0)),
      maxGeneration: members.reduce((max, body) => Math.max(max, body.generation), 0),
    };
  });
}

function buildGrowthCenters(
  blueprint: UniversalGrowthBlueprint,
  bodies: readonly GrowthBody[],
): GrowthCenterState[] {
  const centers = blueprint.growthCenters ?? [];
  const instructionWeight = new Map(
    blueprint.instructions.map((instruction) => [instruction.id, instruction.weight] as const),
  );
  return centers.map((center) => {
    const members = bodies
      .filter((body) => (body.growthCenterId ?? null) === center.id)
      .sort((left, right) => left.sequence - right.sequence || compareIds(left.id, right.id));
    const dominant = members.find((body) => body.growthCenterRole === 'dominant') ?? null;
    return {
      id: center.id,
      sourceInstructionId: center.sourceInstructionId,
      sourceId: center.sourceId,
      kind: center.kind,
      epochIndex: center.epochIndex,
      seed: center.seed,
      bodyIds: members.map((body) => body.id),
      dominantBodyId: dominant?.id ?? null,
      surfaceRegionId: dominant?.attachment?.surfaceRegionId ?? null,
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
    ...(blueprint.growthCenters === undefined
      ? {}
      : { growthCenters: buildGrowthCenters(blueprint, bodies) }),
    diagnostics,
  };
}
