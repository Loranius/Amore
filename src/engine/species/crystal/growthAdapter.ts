import type {
  GrowthHostPreference,
  UniversalGrowthBlueprint,
  UniversalGrowthInstruction,
} from '../../growth';
import type {
  CrystalGrowthInstruction,
  CrystalSpeciesBlueprint,
} from './types';

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function colonyMembership(blueprint: CrystalSpeciesBlueprint): Map<string, string> {
  const membership = new Map<string, string>();
  for (const colony of blueprint.colonies) {
    for (const instructionId of colony.instructionIds) membership.set(instructionId, colony.id);
  }
  return membership;
}

function hostPreference(instruction: CrystalGrowthInstruction): GrowthHostPreference {
  if (instruction.kind === 'mother' || instruction.kind === 'event-spire') return 'root';
  if (instruction.kind === 'inclusion') return 'same-colony';
  return 'balanced';
}

function maxGeneration(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 2;
  if (instruction.kind === 'satellite') return 3;
  if (instruction.kind === 'inclusion') return 4;
  return 1;
}

function directionInheritance(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 0.56;
  if (instruction.kind === 'satellite') return 0.67;
  if (instruction.kind === 'inclusion') return 0.78;
  return 0.5;
}

function dimensions(
  blueprint: CrystalSpeciesBlueprint,
  instruction: CrystalGrowthInstruction,
): { axialScale: number; radialScale: number } {
  const density = blueprint.pressures.density;
  const stability = blueprint.pressures.stability;

  if (instruction.kind === 'mother') {
    return {
      axialScale: round6(1.5 + stability * 0.36 + density * 0.18),
      radialScale: round6(0.29 + density * 0.11 + stability * 0.055),
    };
  }
  if (instruction.kind === 'event-spire') {
    return {
      axialScale: round6(0.95 + instruction.weight * 0.82 + stability * 0.12),
      radialScale: round6(0.13 + instruction.weight * 0.075 + density * 0.035),
    };
  }
  if (instruction.kind === 'satellite') {
    return {
      axialScale: round6(0.56 + instruction.weight * 0.61 + blueprint.pressures.expansion * 0.12),
      radialScale: round6(0.09 + instruction.weight * 0.052 + density * 0.022),
    };
  }
  return {
    axialScale: round6(0.24 + instruction.weight * 0.34 + blueprint.pressures.surfaceComplexity * 0.07),
    radialScale: round6(0.068 + instruction.weight * 0.036 + density * 0.018),
  };
}

function adaptInstruction(
  blueprint: CrystalSpeciesBlueprint,
  instruction: CrystalGrowthInstruction,
  sequence: number,
  colonyId: string | null,
): UniversalGrowthInstruction {
  const size = dimensions(blueprint, instruction);
  return {
    id: instruction.id,
    sourceId: instruction.sourceEventId,
    sequence,
    colonyId,
    epochIndex: instruction.epochIndex,
    kind: `crystal:${instruction.kind}`,
    tier: instruction.tier,
    seed: instruction.seed,
    emphasized: instruction.emphasized,
    weight: instruction.weight,
    maturity: instruction.maturity,
    axialScale: size.axialScale,
    radialScale: size.radialScale,
    preferredAzimuthRad: instruction.azimuthRad,
    preferredElevation: instruction.elevation,
    radialBias: instruction.radialBias,
    attachmentDepth: instruction.attachmentDepth,
    hostPreference: hostPreference(instruction),
    maxGeneration: maxGeneration(instruction),
    directionInheritance: directionInheritance(instruction),
    minUpwardComponent: 0.16,
    attributes: {
      formationKind: instruction.kind,
      archetype: instruction.archetype,
      channel: instruction.channel,
      sourceEpisodeId: instruction.sourceEpisodeId,
    },
  };
}

/**
 * Crystal-only translation into the species-neutral Growth Engine contract.
 * No coordinates are chosen here.
 */
export function crystalToGrowthBlueprint(
  blueprint: CrystalSpeciesBlueprint,
): UniversalGrowthBlueprint {
  const membership = colonyMembership(blueprint);
  return {
    growthBlueprintVersion: 1,
    species: 'crystal',
    sourceBlueprintVersion: `crystal:${blueprint.speciesBlueprintVersion}`,
    engineVersion: blueprint.engineVersion,
    speciesRulesVersion: blueprint.rulesVersion,
    artifactSeed: blueprint.artifactSeed,
    root: adaptInstruction(blueprint, blueprint.mother, -1, null),
    instructions: blueprint.formations.map((instruction, index) => adaptInstruction(
      blueprint,
      instruction,
      index,
      membership.get(instruction.id) ?? null,
    )),
    colonies: blueprint.colonies.map((colony) => ({
      id: colony.id,
      seed: colony.seed,
      epochIndex: colony.epochIndex,
      kind: colony.channel,
      preferredAzimuthRad: colony.azimuthRad,
      preferredElevation: colony.elevation,
      weight: colony.weight,
      instructionIds: [...colony.instructionIds],
    })),
  };
}
