import { parseEvolutionInstant } from '../../evolution/calendar';
import { buildColonies, buildEventFormations, buildMotherInstruction, relationshipAgeDays } from './formations';
import { buildCrystalPressures, buildCrystalState } from './pressures';
import type {
  BuildCrystalSpeciesBlueprintInput,
  CrystalSpeciesBlueprint,
} from './types';

/**
 * Pure Crystal Species entry point.
 *
 * It translates a species-neutral ArtifactBlueprint into crystal morphology
 * instructions. It never imports React, Three.js, Supabase, geometry or UI.
 */
export function buildCrystalSpeciesBlueprint(
  input: BuildCrystalSpeciesBlueprintInput,
): CrystalSpeciesBlueprint {
  const rulesVersion = input.config.rulesVersion.trim();
  if (!rulesVersion) throw new Error('Crystal Species requires a non-empty rulesVersion.');

  const asOfEpoch = parseEvolutionInstant(input.config.asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Crystal Species asOf: "${input.config.asOf}".`);
  const asOf = new Date(asOfEpoch).toISOString();

  const pressures = buildCrystalPressures(input.artifact);
  const ageDays = relationshipAgeDays(input.artifact, asOf);
  const state = buildCrystalState(input.artifact, ageDays, pressures);
  const mother = buildMotherInstruction(input.artifact, asOf);
  const { formations, diagnostics } = buildEventFormations(input.artifact, asOf);
  const colonies = buildColonies(input.artifact.deterministicSeed, formations);

  return {
    speciesBlueprintVersion: 1,
    species: 'crystal',
    rulesVersion,
    sourceBlueprintVersion: input.artifact.blueprintVersion,
    engineVersion: input.artifact.engineVersion,
    coupleId: input.artifact.coupleId,
    artifactSeed: input.artifact.deterministicSeed,
    asOf,
    pressures,
    state,
    mother,
    formations,
    colonies,
    diagnostics,
  };
}
