import { assertValidTimeZone } from './calendar';
import { buildPressureLedger } from './ledger';
import { normalizeEvolutionEvents } from './normalize';
import { artifactSeed } from './seed';
import type { ArtifactBlueprint, BuildArtifactBlueprintInput } from './types';

/**
 * Pure deterministic Evolution Engine entry point.
 *
 * This layer knows nothing about Crystal, Tree or Coral morphology. It only
 * turns relationship history into a stable timeline and pressure blueprint.
 */
export function buildArtifactBlueprint(
  input: BuildArtifactBlueprintInput,
): ArtifactBlueprint {
  const coupleId = input.coupleId.trim();
  const engineVersion = input.config.engineVersion.trim();

  if (!coupleId) throw new Error('Evolution Engine requires a non-empty coupleId.');
  if (!engineVersion) throw new Error('Evolution Engine requires a non-empty engineVersion.');
  assertValidTimeZone(input.config.timeZone);

  const config = {
    ...input.config,
    engineVersion,
  };
  const normalized = normalizeEvolutionEvents(input.events, config);

  return {
    blueprintVersion: 1,
    engineVersion,
    coupleId,
    deterministicSeed: artifactSeed(coupleId, engineVersion),
    relationshipStartedAt: config.relationshipStartedAt,
    timeZone: config.timeZone,
    leapDayPolicy: config.leapDayPolicy,
    events: normalized.events,
    pressureLedger: buildPressureLedger(normalized.events),
    diagnostics: normalized.diagnostics,
  };
}
