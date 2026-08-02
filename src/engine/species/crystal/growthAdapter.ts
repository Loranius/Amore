import type {
  GrowthCenterRole,
  GrowthHostPreference,
  GrowthTier,
  UniversalGrowthBlueprint,
  UniversalGrowthCenter,
  UniversalGrowthColony,
  UniversalGrowthInstruction,
} from '../../growth';
import { round6, seededUnit, stableSeed } from './math';
import type {
  CrystalArchetype,
  CrystalGrowthInstruction,
  CrystalSpeciesBlueprint,
} from './types';

const CENTER_SEQUENCE_STRIDE = 8;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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
  if (instruction.kind === 'mother') {
    return { axialScale: 1.64, radialScale: 0.34 };
  }
  if (instruction.kind === 'event-spire') {
    return {
      axialScale: round6(0.76 + instruction.weight * 0.54),
      radialScale: round6(0.15 + instruction.weight * 0.065),
    };
  }
  if (instruction.kind === 'satellite') {
    return {
      axialScale: round6(0.42 + instruction.weight * 0.42),
      radialScale: round6(0.1 + instruction.weight * 0.045),
    };
  }
  return {
    axialScale: round6(0.12 + instruction.weight * 0.16),
    radialScale: round6(0.055 + instruction.weight * 0.02),
  };
}

function centerId(instruction: CrystalGrowthInstruction): string {
  return `${instruction.id}:center`;
}

function centerMemberCounts(instruction: CrystalGrowthInstruction): {
  satelliteCount: number;
  microCount: number;
} {
  const satelliteDraw = seededUnit(instruction.seed, 'growth-center:satellite-count');
  const microDraw = seededUnit(instruction.seed, 'growth-center:micro-count');

  if (instruction.kind === 'event-spire') {
    return {
      satelliteCount: 2 + Math.floor(satelliteDraw * 2),
      microCount: 2,
    };
  }
  if (instruction.kind === 'satellite') {
    return {
      satelliteCount: 1 + Math.floor(satelliteDraw * 2),
      microCount: 1 + Math.floor(microDraw * 2),
    };
  }
  return {
    satelliteCount: 1,
    microCount: 2 + Math.floor(microDraw * 2),
  };
}

function memberArchetype(
  source: CrystalGrowthInstruction,
  role: Exclude<GrowthCenterRole, 'dominant'>,
  memberSeed: number,
): CrystalArchetype {
  const candidates: readonly CrystalArchetype[] = role === 'satellite'
    ? [source.archetype, 'prismatic', 'needle', 'twin']
    : ['needle', 'etched', 'blade'];
  const index = Math.min(
    candidates.length - 1,
    Math.floor(seededUnit(memberSeed, 'archetype') * candidates.length),
  );
  return candidates[index] ?? candidates[0]!;
}

function memberTier(
  source: CrystalGrowthInstruction,
  role: Exclude<GrowthCenterRole, 'dominant'>,
): GrowthTier {
  if (role === 'micro') return 'micro';
  return source.weight >= 0.65 ? 'family' : 'companion';
}

function memberDimensions(
  source: CrystalGrowthInstruction,
  role: Exclude<GrowthCenterRole, 'dominant'>,
  memberSeed: number,
): { axialScale: number; radialScale: number } {
  const base = dominantDimensions(source);
  if (role === 'satellite') {
    const axialFactor = 0.34 + seededUnit(memberSeed, 'axial') * 0.18;
    const radialFactor = 0.42 + seededUnit(memberSeed, 'radial') * 0.16;
    return {
      axialScale: round6(Math.max(0.1, base.axialScale * axialFactor)),
      radialScale: round6(Math.max(0.04, base.radialScale * radialFactor)),
    };
  }
  const axialFactor = 0.14 + seededUnit(memberSeed, 'axial') * 0.11;
  const radialFactor = 0.22 + seededUnit(memberSeed, 'radial') * 0.12;
  return {
    axialScale: round6(Math.max(0.075, base.axialScale * axialFactor)),
    radialScale: round6(Math.max(0.03, base.radialScale * radialFactor)),
  };
}

function memberDirection(
  source: CrystalGrowthInstruction,
  role: Exclude<GrowthCenterRole, 'dominant'>,
  localIndex: number,
  memberSeed: number,
): { preferredAzimuthRad: number; preferredElevation: number; radialBias: number } {
  const azimuthJitter = (seededUnit(memberSeed, 'azimuth-jitter') - 0.5) * 0.58;
  const preferredAzimuthRad = round6(
    source.azimuthRad + (localIndex + 1) * GOLDEN_ANGLE + azimuthJitter,
  );
  if (role === 'satellite') {
    return {
      preferredAzimuthRad,
      preferredElevation: round6(Math.max(
        0.34,
        source.elevation * 0.78 + seededUnit(memberSeed, 'elevation') * 0.14,
      )),
      radialBias: round6(0.2 + seededUnit(memberSeed, 'radial-bias') * 0.48),
    };
  }
  return {
    preferredAzimuthRad,
    preferredElevation: round6(0.28 + seededUnit(memberSeed, 'elevation') * 0.24),
    radialBias: round6(0.16 + seededUnit(memberSeed, 'radial-bias') * 0.38),
  };
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

function adaptMember(
  source: CrystalGrowthInstruction,
  role: Exclude<GrowthCenterRole, 'dominant'>,
  memberIndex: number,
  localIndex: number,
  sequence: number,
  growthCenterId: string,
  sectorColonyId: string | null,
): UniversalGrowthInstruction {
  const id = `${source.id}:${role}:${memberIndex}`;
  const seed = stableSeed(source.seed, id);
  const size = memberDimensions(source, role, seed);
  const direction = memberDirection(source, role, localIndex, seed);
  const archetype = memberArchetype(source, role, seed);
  const kind = role === 'satellite' ? 'crystal:satellite' : 'crystal:inclusion';

  return {
    id,
    sourceId: source.sourceEventId,
    sequence,
    colonyId: growthCenterId,
    epochIndex: source.epochIndex,
    kind,
    tier: memberTier(source, role),
    seed,
    emphasized: false,
    weight: round6(source.weight * (role === 'satellite' ? 0.38 : 0.16)),
    maturity: source.maturity,
    axialScale: size.axialScale,
    radialScale: size.radialScale,
    surfaceRadiusScale: surfaceRadiusScaleFor(archetype, role),
    preferredAzimuthRad: direction.preferredAzimuthRad,
    preferredElevation: direction.preferredElevation,
    radialBias: direction.radialBias,
    attachmentDepth: role === 'satellite'
      ? round6(0.3 + seededUnit(seed, 'burial') * 0.14)
      : round6(0.48 + seededUnit(seed, 'burial') * 0.18),
    hostPreference: 'same-colony',
    maxGeneration: role === 'satellite' ? 2 : 3,
    directionInheritance: role === 'satellite' ? 0.5 : 0.58,
    minUpwardComponent: role === 'satellite' ? 0.34 : 0.24,
    attributes: commonAttributes(source, growthCenterId, role, sectorColonyId, archetype),
    growthCenterId,
    growthCenterRole: role,
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
  const id = centerId(source);
  const sequenceBase = centerIndex * CENTER_SEQUENCE_STRIDE;
  const instructions: UniversalGrowthInstruction[] = [
    adaptDominant(source, sequenceBase, id, sectorColonyId),
  ];
  const counts = centerMemberCounts(source);
  let localIndex = 1;

  for (let index = 0; index < counts.satelliteCount; index += 1) {
    instructions.push(adaptMember(
      source,
      'satellite',
      index,
      localIndex,
      sequenceBase + localIndex,
      id,
      sectorColonyId,
    ));
    localIndex += 1;
  }
  for (let index = 0; index < counts.microCount; index += 1) {
    instructions.push(adaptMember(
      source,
      'micro',
      index,
      localIndex,
      sequenceBase + localIndex,
      id,
      sectorColonyId,
    ));
    localIndex += 1;
  }

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