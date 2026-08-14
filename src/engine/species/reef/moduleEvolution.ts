import type { ArtifactBlueprint, NormalizedEvolutionEvent } from '../../evolution';
import { clamp01, round6, saturate, seededUnit, stableSeed } from './math';
import {
  REEF_ANNUAL_STRUCTURE_ARCHETYPES,
  REEF_EVENT_SOURCE_MODULES,
} from './types';
import type {
  ReefAnnualStructureArchetype,
  ReefAnnualZone,
  ReefColonizationPatch,
  ReefEventSourceModule,
  ReefFishIdentity,
  ReefHardCoralIdentity,
  ReefInfluenceSource,
  ReefModuleEvolutionEntities,
  ReefModuleEvolutionEntity,
  ReefModuleEvolutionEntityKind,
  ReefModuleEvolutionPlan,
  ReefModulePopulation,
  ReefSoftLifeArchetype,
  ReefSoftLifePool,
  ReefWishSizeClass,
} from './types';

const EVENT_SOURCE_SET = new Set<string>(REEF_EVENT_SOURCE_MODULES);
const MAXIMUM_SUBSTRATE_RADIUS = 6.4;
const PORTAL_MODULE_COUNT = REEF_EVENT_SOURCE_MODULES.length;
const YEAR_DEPTH_CONSTANT = 12;
const SHARED_DAYS_OFF_FULL_YEAR = 60;
const TOGETHERNESS_LIFT = 0.5;
const QUIET_YEAR_FLOOR = 0.3;
const MONTHLY_GROWTH_STEPS = 12;
const DAYS_PER_YEAR = 365.2425;
const EVENT_MATURITY_HALF_SATURATION_DAYS = DAYS_PER_YEAR * 2;
const ZONE_MATURITY_HALF_SATURATION_YEARS = 2.5;

const VISIBLE_LIMITS = Object.freeze({
  arches: 12,
  planFish: 24,
  wishCorals: 48,
  photoCorals: 24,
  mediaCorals: 24,
  mapOutcrops: 16,
  calendarLandmarks: 16,
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
  return populationWithVisible(logicalCount, visibleCount);
}

function populationWithVisible(logicalCount: number, visibleCount: number): ReefModulePopulation {
  const boundedVisible = Math.max(0, Math.min(logicalCount, visibleCount));
  return {
    logicalCount,
    visibleCount: boundedVisible,
    overflowCount: logicalCount - boundedVisible,
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

function allAcceptedEvents(
  byModule: Map<ReefEventSourceModule, NormalizedEvolutionEvent[]>,
): NormalizedEvolutionEvent[] {
  return REEF_EVENT_SOURCE_MODULES
    .flatMap((module) => byModule.get(module) ?? [])
    .sort((left, right) => (
      left.occurredAtEpochMs - right.occurredAtEpochMs || left.id.localeCompare(right.id)
    ));
}

function currentYearProgress(ageDays: number, completedYears: number): { progress: number; stage: number } {
  const elapsedCurrentYearDays = Math.max(0, ageDays - completedYears * DAYS_PER_YEAR);
  const rawProgress = clamp01(elapsedCurrentYearDays / DAYS_PER_YEAR);
  if (rawProgress <= 0) return { progress: 0, stage: 0 };
  const stage = Math.min(MONTHLY_GROWTH_STEPS, Math.max(1, Math.ceil(rawProgress * MONTHLY_GROWTH_STEPS)));
  return { progress: round6(stage / MONTHLY_GROWTH_STEPS), stage };
}

function yearActivity(moduleCount: number, eventCount: number): number {
  const breadth = clamp01(moduleCount / PORTAL_MODULE_COUNT);
  const depth = eventCount <= 0 ? 0 : eventCount / (eventCount + YEAR_DEPTH_CONSTANT);
  return round6(clamp01(0.6 * breadth + 0.4 * depth));
}

function yearTogetherness(sharedDaysOff: number): number {
  return round6(clamp01(sharedDaysOff / SHARED_DAYS_OFF_FULL_YEAR));
}

function yearFill(progress: number, activity: number, togetherness: number): number {
  const lived = activity + (1 - activity) * TOGETHERNESS_LIFT * togetherness;
  return round6(clamp01(progress * (QUIET_YEAR_FLOOR + (1 - QUIET_YEAR_FLOOR) * lived)));
}

function annualArchetype(
  identitySeed: number,
  epochIndex: number,
): ReefAnnualStructureArchetype {
  if (epochIndex === 0) return 'core';
  const choices = REEF_ANNUAL_STRUCTURE_ARCHETYPES.filter((value) => value !== 'core');
  const pick = Math.floor(seededUnit(identitySeed, `annual-archetype:${epochIndex}`) * choices.length);
  return choices[Math.min(choices.length - 1, pick)] ?? 'terrace';
}

function eventMaturity(event: NormalizedEvolutionEvent, asOfEpochMs: number): number {
  const ageDays = Math.max(0, (asOfEpochMs - event.occurredAtEpochMs) / 86_400_000);
  return round6(saturate(ageDays, EVENT_MATURITY_HALF_SATURATION_DAYS));
}

function zoneMaturity(ageDays: number, epochIndex: number): number {
  const zoneAgeYears = Math.max(0, ageDays / DAYS_PER_YEAR - epochIndex);
  return round6(saturate(zoneAgeYears, ZONE_MATURITY_HALF_SATURATION_YEARS));
}

function wishImportance(event: NormalizedEvolutionEvent): number {
  return round6(clamp01(
    event.channels.significance * 0.58
      + event.channels.achievement * 0.32
      + event.portalActivity * 0.1,
  ));
}

function wishSizeClass(importance: number): ReefWishSizeClass {
  if (importance >= 0.62) return 'high';
  if (importance >= 0.34) return 'medium';
  return 'low';
}

function softLifeArchetypes(itemCount: number): ReefSoftLifeArchetype[] {
  const unlocked: ReefSoftLifeArchetype[] = [];
  if (itemCount >= 1) unlocked.push('soft-cluster');
  if (itemCount >= 3) unlocked.push('sea-fan');
  if (itemCount >= 8) unlocked.push('anemone');
  if (itemCount >= 20) unlocked.push('sponge');
  if (itemCount >= 50) unlocked.push('feather-colony');
  return unlocked;
}

function uniqueSharedMonths(days: readonly ReefModuleEvolutionScheduleDay[]): number {
  return new Set(days.map((day) => day.date.slice(0, 7))).size;
}

function groupedMapEntities(
  artifactSeed: number,
  places: readonly NormalizedEvolutionEvent[],
): ReefModuleEvolutionEntity[] {
  const byEpoch = new Map<number, NormalizedEvolutionEvent[]>();
  for (const place of places) {
    const list = byEpoch.get(place.epochIndex) ?? [];
    list.push(place);
    byEpoch.set(place.epochIndex, list);
  }

  const result: ReefModuleEvolutionEntity[] = [];
  for (const [epochIndex, values] of [...byEpoch.entries()].sort(([left], [right]) => left - right)) {
    const clusterCount = Math.min(3, Math.ceil(values.length / 4));
    for (let group = 0; group < clusterCount; group += 1) {
      const sourceKey = `zone-${epochIndex + 1}-cluster-${group + 1}`;
      result.push(entity(
        artifactSeed,
        'map-outcrop',
        'map',
        null,
        sourceKey,
        epochIndex,
        (epochIndex + 1) * 1_000 + group * 10 + 6,
      ));
    }
  }
  return sortEntities(result);
}

function buildAnnualZones(
  input: BuildReefModuleEvolutionInput,
  events: readonly NormalizedEvolutionEvent[],
  identitySeed: number,
): ReefAnnualZone[] {
  const current = currentYearProgress(input.ageDays, input.completedYears);
  const zoneCount = Math.max(1, input.completedYears + 1);

  return Array.from({ length: zoneCount }, (_value, epochIndex) => {
    const zoneEvents = events.filter((event) => event.epochIndex === epochIndex);
    const modules = REEF_EVENT_SOURCE_MODULES.filter((module) => (
      zoneEvents.some((event) => sourceModuleFor(event.source) === module)
    ));
    const sharedDays = input.sharedDaysOff.filter((day) => day.epochIndex === epochIndex).length;
    const progress = epochIndex < input.completedYears ? 1 : current.progress;
    const activity = yearActivity(modules.length, zoneEvents.length);
    const togetherness = yearTogetherness(sharedDays);
    const fill = yearFill(progress, activity, togetherness);
    const photoCount = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'memories').length;
    const wishCount = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'wishlist').length;
    const planCount = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'plans').length;
    const placeCount = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'map').length;
    const mediaCount = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'media').length;
    const calendarEvents = zoneEvents.filter((event) => sourceModuleFor(event.source) === 'calendar');
    const memoryContribution = saturate(photoCount, 18);
    const hardCoralContribution = saturate(wishCount, 4);
    const softLifeContribution = saturate(mediaCount, 10);
    const mapExpansion = saturate(placeCount, 5);
    const biodiversity = round6(clamp01(
      0.8 * (modules.length / PORTAL_MODULE_COUNT)
        + 0.2 * saturate(zoneEvents.length, 18),
    ));
    const colonization = round6(clamp01(
      progress * 0.08
        + fill * 0.42
        + memoryContribution * 0.22
        + hardCoralContribution * 0.16
        + softLifeContribution * 0.08
        + biodiversity * 0.04,
    ));
    const cohesion = round6(clamp01(
      togetherness * 0.62 + fill * 0.25 + memoryContribution * 0.13,
    ));
    const capacity = round6(
      (36 + epochIndex * 4 + progress * 42) * (1 + mapExpansion * 0.5),
    );

    return {
      id: `reef:annual-zone:${epochIndex + 1}`,
      yearIndex: epochIndex + 1,
      epochIndex,
      complete: epochIndex < input.completedYears,
      progress,
      growthStage: epochIndex < input.completedYears ? MONTHLY_GROWTH_STEPS : current.stage,
      activity,
      togetherness,
      fill,
      biodiversity,
      colonization,
      cohesion,
      maturity: zoneMaturity(input.ageDays, epochIndex),
      capacity,
      usedCapacity: round6(capacity * colonization),
      structureArchetype: annualArchetype(identitySeed, epochIndex),
      structureSeed: stableSeed(identitySeed, `annual-zone:${epochIndex}`),
      eventCount: zoneEvents.length,
      moduleCount: modules.length,
      modules,
      photoCount,
      wishCount,
      planCount,
      placeCount,
      mediaCount,
      anniversaryCount: calendarEvents.length,
      milestone: calendarEvents.some((event) => event.channels.significance >= 0.9),
      mapExpansion: round6(mapExpansion),
    };
  });
}

function weightedZoneAverage(
  zones: readonly ReefAnnualZone[],
  pick: (zone: ReefAnnualZone) => number,
): number {
  if (zones.length === 0) return 0;
  const totalWeight = zones.reduce((sum, zone) => sum + Math.max(0.1, zone.progress), 0);
  if (totalWeight <= 0) return 0;
  return round6(zones.reduce(
    (sum, zone) => sum + pick(zone) * Math.max(0.1, zone.progress),
    0,
  ) / totalWeight);
}

/**
 * Builds the renderer-independent, reef-only meaning of accepted portal facts.
 * Time opens habitat; annual zones shape it; activity colonises it. High-volume
 * sources are clustered so logical history never becomes a one-mesh-per-row tax.
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
  const identitySeed = stableSeed(artifactSeed, 'reef:module-evolution');
  const events = acceptedEvents(input.artifact, input.asOfEpochMs);
  const accepted = allAcceptedEvents(events);
  const plans = events.get('plans') ?? [];
  const wishes = events.get('wishlist') ?? [];
  const photos = events.get('memories') ?? [];
  const media = events.get('media') ?? [];
  const places = events.get('map') ?? [];
  const calendar = events.get('calendar') ?? [];

  const annualZones = buildAnnualZones(input, accepted, identitySeed);
  const colonizationPatches: ReefColonizationPatch[] = annualZones
    .filter((zone) => zone.photoCount > 0)
    .map((zone) => ({
      id: `reef:micro-coverage:year-${zone.yearIndex}`,
      yearIndex: zone.yearIndex,
      epochIndex: zone.epochIndex,
      photoCount: zone.photoCount,
      contribution: round6(saturate(zone.photoCount, 18)),
      density: round6(clamp01(saturate(zone.photoCount, 18) * (0.45 + zone.fill * 0.55))),
      seed: stableSeed(identitySeed, `micro-coverage:${zone.epochIndex}`),
    }));

  const hardCorals: ReefHardCoralIdentity[] = wishes.map((event) => {
    const importance = wishImportance(event);
    const maturity = eventMaturity(event, input.asOfEpochMs);
    const sizeClass = wishSizeClass(importance);
    return {
      id: `reef:hard-coral:${event.id}`,
      sourceEventId: event.id,
      yearIndex: event.epochIndex + 1,
      epochIndex: event.epochIndex,
      occurredAtEpochMs: event.occurredAtEpochMs,
      maturity,
      importance,
      sizeClass,
      maximumScale: round6(0.72 + importance * 0.98),
      growth: round6(clamp01(0.18 + maturity * 0.82)),
      seed: stableSeed(identitySeed, `hard-coral:${event.id}`),
    };
  });

  const fishPopulation: ReefFishIdentity[] = plans.map((event) => ({
    id: `reef:fish:${event.id}`,
    sourceEventId: event.id,
    yearIndex: event.epochIndex + 1,
    epochIndex: event.epochIndex,
    occurredAtEpochMs: event.occurredAtEpochMs,
    seed: stableSeed(identitySeed, `fish:${event.id}`),
  }));

  const softLifePools: ReefSoftLifePool[] = annualZones
    .filter((zone) => zone.mediaCount > 0)
    .map((zone) => {
      const unlockedArchetypes = softLifeArchetypes(zone.mediaCount);
      return {
        id: `reef:soft-life:year-${zone.yearIndex}`,
        yearIndex: zone.yearIndex,
        epochIndex: zone.epochIndex,
        itemCount: zone.mediaCount,
        diversity: round6(clamp01(unlockedArchetypes.length / 5)),
        density: round6(saturate(zone.mediaCount, 10)),
        unlockedArchetypes,
        seed: stableSeed(identitySeed, `soft-life:${zone.epochIndex}`),
      };
    });

  // The available top-surface area grows linearly with relationship days.
  // Radius is derived from area, so time controls global habitat scale while
  // visited places only add horizontal reach and capacity.
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
  const mapReach = round6(Math.min(2.1, Math.sqrt(places.length) * 0.34));

  const clusteredMapOutcrops = groupedMapEntities(artifactSeed, places);
  const legacyYearArches = annualZones
    .filter((zone) => zone.structureArchetype === 'arch' && zone.progress > 0)
    .map((zone) => entity(
      artifactSeed,
      'year-arch',
      'relationship',
      null,
      String(zone.yearIndex),
      zone.epochIndex,
      zone.yearIndex * 10,
    ));
  const legacyPhotoPatches = colonizationPatches.map((patch) => entity(
    artifactSeed,
    'photo-coral',
    'memories',
    null,
    `year-${patch.yearIndex}`,
    patch.epochIndex,
    patch.yearIndex * 1_000 + 3,
  ));
  const legacyMediaPools = softLifePools.map((pool) => entity(
    artifactSeed,
    'media-coral',
    'media',
    null,
    `year-${pool.yearIndex}`,
    pool.epochIndex,
    pool.yearIndex * 1_000 + 5,
  ));

  const entities: ReefModuleEvolutionEntities = {
    yearArches: legacyYearArches,
    planFish: sortEntities(plans.map((event) => (
      eventEntity(artifactSeed, 'plan-fish', 'plans', event)
    ))),
    wishCorals: sortEntities(wishes.map((event) => (
      eventEntity(artifactSeed, 'wish-coral', 'wishlist', event)
    ))),
    photoCorals: sortEntities(legacyPhotoPatches),
    mediaCorals: sortEntities(legacyMediaPools),
    mapOutcrops: clusteredMapOutcrops,
    calendarLandmarks: sortEntities(calendar.map((event) => (
      eventEntity(artifactSeed, 'calendar-landmark', 'calendar', event)
    ))),
    // Schedule is a cohesion/togetherness signal, never a spawned structure.
    scheduleTerraces: [],
  };

  const logicalFishPopulation = fishPopulation.length;
  const visibleFishPopulation = logicalFishPopulation === 0
    ? 0
    : Math.min(
      VISIBLE_LIMITS.planFish,
      Math.max(4, Math.ceil(4 + Math.sqrt(logicalFishPopulation) * 4)),
    );
  const habitatCapacity = round6(annualZones.reduce((sum, zone) => sum + zone.capacity, 0));
  const usedCapacity = round6(annualZones.reduce((sum, zone) => sum + zone.usedCapacity, 0));

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
      sharedDaysOffMonthCount: uniqueSharedMonths(input.sharedDaysOff),
    },
    development: {
      annualZones,
      colonizationPatches,
      hardCorals,
      fishPopulation,
      softLifePools,
      ecology: {
        foundationScale: radialSaturation,
        foundationSpread: round6(substrateRadius + mapReach),
        structuralComplexity: round6(clamp01(
          saturate(annualZones.length, 8) * 0.55
            + saturate(places.length, 12) * 0.25
            + weightedZoneAverage(annualZones, (zone) => zone.biodiversity) * 0.2,
        )),
        colonization: weightedZoneAverage(annualZones, (zone) => zone.colonization),
        biodiversity: weightedZoneAverage(annualZones, (zone) => zone.biodiversity),
        cohesion: weightedZoneAverage(annualZones, (zone) => zone.cohesion),
        maturity: weightedZoneAverage(annualZones, (zone) => zone.maturity),
        habitatCapacity,
        usedCapacity,
        logicalFishPopulation,
        visibleFishPopulation,
      },
    },
    foundation: {
      seedRadius,
      dailySurfaceAreaGain,
      chronologicalSurfaceArea,
      substrateRadius,
      maximumSubstrateRadius: MAXIMUM_SUBSTRATE_RADIUS,
      outerGrowthRadius: round6(substrateRadius + mapReach),
      radialSaturation,
      arches: population(legacyYearArches.length, VISIBLE_LIMITS.arches),
      satelliteOutcrops: population(clusteredMapOutcrops.length, VISIBLE_LIMITS.mapOutcrops),
      scheduleTerraces: populationWithVisible(0, 0),
    },
    colonies: {
      primaryWishCorals: population(wishes.length, VISIBLE_LIMITS.wishCorals),
      microPhotoCorals: populationWithVisible(photos.length, legacyPhotoPatches.length),
      mediaCorals: populationWithVisible(media.length, legacyMediaPools.length),
      calendarLandmarks: population(calendar.length, VISIBLE_LIMITS.calendarLandmarks),
      minimumClearanceRatio: 2.15,
    },
    life: {
      planFish: populationWithVisible(logicalFishPopulation, visibleFishPopulation),
    },
    entities,
  };
}
