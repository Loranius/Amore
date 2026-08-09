import { buildArtifactBlueprint } from '../engine';
import { adaptCalendarEvents } from './calendar';
import { adaptMapPlaces } from './map';
import { adaptMemories } from './memories';
import { adaptPlans } from './plans';
import { adaptMedia } from './media';
import { EVOLUTION_ADAPTER_RULES_VERSION } from './rules';
import type {
  ArtifactFromSnapshotResult,
  BuildArtifactFromSnapshotInput,
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  EvolutionSourceSnapshot,
} from './types';
import { mergeAdapterResults } from './utils';
import { adaptWishlist } from './wishlist';

export function adaptEvolutionSnapshot(
  snapshot: EvolutionSourceSnapshot,
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  return mergeAdapterResults([
    adaptCalendarEvents(snapshot.calendarEvents, context),
    adaptPlans(snapshot.plans, context),
    adaptWishlist(snapshot.wishlistItems, context),
    adaptMapPlaces(snapshot.mapPlaces, context),
    adaptMemories(snapshot.memories, snapshot.memoryLinks, context),
    adaptMedia(snapshot.media, context),
  ]);
}

export function buildArtifactFromSnapshot(
  input: BuildArtifactFromSnapshotInput,
): ArtifactFromSnapshotResult {
  const context: EvolutionAdapterContext = {
    asOf: input.asOf,
    timeZone: input.engineConfig.timeZone,
    leapDayPolicy: input.engineConfig.leapDayPolicy,
    rulesVersion: EVOLUTION_ADAPTER_RULES_VERSION,
  };
  const adapted = adaptEvolutionSnapshot(input.snapshot, context);

  return {
    blueprint: buildArtifactBlueprint({
      coupleId: input.coupleId,
      config: input.engineConfig,
      events: adapted.events,
    }),
    adapterRulesVersion: EVOLUTION_ADAPTER_RULES_VERSION,
    adapterDiagnostics: adapted.diagnostics,
  };
}
