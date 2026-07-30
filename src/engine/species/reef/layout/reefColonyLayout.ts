import { DEFAULT_REEF_COLONY_LAYOUT_CONFIG } from './config';
import { clamp01, round6, seededUnit, stableSeed } from '../math';
import type { ReefGrowthInstruction, ReefSpeciesBlueprint } from '../types';
import type {
  BuildReefColonyLayoutInput,
  ReefColonyLayoutConfig,
  ReefColonyLayoutState,
  ReefColonyPlacement,
  ReefLayoutVec3,
  ReefSubstrateCell,
} from './types';

const TAU = Math.PI * 2;

interface PlacementCandidate {
  cellId: string;
  radialBand: number;
  verticalBand: number;
  azimuthSectorIndex: number;
  azimuthRad: number;
  radialDistance: number;
  position: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  facingRad: number;
  footprintRadius: number;
  targetHeight: number;
  currentExposure: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeAngle(value: number): number {
  return round6(modulo(value, TAU));
}

function normalizeVector(value: ReefLayoutVec3): ReefLayoutVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length <= 1e-9) return { x: 0, y: 1, z: 0 };
  return {
    x: round6(value.x / length),
    y: round6(value.y / length),
    z: round6(value.z / length),
  };
}

function validateConfig(config: ReefColonyLayoutConfig): void {
  if (!config.rulesVersion.trim()) {
    throw new Error('Reef Colony Layout requires a non-empty rulesVersion.');
  }
  for (const [name, value, minimum] of [
    ['azimuthSectorCount', config.azimuthSectorCount, 8],
    ['maximumAttemptsPerColony', config.maximumAttemptsPerColony, 1],
    ['maximumColoniesPerCell', config.maximumColoniesPerCell, 1],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`Reef Colony Layout ${name} must be an integer >= ${minimum}.`);
    }
  }
  for (const [name, value] of [
    ['minimumClearanceRatio', config.minimumClearanceRatio],
    ['surfaceNormalStepRatio', config.surfaceNormalStepRatio],
    ['radialPaddingRatio', config.radialPaddingRatio],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Reef Colony Layout ${name} must be finite and positive.`);
    }
  }
}

function surfaceHeightAt(species: ReefSpeciesBlueprint, x: number, z: number): number {
  const structure = species.structure;
  const radius = Math.hypot(x, z);
  const normalizedRadius = clamp01(radius / structure.substrateRadius);
  const azimuth = Math.atan2(z, x);
  const phaseA = seededUnit(structure.seed, 'surface-phase-a') * TAU;
  const phaseB = seededUnit(structure.seed, 'surface-phase-b') * TAU;
  const shelfIndex = Math.min(
    structure.shelfCount - 1,
    Math.floor(normalizedRadius * structure.shelfCount),
  );
  const shelfProgress = structure.shelfCount <= 1
    ? 1
    : 1 - shelfIndex / (structure.shelfCount - 1);
  const mound = structure.reefHeight * (
    0.16 + 0.84 * Math.pow(1 - normalizedRadius, 1.35)
  );
  const shelf = structure.reefHeight
    * structure.verticalRelief
    * 0.12
    * shelfProgress;
  const radialRipple = Math.sin(azimuth * 3 + phaseA)
    * structure.reefHeight
    * structure.verticalRelief
    * 0.035
    * (1 - normalizedRadius * 0.65);
  const crossRipple = Math.cos(normalizedRadius * Math.PI * 4 + phaseB)
    * structure.reefHeight
    * structure.verticalRelief
    * 0.028;
  const slope = Math.cos(azimuth - structure.currentDirectionRad)
    * structure.reefHeight
    * structure.slopeBias
    * 0.08
    * normalizedRadius;

  return round6(Math.max(0, mound + shelf + radialRipple + crossRipple + slope));
}

function surfaceNormalAt(
  species: ReefSpeciesBlueprint,
  x: number,
  z: number,
  config: ReefColonyLayoutConfig,
): ReefLayoutVec3 {
  const step = Math.max(
    0.004,
    species.structure.substrateRadius * config.surfaceNormalStepRatio,
  );
  const left = surfaceHeightAt(species, x - step, z);
  const right = surfaceHeightAt(species, x + step, z);
  const back = surfaceHeightAt(species, x, z - step);
  const front = surfaceHeightAt(species, x, z + step);
  return normalizeVector({
    x: left - right,
    y: step * 2,
    z: back - front,
  });
}

function currentExposureAt(species: ReefSpeciesBlueprint, azimuthRad: number): number {
  const facing = 0.5 + Math.cos(
    azimuthRad - species.structure.currentDirectionRad,
  ) * 0.5;
  return round6(clamp01(
    facing * (0.64 + species.structure.currentStrength * 0.36),
  ));
}

function cellId(radialBand: number, azimuthSectorIndex: number): string {
  return `reef:substrate-cell:r${radialBand}:a${azimuthSectorIndex}`;
}

function buildCells(
  species: ReefSpeciesBlueprint,
  config: ReefColonyLayoutConfig,
): ReefSubstrateCell[] {
  const cells: ReefSubstrateCell[] = [];
  const radialBandCount = species.grammar.radialBandCount;
  const sectorAngle = TAU / config.azimuthSectorCount;

  for (let radialBand = 0; radialBand < radialBandCount; radialBand += 1) {
    const radialStart = species.structure.substrateRadius * radialBand / radialBandCount;
    const radialEnd = species.structure.substrateRadius * (radialBand + 1) / radialBandCount;
    const radialDistance = (radialStart + radialEnd) * 0.5;

    for (
      let azimuthSectorIndex = 0;
      azimuthSectorIndex < config.azimuthSectorCount;
      azimuthSectorIndex += 1
    ) {
      const azimuthRad = (azimuthSectorIndex + 0.5) * sectorAngle;
      const x = Math.cos(azimuthRad) * radialDistance;
      const z = Math.sin(azimuthRad) * radialDistance;
      const y = surfaceHeightAt(species, x, z);
      cells.push({
        id: cellId(radialBand, azimuthSectorIndex),
        radialBand,
        azimuthSectorIndex,
        radialStart: round6(radialStart),
        radialEnd: round6(radialEnd),
        center: { x: round6(x), y, z: round6(z) },
        normal: surfaceNormalAt(species, x, z, config),
        currentExposure: currentExposureAt(species, azimuthRad),
        capacity: config.maximumColoniesPerCell,
        occupiedColonyIds: [],
      });
    }
  }

  return cells;
}

function tierScale(tier: ReefGrowthInstruction['tier']): number {
  if (tier === 'anchor') return 1.34;
  if (tier === 'primary') return 1.14;
  if (tier === 'companion') return 0.96;
  return 0.78;
}

function footprintRadiusFor(
  species: ReefSpeciesBlueprint,
  instruction: ReefGrowthInstruction,
): number {
  const maturityScale = 0.68 + instruction.maturity * 0.32;
  return round6(
    species.structure.colonySpacing
      * (0.52 + instruction.footprint * 0.78)
      * tierScale(instruction.tier)
      * maturityScale,
  );
}

function targetHeightFor(
  species: ReefSpeciesBlueprint,
  instruction: ReefGrowthInstruction,
): number {
  return round6(
    species.structure.reefHeight
      * (0.055 + instruction.heightBias * 0.26)
      * (0.55 + instruction.maturity * 0.45)
      * tierScale(instruction.tier),
  );
}

function facingFor(
  species: ReefSpeciesBlueprint,
  instruction: ReefGrowthInstruction,
  azimuthRad: number,
  colonySeed: number,
): number {
  const jitter = (seededUnit(colonySeed, 'facing-jitter') - 0.5) * 0.18;
  if (instruction.morphotype === 'sea-fan') {
    return normalizeAngle(species.structure.currentDirectionRad + Math.PI * 0.5 + jitter);
  }
  if (instruction.morphotype === 'soft-coral') {
    return normalizeAngle(species.structure.currentDirectionRad + Math.PI + jitter);
  }
  if (instruction.morphotype === 'plating') {
    return normalizeAngle(azimuthRad + Math.PI * 0.5 + jitter);
  }
  return normalizeAngle(azimuthRad + jitter * 0.5);
}

function symmetricOffset(index: number): number {
  if (index <= 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return index % 2 === 1 ? magnitude : -magnitude;
}

function roleRadialShift(instruction: ReefGrowthInstruction): number {
  if (instruction.role === 'frontier') return 0.1;
  if (instruction.role === 'foundation') return -0.08;
  if (instruction.role === 'landmark') return -0.04;
  return 0;
}

function candidateForAttempt(
  species: ReefSpeciesBlueprint,
  instruction: ReefGrowthInstruction,
  recruitIndex: number,
  colonySeed: number,
  attempt: number,
  config: ReefColonyLayoutConfig,
): PlacementCandidate | null {
  const radialBandCount = species.grammar.radialBandCount;
  const radialAttempt = Math.floor(attempt / 5);
  const radialBand = clamp(
    instruction.radialBand + symmetricOffset(radialAttempt),
    0,
    radialBandCount - 1,
  );
  const sectorAttempt = attempt % 5;
  const sectorAngle = TAU / config.azimuthSectorCount;
  const preferredSector = Math.floor(
    normalizeAngle(instruction.preferredAzimuthRad) / sectorAngle,
  );
  const recruitStride = Math.max(3, Math.round(config.azimuthSectorCount * 0.29));
  const azimuthSectorIndex = modulo(
    preferredSector + recruitIndex * recruitStride + symmetricOffset(sectorAttempt),
    config.azimuthSectorCount,
  );
  const azimuthJitter = (seededUnit(colonySeed, `azimuth:${attempt}`) - 0.5)
    * sectorAngle
    * 0.56;
  const azimuthRad = normalizeAngle(
    (azimuthSectorIndex + 0.5) * sectorAngle + azimuthJitter,
  );

  const footprintRadius = footprintRadiusFor(species, instruction);
  const padding = species.structure.substrateRadius * config.radialPaddingRatio;
  const minimumRadius = species.structure.substrateRadius
    * (radialBand + 0.12)
    / radialBandCount;
  const maximumRadius = Math.min(
    species.structure.substrateRadius * (radialBand + 0.88) / radialBandCount,
    species.structure.substrateRadius - footprintRadius - padding,
  );
  if (maximumRadius <= minimumRadius) return null;

  const verticalShare = species.grammar.verticalBandCount <= 1
    ? 0
    : instruction.verticalBand / (species.grammar.verticalBandCount - 1);
  const radialBlend = clamp(
    0.5
      + (seededUnit(colonySeed, `radius:${attempt}`) - 0.5) * 0.42
      - verticalShare * 0.12
      + roleRadialShift(instruction),
    0.08,
    0.92,
  );
  const radialDistance = round6(
    minimumRadius + (maximumRadius - minimumRadius) * radialBlend,
  );
  const x = Math.cos(azimuthRad) * radialDistance;
  const z = Math.sin(azimuthRad) * radialDistance;
  const y = surfaceHeightAt(species, x, z);

  return {
    cellId: cellId(radialBand, azimuthSectorIndex),
    radialBand,
    verticalBand: instruction.verticalBand,
    azimuthSectorIndex,
    azimuthRad,
    radialDistance,
    position: { x: round6(x), y, z: round6(z) },
    normal: surfaceNormalAt(species, x, z, config),
    facingRad: facingFor(species, instruction, azimuthRad, colonySeed),
    footprintRadius,
    targetHeight: targetHeightFor(species, instruction),
    currentExposure: currentExposureAt(species, azimuthRad),
  };
}

function collides(
  candidate: PlacementCandidate,
  accepted: readonly ReefColonyPlacement[],
  minimumClearanceRatio: number,
): boolean {
  return accepted.some((colony) => {
    const distance = Math.hypot(
      candidate.position.x - colony.position.x,
      candidate.position.z - colony.position.z,
    );
    const required = (candidate.footprintRadius + colony.footprintRadius)
      * minimumClearanceRatio;
    return distance < required - 1e-6;
  });
}

function colonyId(instructionId: string, recruitIndex: number): string {
  const suffix = instructionId.startsWith('reef:')
    ? instructionId.slice('reef:'.length)
    : instructionId;
  return `reef:colony:${suffix}:${recruitIndex}`;
}

function minimumClearance(colonies: readonly ReefColonyPlacement[]): number | null {
  if (colonies.length < 2) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < colonies.length; leftIndex += 1) {
    const left = colonies[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < colonies.length; rightIndex += 1) {
      const right = colonies[rightIndex];
      if (!right) continue;
      const distance = Math.hypot(
        left.position.x - right.position.x,
        left.position.z - right.position.z,
      );
      minimum = Math.min(
        minimum,
        distance - left.footprintRadius - right.footprintRadius,
      );
    }
  }
  return Number.isFinite(minimum) ? round6(minimum) : null;
}

/**
 * Pure Reef Colony Layout adapter. It converts Phase 1 intent into stable
 * substrate cells and collision-safe colony anchors without creating geometry,
 * materials, renderer instances, UI state or database work.
 */
export function buildReefColonyLayout(
  input: BuildReefColonyLayoutInput,
): ReefColonyLayoutState {
  if (input.species.species !== 'reef') {
    throw new Error('Reef Colony Layout requires a Reef Species blueprint.');
  }
  const config = input.config ?? DEFAULT_REEF_COLONY_LAYOUT_CONFIG;
  validateConfig(config);

  const cells = buildCells(input.species, config);
  const cellsById = new Map(cells.map((cell) => [cell.id, cell] as const));
  const colonies: ReefColonyPlacement[] = [];
  const rejectedColonyIds: string[] = [];
  const truncatedColonyIds: string[] = [];
  const truncatedInstructionIds: string[] = [];
  const instructionIdsWithoutAcceptedColonies: string[] = [];
  let candidateColonyCount = 0;
  let collisionRejectionCount = 0;
  let cellCapacityRejectionCount = 0;

  for (const instruction of input.species.growth) {
    const acceptedBefore = colonies.length;
    let instructionTruncated = false;

    for (let recruitIndex = 0; recruitIndex < instruction.recruitCount; recruitIndex += 1) {
      candidateColonyCount += 1;
      const id = colonyId(instruction.id, recruitIndex);
      if (colonies.length >= input.species.grammar.maximumAcceptedColonies) {
        truncatedColonyIds.push(id);
        instructionTruncated = true;
        continue;
      }

      const seed = stableSeed(instruction.seed, id);
      let acceptedCandidate: PlacementCandidate | null = null;

      for (let attempt = 0; attempt < config.maximumAttemptsPerColony; attempt += 1) {
        const candidate = candidateForAttempt(
          input.species,
          instruction,
          recruitIndex,
          seed,
          attempt,
          config,
        );
        if (!candidate) continue;

        const cell = cellsById.get(candidate.cellId);
        if (!cell || cell.occupiedColonyIds.length >= cell.capacity) {
          cellCapacityRejectionCount += 1;
          continue;
        }
        if (collides(candidate, colonies, config.minimumClearanceRatio)) {
          collisionRejectionCount += 1;
          continue;
        }
        acceptedCandidate = candidate;
        break;
      }

      if (!acceptedCandidate) {
        rejectedColonyIds.push(id);
        continue;
      }

      const placement: ReefColonyPlacement = {
        id,
        sourceInstructionId: instruction.id,
        sourceEventId: instruction.sourceEventId,
        sourceEpisodeId: instruction.sourceEpisodeId,
        sequence: instruction.sequence * 10 + recruitIndex,
        recruitIndex,
        seed,
        morphotype: instruction.morphotype,
        role: instruction.role,
        tier: instruction.tier,
        emphasized: instruction.emphasized,
        weight: instruction.weight,
        maturity: instruction.maturity,
        footprintIntent: instruction.footprint,
        heightBias: instruction.heightBias,
        branchingBias: instruction.branchingBias,
        substrateCellId: acceptedCandidate.cellId,
        radialBand: acceptedCandidate.radialBand,
        verticalBand: acceptedCandidate.verticalBand,
        azimuthSectorIndex: acceptedCandidate.azimuthSectorIndex,
        azimuthRad: acceptedCandidate.azimuthRad,
        radialDistance: acceptedCandidate.radialDistance,
        position: acceptedCandidate.position,
        normal: acceptedCandidate.normal,
        facingRad: acceptedCandidate.facingRad,
        footprintRadius: acceptedCandidate.footprintRadius,
        targetHeight: acceptedCandidate.targetHeight,
        currentExposure: acceptedCandidate.currentExposure,
      };
      colonies.push(placement);
      cellsById.get(placement.substrateCellId)?.occupiedColonyIds.push(placement.id);
    }

    if (instructionTruncated) truncatedInstructionIds.push(instruction.id);
    if (colonies.length === acceptedBefore) {
      instructionIdsWithoutAcceptedColonies.push(instruction.id);
    }
  }

  const occupiedCellIds = cells
    .filter((cell) => cell.occupiedColonyIds.length > 0)
    .map((cell) => cell.id);
  const crowdedCellIds = cells
    .filter((cell) => cell.occupiedColonyIds.length >= cell.capacity)
    .map((cell) => cell.id);

  return {
    reefColonyLayoutVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    descriptor: {
      id: 'reef:colony-layout',
      substrateId: 'reef:substrate-occupancy',
      colonyId: 'reef:colony-anchor',
    },
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    asOf: input.species.asOf,
    cells,
    colonies,
    diagnostics: {
      sourceInstructionCount: input.species.growth.length,
      candidateColonyCount,
      acceptedColonyCount: colonies.length,
      rejectedColonyIds,
      truncatedColonyIds,
      truncatedInstructionIds,
      instructionIdsWithoutAcceptedColonies,
      occupiedCellIds,
      crowdedCellIds,
      collisionRejectionCount,
      cellCapacityRejectionCount,
      maximumAcceptedColonies: input.species.grammar.maximumAcceptedColonies,
      maximumAttemptsPerColony: config.maximumAttemptsPerColony,
      colonyBudgetReached: truncatedColonyIds.length > 0,
      minimumAcceptedClearance: minimumClearance(colonies),
    },
  };
}
