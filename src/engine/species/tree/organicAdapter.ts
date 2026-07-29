import type {
  OrganicAttractor,
  OrganicSkeletonConfig,
} from '../../labs/organic';
import { round6, seededUnit } from './math';
import type {
  TreeBranchKind,
  TreeGrowthInstruction,
  TreeSpeciesBlueprint,
} from './types';

export interface TreeOrganicAdapterConfig {
  /** Bump whenever instruction-to-attractor placement changes. */
  rulesVersion: string;
  maxAttractors: number;
  maxNodes: number;
  maxGeneration: number;
  maxBranchSegments: number;
}

export interface TreeOrganicFieldDiagnostics {
  instructionCount: number;
  attractorCount: number;
  annualAttractorCount: number;
  eventAttractorCount: number;
  truncatedInstructionIds: string[];
}

export interface TreeOrganicField {
  organicTreeFieldVersion: 1;
  sourceSpeciesBlueprintVersion: `tree:${TreeSpeciesBlueprint['speciesBlueprintVersion']}`;
  speciesRulesVersion: string;
  adapterRulesVersion: string;
  seed: number;
  attractors: OrganicAttractor[];
  skeletonConfig: OrganicSkeletonConfig;
  diagnostics: TreeOrganicFieldDiagnostics;
}

export const DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG: TreeOrganicAdapterConfig = {
  rulesVersion: 'tree-organic-adapter-v0.1.0',
  maxAttractors: 32,
  maxNodes: 320,
  maxGeneration: 3,
  maxBranchSegments: 10,
};

function branchSpread(kind: TreeBranchKind): number {
  if (kind === 'landmark') return 0.13;
  if (kind === 'explorer' || kind === 'ornamental') return 0.25;
  if (kind === 'support') return 0.18;
  return 0.21;
}

function instructionAttractors(
  blueprint: TreeSpeciesBlueprint,
  instruction: TreeGrowthInstruction,
): OrganicAttractor[] {
  const result: OrganicAttractor[] = [];
  const spread = branchSpread(instruction.kind);
  const centerOffset = (instruction.attractorCount - 1) / 2;

  for (let index = 0; index < instruction.attractorCount; index += 1) {
    const id = `${instruction.id}:attractor:${index}`;
    const angleJitter = (seededUnit(instruction.seed, `${id}:angle`) * 2 - 1) * 0.07;
    const angle = instruction.preferredAzimuthRad
      + (index - centerOffset) * spread
      + angleJitter;
    const radialJitter = 0.9 + seededUnit(instruction.seed, `${id}:radius`) * 0.18;
    const radius = blueprint.structure.crownRadius
      * (0.26 + instruction.radialBias * 0.68)
      * radialJitter;
    const heightJitter = (seededUnit(instruction.seed, `${id}:height`) * 2 - 1) * 0.06;
    const y = blueprint.structure.trunkHeight
      + blueprint.structure.crownHeight
        * (0.08 + instruction.preferredElevation * 0.84 + heightJitter);

    result.push({
      id,
      sequence: instruction.sequence + index,
      position: {
        x: round6(Math.cos(angle) * radius),
        y: round6(y),
        z: round6(Math.sin(angle) * radius),
      },
      weight: round6(
        Math.max(0.05, instruction.weight * (0.88 + seededUnit(instruction.seed, `${id}:weight`) * 0.12)),
      ),
    });
  }

  return result;
}

/**
 * Transitional Tree Species -> Organic Growth Lab adapter.
 *
 * The species chooses stable branch intent. This adapter turns that intent into
 * attractor points; the append-only organic Growth Lab still chooses hosts,
 * paths, generations and node topology.
 */
export function treeToOrganicField(
  blueprint: TreeSpeciesBlueprint,
  config: TreeOrganicAdapterConfig = DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG,
): TreeOrganicField {
  const rulesVersion = config.rulesVersion.trim();
  if (!rulesVersion) throw new Error('Tree organic adapter requires a non-empty rulesVersion.');
  const maxAttractors = Math.max(0, Math.floor(config.maxAttractors));
  const attractors: OrganicAttractor[] = [];
  const truncatedInstructionIds: string[] = [];
  let annualAttractorCount = 0;
  let eventAttractorCount = 0;

  for (const instruction of blueprint.growth) {
    const candidates = instructionAttractors(blueprint, instruction);
    const remaining = maxAttractors - attractors.length;
    if (remaining <= 0) {
      truncatedInstructionIds.push(instruction.id);
      continue;
    }
    const accepted = candidates.slice(0, remaining);
    attractors.push(...accepted);
    if (accepted.length < candidates.length) truncatedInstructionIds.push(instruction.id);
    if (instruction.kind === 'annual-bough') annualAttractorCount += accepted.length;
    else eventAttractorCount += accepted.length;
  }

  const structure = blueprint.structure;
  return {
    organicTreeFieldVersion: 1,
    sourceSpeciesBlueprintVersion: `tree:${blueprint.speciesBlueprintVersion}`,
    speciesRulesVersion: blueprint.rulesVersion,
    adapterRulesVersion: rulesVersion,
    seed: structure.seed,
    attractors,
    skeletonConfig: {
      rulesVersion: `${rulesVersion}:${blueprint.rulesVersion}`,
      trunkHeight: structure.trunkHeight,
      trunkStep: structure.trunkStep,
      branchStep: structure.branchStep,
      influenceRadius: round6(structure.crownRadius * 0.96),
      killRadius: round6(structure.branchStep * 0.68),
      maxBranchSegments: Math.max(1, Math.floor(config.maxBranchSegments)),
      maxGeneration: Math.max(1, Math.floor(config.maxGeneration)),
      maxNodes: Math.max(16, Math.floor(config.maxNodes)),
      crownRadius: structure.crownRadius,
      crownHeight: structure.crownHeight,
      upwardBias: structure.upwardBias,
      directionMemory: structure.directionMemory,
      lateralJitter: structure.lateralJitter,
      baseRadius: structure.baseRadius,
      radiusDecay: structure.radiusDecay,
    },
    diagnostics: {
      instructionCount: blueprint.growth.length,
      attractorCount: attractors.length,
      annualAttractorCount,
      eventAttractorCount,
      truncatedInstructionIds,
    },
  };
}
