import type {
  GrowthCenterRole,
  GrowthHostPreference,
  UniversalGrowthBlueprint,
  UniversalGrowthCenter,
  UniversalGrowthColony,
  UniversalGrowthInstruction,
} from '../../growth';
import { round6, stableSeed } from './math';
import type {
  CrystalArchetype,
  CrystalGrowthInstruction,
  CrystalSpeciesBlueprint,
} from './types';

const CENTER_SEQUENCE_STRIDE = 8;

function sectorMembership(blueprint: CrystalSpeciesBlueprint): Map<string, string> {
  const membership = new Map<string, string>();
  for (const colony of blueprint.colonies) {
    for (const instructionId of colony.instructionIds) membership.set(instructionId, colony.id);
  }
  return membership;
}

function dominantHostPreference(_instruction: CrystalGrowthInstruction): GrowthHostPreference {
  // Phase 3B-1: each Growth Center begins at the monarch foot. Supporting
  // members may then grow from their local dominant through same-colony rules.
  return 'root';
}

function dominantMaxGeneration(_instruction: CrystalGrowthInstruction): number {
  return 1;
}

function dominantDirectionInheritance(instruction: CrystalGrowthInstruction): number {
  // Cluster-composition fix (visual QA, 2026-08-02): event-spires are the
  // most visually prominent per-event bodies, so they most need to read as
  // distinct fingers radiating from the mother rather than hugging its own
  // axis -- raise their weight on the true host surface normal above even
  // satellite/inclusion so the outward lean actually correlates with where
  // each one is anchored, instead of a mostly-random preferred direction.
  if (instruction.kind === 'event-spire') return 0.56;
  if (instruction.kind === 'satellite') return 0.36;
  if (instruction.kind === 'inclusion') return 0.48;
  return 0.5;
}

function dominantMinUpwardComponent(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 0.62;
  if (instruction.kind === 'satellite') return 0.42;
  if (instruction.kind === 'inclusion') return 0.3;
  return 0.9;
}

function dominantAttachmentDepth(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return Math.max(0.32, instruction.attachmentDepth * 1.35);
  if (instruction.kind === 'inclusion') return Math.max(0.48, instruction.attachmentDepth * 2.4);
  if (instruction.kind === 'satellite') return Math.max(0.24, instruction.attachmentDepth * 1.35);
  return instruction.attachmentDepth;
}

function surfaceRadiusScaleFor(archetype: CrystalArchetype, kind: string): number {
  if (kind === 'mother') return 0.76;
  if (archetype === 'blade') return 0.34;
  if (archetype === 'tabular') return 0.43;
  if (archetype === 'needle') return 0.51;
  if (archetype === 'fan') return 0.54;
  if (archetype === 'massive') return 0.64;
  return 0.64;
}

function dominantPlacementBias(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return round6(0.22 + instruction.radialBias * 0.16);
  if (instruction.kind === 'satellite') return round6(0.08 + instruction.radialBias * 0.35);
  if (instruction.kind === 'inclusion') return round6(0.04 + instruction.radialBias * 0.28);
  return 0;
}

function dominantDimensions(
  instruction: CrystalGrowthInstruction,
): { axialScale: number; radialScale: number } {
  // Monarch proportions (visual QA, 2026-08-02). The old 1.64/0.34 rendered
  // at roughly 2.5:1 height-to-width — a squat block rather than the slender
  // spire the reference art calls for. Raising axial and cutting radial takes
  // it to roughly 4.5-5:1, and the taller axial also compensates for the new,
  // much slower relationship maturity curve so a long relationship still ends
  // up with a large crystal.
  if (instruction.kind === 'mother') {
    return { axialScale: 1.75, radialScale: 0.19 };
  }
  // Companions must read as crystals, not pebbles. They used to render at
  // roughly 1.8:1 height-to-width (the largest was a squat cream block sitting
  // in front of the monarch), because their radii were pinned: while they were
  // attached to a host, slimming them changed how their base ring buried and
  // could leave a junction unsealed. ADR-0003 removed those attachments
  // entirely, so radius is now free and set for silhouette alone — roughly
  // 3.5-4.5:1, slender enough to be crystals while staying well under the
  // monarch's ~5:1 so she keeps the eye.
  if (instruction.kind === 'event-spire') {
    return {
      axialScale: round6(0.5 + instruction.weight * 0.34),
      radialScale: round6(0.062 + instruction.weight * 0.038),
    };
  }
  if (instruction.kind === 'satellite') {
    return {
      axialScale: round6(0.28 + instruction.weight * 0.28),
      radialScale: round6(0.042 + instruction.weight * 0.024),
    };
  }
  return {
    axialScale: round6(0.14 + instruction.weight * 0.14),
    radialScale: round6(0.02 + instruction.weight * 0.009),
  };
}

function centerId(instruction: CrystalGrowthInstruction): string {
  return `${instruction.id}:center`;
}

function commonAttributes(
  source: CrystalGrowthInstruction,
  growthCenterId: string | null,
  growthCenterRole: GrowthCenterRole | null,
  sectorColonyId: string | null,
  archetype: CrystalArchetype,
): UniversalGrowthInstruction['attributes'] {
  return {
    formationKind: source.kind,
    archetype,
    channel: source.channel,
    sourceEpisodeId: source.sourceEpisodeId,
    growthCenterId,
    growthCenterRole,
    centerSourceInstructionId: growthCenterId === null ? null : source.id,
    sectorColonyId,
  };
}

function adaptMother(instruction: CrystalGrowthInstruction): UniversalGrowthInstruction {
  const size = dominantDimensions(instruction);
  return {
    id: instruction.id,
    sourceId: instruction.sourceEventId,
    sequence: -1,
    colonyId: null,
    epochIndex: instruction.epochIndex,
    kind: `crystal:${instruction.kind}`,
    tier: instruction.tier,
    seed: instruction.seed,
    emphasized: instruction.emphasized,
    weight: instruction.weight,
    maturity: instruction.maturity,
    axialScale: size.axialScale,
    radialScale: size.radialScale,
    surfaceRadiusScale: surfaceRadiusScaleFor(instruction.archetype, instruction.kind),
    preferredAzimuthRad: instruction.azimuthRad,
    preferredElevation: instruction.elevation,
    radialBias: 0,
    attachmentDepth: instruction.attachmentDepth,
    hostPreference: 'root',
    maxGeneration: 1,
    directionInheritance: 0.5,
    minUpwardComponent: 0.9,
    attributes: commonAttributes(instruction, null, null, null, instruction.archetype),
    growthCenterId: null,
    growthCenterRole: null,
  };
}

function adaptDominant(
  source: CrystalGrowthInstruction,
  sequence: number,
  growthCenterId: string,
  sectorColonyId: string | null,
): UniversalGrowthInstruction {
  const size = dominantDimensions(source);
  return {
    id: source.id,
    sourceId: source.sourceEventId,
    sequence,
    colonyId: growthCenterId,
    epochIndex: source.epochIndex,
    kind: `crystal:${source.kind}`,
    tier: source.tier,
    seed: source.seed,
    emphasized: source.emphasized,
    weight: source.weight,
    maturity: source.maturity,
    axialScale: size.axialScale,
    radialScale: size.radialScale,
    surfaceRadiusScale: surfaceRadiusScaleFor(source.archetype, source.kind),
    preferredAzimuthRad: source.azimuthRad,
    preferredElevation: source.elevation,
    radialBias: dominantPlacementBias(source),
    attachmentDepth: dominantAttachmentDepth(source),
    hostPreference: dominantHostPreference(source),
    maxGeneration: dominantMaxGeneration(source),
    directionInheritance: dominantDirectionInheritance(source),
    minUpwardComponent: dominantMinUpwardComponent(source),
    attributes: commonAttributes(source, growthCenterId, 'dominant', sectorColonyId, source.archetype),
    growthCenterId,
    growthCenterRole: 'dominant',
  };
}

function adaptCenter(
  source: CrystalGrowthInstruction,
  centerIndex: number,
  sectorColonyId: string | null,
): {
  center: UniversalGrowthCenter;
  colony: UniversalGrowthColony;
  instructions: UniversalGrowthInstruction[];
} {
  // One crystal per event, and nothing grows on it. A centre used to also
  // publish 3-5 local members attached to its dominant, which is what put
  // growths on the sides of crystals and pushed a typical couple to 38 bodies.
  // See docs/05_ADR/ADR-0003-crystal-free-standing-druse.md.
  const id = centerId(source);
  const sequenceBase = centerIndex * CENTER_SEQUENCE_STRIDE;
  const instructions: UniversalGrowthInstruction[] = [
    adaptDominant(source, sequenceBase, id, sectorColonyId),
  ];

  const instructionIds = instructions.map((instruction) => instruction.id);
  const seed = stableSeed(source.seed, id);
  const center: UniversalGrowthCenter = {
    id,
    sourceInstructionId: source.id,
    sourceId: source.sourceEventId,
    seed,
    epochIndex: source.epochIndex,
    kind: `crystal:${source.kind}`,
    preferredAzimuthRad: source.azimuthRad,
    preferredElevation: source.elevation,
    weight: source.weight,
    instructionIds,
  };
  const colony: UniversalGrowthColony = {
    id,
    seed,
    epochIndex: source.epochIndex,
    kind: `growth-center:${source.kind}`,
    preferredAzimuthRad: source.azimuthRad,
    preferredElevation: source.elevation,
    weight: source.weight,
    instructionIds,
  };
  return { center, colony, instructions };
}

/**
 * Crystal-only translation into the species-neutral Growth Engine contract.
 * Each stable event formation becomes one deterministic Growth Center with a
 * dominant crystal and a compact local family of satellites and micro-growth.
 */
export function crystalToGrowthBlueprint(
  blueprint: CrystalSpeciesBlueprint,
): UniversalGrowthBlueprint {
  const sectorByInstruction = sectorMembership(blueprint);
  const adaptedCenters = blueprint.formations.map((formation, index) => adaptCenter(
    formation,
    index,
    sectorByInstruction.get(formation.id) ?? null,
  ));

  return {
    growthBlueprintVersion: 1,
    species: 'crystal',
    sourceBlueprintVersion: `crystal:${blueprint.speciesBlueprintVersion}:growth-centers@2`,
    engineVersion: blueprint.engineVersion,
    speciesRulesVersion: blueprint.rulesVersion,
    artifactSeed: blueprint.artifactSeed,
    root: adaptMother(blueprint.mother),
    instructions: adaptedCenters.flatMap((entry) => entry.instructions),
    colonies: adaptedCenters.map((entry) => entry.colony),
    growthCenters: adaptedCenters.map((entry) => entry.center),
  };
}