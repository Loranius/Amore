import type { ArtifactBlueprint, NormalizedEvolutionEvent } from '../../evolution';
import { clamp01, round6, seededUnit, stableSeed } from './math';
import { REEF_EVENT_SOURCE_MODULES } from './types';
import type {
  ReefEventSourceModule,
  ReefInfluenceSource,
  ReefModuleEvolutionEntities,
  ReefModuleEvolutionEntity,
  ReefModuleEvolutionEntityKind,
  ReefModuleEvolutionPlan,
  ReefModulePopulation,
} from './types';

const EVENT_SOURCE_SET = new Set<string>(REEF_EVENT_SOURCE_MODULES);
const MAXIMUM_SUBSTRATE_RADIUS = 6.4;

const VISIBLE_LIMITS = Object.freeze({
  arches: 12,
  planFish: 24,
  wishCorals: 48,
  photoCorals: 96,
  mediaCorals: 48,
  mapOutcrops: 16,
  calendarLandmarks: 16,
  scheduleTerraces: 16,
});

export interface ReefModuleEvolutionScheduleDay {
  date: string;
  epochIndex: number;
}

export interface BuildReefModuleEvolutionInput {
  artifact: ArtifactBlueprint;
  asOfEpochMs: number;
  ageDays: number;
  completedYears: number;
  sharedDaysOff: readonly ReefModuleEvolutionScheduleDay[];
}

function sourceModuleFor(source: string): ReefEventSourceModule | null {
  const module = source.split('@', 1)[0]?.trim() ?? '';
  return EVENT_SOURCE_SET.has(module) ? module as ReefEventSourceModule : null;
}

function population(logicalCount: number, maximumVisible: number): ReefModulePopulation {
  const visibleCount = Math.min(logicalCount, maximumVisible);
  return {
    logicalCount,
    visibleCount,
    overflowCount: logicalCount - visibleCount,
  };
}

function entity(
  artifactSeed: number,
  kind: ReefModuleEvolutionEntityKind,
  sourceModule: ReefInfluenceSource,
  sourceEventId: string | null,
  sourceKey: string,
  epochIndex: number,
  sequence: number,
): ReefModuleEvolutionEntity {
  const id = `reef:${kind}:${sourceKey}`;
  return {
    id,
    kind,
    sourceModule,
    sourceEventId,
    sourceKey,
    epochIndex,
    sequence,
    seed: stableSeed(artifactSeed, id),
  };
}

function eventEntity(
  artifactSeed: number,
  kind: ReefModuleEvolutionEntityKind,
  sourceModule: ReefEventSourceModule,
  event: NormalizedEvolutionEvent,
): ReefModuleEvolutionEntity {
  return entity(
    artifactSeed,
    kind,
    sourceModule,
    event.id,
    event.id,
    event.epochIndex,
    event.occurredAtEpochMs * 10 + 7,
  );
}

function sortEntities(values: ReefModuleEvolutionEntity[]): ReefModuleEvolutionEntity[] {
  return values.sort((left, right) => (
    left.sequence - right.sequence || left.id.localeCompare(right.id)
  ));
}

function acceptedEvents(
  artifact: ArtifactBlueprint,
  asOfEpochMs: number,
): Map<ReefEventSourceModule, NormalizedEvolutionEvent[]> {
  const byModule = new Map<ReefEventSourceModule, NormalizedEvolutionEvent[]>(
    REEF_EVENT_SOURCE_MODULES.map((module) => [module, []]),
  );

  for (const event of artifact.events) {
    const sourceModule = sourceModuleFor(event.source);
    if (!sourceModule || event.occurredAtEpochMs > asOfEpochMs) continue;
    byModule.get(sourceModule)?.push(event);
  }
  for (const events of byModule.values()) {
    events.sort((left, right) => (
      left.occurredAtEpochMs - right.occurredAtEpochMs || left.id.localeCompare(right.id)
    ));
  }
  return byModule;
}

function buildScheduleTerraces(
  artifactSeed: number,
  days: readonly ReefModuleEvolutionScheduleDay[],
): ReefModuleEvolutionEntity[] {
  const firstDayByMonth = new Map<string, ReefModuleEvolutionScheduleDay>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    const previous = firstDayByMonth.get(month);
    if (!previous || day.date < previous.date) firstDayByMonth.set(month, day);
  }

  return [...firstDayByMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, day]) => entity(
      artifactSeed,
      'schedule-terrace',
      'schedule',
      null,
      month,
      day.epochIndex,
      Date.parse(`${month}-01T00:00:00.000Z`) * 10 + 4,
    ));
}

/**
 * Builds the renderer-independent, reef-only meaning of every accepted module.
 * The returned identities are append-only: later facts never reseed old forms.
 */
export function buildReefModuleEvolution(
  input: BuildReefModuleEvolutionInput,
): ReefModuleEvolutionPlan {
  if (!Number.isFinite(input.asOfEpochMs)) {
    throw new Error('Reef Module Evolution requires a finite asOfEpochMs.');
  }
  if (!Number.isInteger(input.ageDays) || input.ageDays < 0) {
    throw new Error('Reef Module Evolution requires non-negative integer ageDays.');
  }
  if (!Number.isInteger(input.completedYears) || input.completedYears < 0) {
    throw new Error('Reef Module Evolution requires non-negative integer completedYears.');
  }

  const artifactSeed = input.artifact.deterministicSeed;
  const events = acceptedEvents(input.artifact, input.asOfEpochMs);
  const plans = events.get('plans') ?? [];
  const wishes = events.get('wishlist') ?? [];
  const photos = events.get('memories') ?? [];
  const media = events.get('media') ?? [];
  const places = events.get('map') ?? [];
  const calendar = events.get('calendar') ?? [];
  const scheduleTerraces = buildScheduleTerraces(artifactSeed, input.sharedDaysOff);

  const yearArches = Array.from({ length: input.completedYears }, (_value, index) => {
    const yearIndex = index + 1;
    return entity(
      artifactSeed,
      'year-arch',
      'relationship',
      null,
      String(yearIndex),
      yearIndex,
      yearIndex * 10,
    );
  });

  const entities: ReefModuleEvolutionEntities = {
    yearArches,
    planFish: sortEntities(plans.map((event) => (
      eventEntity(artifactSeed, 'plan-fish', 'plans', event)
    ))),
    wishCorals: sortEntities(wishes.map((event) => (
      eventEntity(artifactSeed, 'wish-coral', 'wishlist', event)
    ))),
    photoCorals: sortEntities(photos.map((event) => (
      eventEntity(artifactSeed, 'photo-coral', 'memories', event)
    ))),
    mediaCorals: sortEntities(media.map((event) => (
      eventEntity(artifactSeed, 'media-coral', 'media', event)
    ))),
    mapOutcrops: sortEntities(places.map((event) => (
      eventEntity(artifactSeed, 'map-outcrop', 'map', event)
    ))),
    calendarLandmarks: sortEntities(calendar.map((event) => (
      eventEntity(artifactSeed, 'calendar-landmark', 'calendar', event)
    ))),
    scheduleTerraces,
  };

  // The available top-surface area grows linearly with relationship days.
  // Radius is derived from that area, so the visual never receives a fake
  // linear radius that would make area grow quadratically.
  const identitySeed = stableSeed(artifactSeed, 'reef:module-evolution');
  const seedRadius = round6(2.18 + seededUnit(identitySeed, 'seed-radius') * 0.22);
  const dailySurfaceAreaGain = round6(
    0.0124 + seededUnit(identitySeed, 'daily-surface-area') * 0.0018,
  );
  const chronologicalSurfaceArea = round6(
    Math.PI * seedRadius * seedRadius + input.ageDays * dailySurfaceAreaGain,
  );
  const chronologicalRadius = Math.sqrt(chronologicalSurfaceArea / Math.PI);
  const substrateRadius = round6(Math.min(MAXIMUM_SUBSTRATE_RADIUS, chronologicalRadius));
  const radialSaturation = round6(clamp01(
    (chronologicalRadius - seedRadius) / (MAXIMUM_SUBSTRATE_RADIUS - seedRadius),
  ));
  const mapReach = Math.min(2.1, Math.sqrt(places.length) * 0.34);

  return {
    version: 'reef-module-evolution-v1',
    identitySeed,
    facts: {
      daysTogether: input.ageDays,
      completedYears: input.completedYears,
      completedPlans: plans.length,
      completedWishes: wishes.length,
      photoCount: photos.length,
      finishedMediaCount: media.length,
      visitedPlaceCount: places.length,
      calendarLandmarkCount: calendar.length,
      sharedDaysOffCount: input.sharedDaysOff.length,
      sharedDaysOffMonthCount: scheduleTerraces.length,
    },
    foundation: {
      seedRadius,
      dailySurfaceAreaGain,
      chronologicalSurfaceArea,
      substrateRadius,
      maximumSubstrateRadius: MAXIMUM_SUBSTRATE_RADIUS,
      outerGrowthRadius: round6(substrateRadius + mapReach),
      radialSaturation,
      arches: population(yearArches.length, VISIBLE_LIMITS.arches),
      satelliteOutcrops: population(places.length, VISIBLE_LIMITS.mapOutcrops),
      scheduleTerraces: population(scheduleTerraces.length, VISIBLE_LIMITS.scheduleTerraces),
    },
    colonies: {
      primaryWishCorals: population(wishes.length, VISIBLE_LIMITS.wishCorals),
      microPhotoCorals: population(photos.length, VISIBLE_LIMITS.photoCorals),
      mediaCorals: population(media.length, VISIBLE_LIMITS.mediaCorals),
      calendarLandmarks: population(calendar.length, VISIBLE_LIMITS.calendarLandmarks),
      minimumClearanceRatio: 1.18,
    },
    life: {
      planFish: population(plans.length, VISIBLE_LIMITS.planFish),
    },
    entities,
  };
}
