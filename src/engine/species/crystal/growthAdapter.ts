import type {
  GrowthCenterRole,
  GrowthHostPreference,
  UniversalGrowthBlueprint,
  UniversalGrowthCenter,
  UniversalGrowthColony,
  UniversalGrowthInstruction,
} from '../../growth';
import { stableSeed } from './math';
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

/**
 * How much a body's growth direction follows the surface it stands on versus
 * its own seeded preference. Every crystal stands in the ground now
 * (ADR-0003), so the surface normal is straight up and this mostly decides
 * how upright the body is.
 */
function dominantDirectionInheritance(instruction: CrystalGrowthInstruction): number {
  // The skirt hugs the ground and may lean freely; a year's crystal stands
  // like a smaller monarch.
  return instruction.kind === 'skirt' ? 0.34 : 0.5;
}

function dominantMinUpwardComponent(instruction: CrystalGrowthInstruction): number {
  return instruction.kind === 'skirt' ? 0.46 : 0.86;
}

function dominantAttachmentDepth(instruction: CrystalGrowthInstruction): number {
  return instruction.attachmentDepth;
}

function surfaceRadiusScaleFor(archetype: CrystalArchetype, kind: string): number {
  if (kind === 'mother') return 0.76;
  if (archetype === 'blade') return 0.34;
  if (archetype === 'tabular') return 0.43;
  if (archetype === 'needle') return 0.51;
  if (archetype === 'fan') return 0.54;
  return 0.64;
}

function dominantPlacementBias(instruction: CrystalGrowthInstruction): number {
  return instruction.radialBias;
}

/**
 * Since ADR-0004 the species itself decides every body's height and radius,
 * because the rule differs per kind — days together for the monarch, the
 * year's own history for an annual crystal. This adapter translates; it no
 * longer designs. The formulas that used to live here moved to
 * `formations.ts` unchanged.
 */
function dimensionsOf(
  instruction: CrystalGrowthInstruction,
): { axialScale: number; radialScale: number } {
  return { axialScale: instruction.axialScale, radialScale: instruction.radialScale };
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
    // Facets, tint and ring distance are species data since ADR-0004.
    // Attributes carry them because they are an open map: no published state
    // shape changes, and older snapshots keep reading.
    facetCount: source.facetCount,
    tintR: source.tintRgb[0],
    tintG: source.tintRgb[1],
    tintB: source.tintRgb[2],
    iridescence: source.iridescence,
    groundSpread: source.groundSpread,
  };
}

function adaptMother(instruction: CrystalGrowthInstruction): UniversalGrowthInstruction {
  const size = dimensionsOf(instruction);
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
    ringDistance: instruction.ringDistance,
    sizeIsFinal: true,
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
  const size = dimensionsOf(source);
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
    ringDistance: source.ringDistance,
    // Since ADR-0004 the crystal species computes every final size itself.
    sizeIsFinal: true,
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