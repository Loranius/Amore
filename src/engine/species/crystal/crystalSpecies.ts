import { parseEvolutionInstant } from '../../evolution/calendar';
import { buildPressureLedger } from '../../evolution/ledger';
import {
  buildColonies,
  buildCrystalFormations,
  buildMotherInstruction,
  relationshipAgeDays,
} from './formations';
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

  // Adapters normally exclude future facts already, but Species remains safe
  // when called with a hand-built or imported blueprint. Future records may be
  // diagnosed, never allowed to affect today's material or structural state.
  const currentEvents = input.artifact.events.filter((event) => event.occurredAtEpochMs <= asOfEpoch);
  const currentArtifact = currentEvents.length === input.artifact.events.length
    ? input.artifact
    : {
        ...input.artifact,
        events: currentEvents,
        pressureLedger: buildPressureLedger(currentEvents),
      };

  const pressures = buildCrystalPressures(currentArtifact);
  const ageDays = relationshipAgeDays(currentArtifact, asOf);
  const state = buildCrystalState(currentArtifact, ageDays, pressures, asOf);
  // The colony's colour comes from every wish the couple has granted, so the
  // monarch needs the same partner attribution the year crystals get.
  const mother = buildMotherInstruction(
    currentArtifact,
    asOf,
    input.config.colorPartners ?? null,
  );
  // The full artifact, not the filtered one: the formation builders bound
  // themselves by asOf, and diagnostics must still be able to name the facts
  // that lie in the future.
  const { formations, diagnostics } = buildCrystalFormations(input.artifact, asOf, {
    partners: input.config.colorPartners ?? null,
    sharedDaysOff: input.config.sharedDaysOff ?? [],
  });
  const colonies = buildColonies(currentArtifact.deterministicSeed, formations);

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
