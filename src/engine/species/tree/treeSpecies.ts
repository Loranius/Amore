import { parseEvolutionInstant } from '../../evolution/calendar';
import { buildPressureLedger } from '../../evolution/ledger';
import { buildTreeGrowthInstructions, buildTreeStructure } from './instructions';
import { buildTreePressures, buildTreeState } from './pressures';
import type {
  BuildTreeSpeciesBlueprintInput,
  TreeSpeciesBlueprint,
} from './types';

/**
 * Pure Tree Species entry point.
 *
 * It translates a species-neutral ArtifactBlueprint into stable tree growth
 * intent. It never imports React, Three.js, Supabase, geometry or UI.
 */
export function buildTreeSpeciesBlueprint(
  input: BuildTreeSpeciesBlueprintInput,
): TreeSpeciesBlueprint {
  const rulesVersion = input.config.rulesVersion.trim();
  if (!rulesVersion) throw new Error('Tree Species requires a non-empty rulesVersion.');

  const asOfEpoch = parseEvolutionInstant(input.config.asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Tree Species asOf: "${input.config.asOf}".`);
  const asOf = new Date(asOfEpoch).toISOString();

  const currentEvents = input.artifact.events.filter(
    (event) => event.occurredAtEpochMs <= asOfEpoch,
  );
  const currentArtifact = currentEvents.length === input.artifact.events.length
    ? input.artifact
    : {
        ...input.artifact,
        events: currentEvents,
        pressureLedger: buildPressureLedger(currentEvents),
      };

  const pressures = buildTreePressures(currentArtifact);
  const state = buildTreeState(currentArtifact, asOf, pressures);
  const structure = buildTreeStructure(input.artifact.deterministicSeed);
  /*
   * Роки рахує спільна модель (`species/shared`), тож дереву треба
   * правило високосного дня артефакту, а не власний лічильник років.
   * Доти дерево мало третій власний закон року — і саме такі копії
   * спільний шар і збирає докупи.
   */
  const { growth, diagnostics } = buildTreeGrowthInstructions(
    input.artifact,
    asOf,
    input.artifact.leapDayPolicy,
  );

  return {
    speciesBlueprintVersion: 1,
    species: 'tree',
    rulesVersion,
    sourceBlueprintVersion: input.artifact.blueprintVersion,
    engineVersion: input.artifact.engineVersion,
    coupleId: input.artifact.coupleId,
    artifactSeed: input.artifact.deterministicSeed,
    asOf,
    pressures,
    state,
    structure,
    growth,
    diagnostics,
  };
}
