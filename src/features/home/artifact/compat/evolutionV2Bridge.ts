import {
  projectCrystalToLegacyPressures,
  type CrystalSpeciesBlueprint,
} from '@/engine/species';
import type { EvolutionPressures } from '../artifactTypes';

/**
 * Typed boundary between the new Evolution/Species pipeline and the current
 * renderer. The renderer keeps consuming its proven legacy pressure contract
 * while all new semantics remain inside Crystal Species.
 *
 * This function is not enabled in production yet. A later scene integration
 * can switch pressure sources without rewriting geometry or materials.
 */
export function bridgeCrystalSpeciesToLegacyPressures(
  crystal: CrystalSpeciesBlueprint,
): EvolutionPressures {
  return projectCrystalToLegacyPressures(crystal);
}
