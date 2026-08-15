import { stableHash32 } from '../../evolution';
import {
  clamp01,
  daysBetweenExplicit,
  round6,
  seededUnit,
} from './math';

export const REEF_CORE_VERSION = 'reef-core-v1' as const;
export const REEF_CORE_SEED_NAMESPACE = 'amore-reef-v1' as const;
export const REEF_CORE_MAX_YEARS = 50;
export const REEF_CORE_YEAR_DAYS = 365.2425;
export const REEF_CORE_MAX_DAYS = Math.round(REEF_CORE_MAX_YEARS * REEF_CORE_YEAR_DAYS);

export interface ReefCoreInput {
  coupleId: string;
  relationshipStartDate: string;
  daysTogether: number;
}

export interface ReefCoreIdentity {
  coupleId: string;
  relationshipStartDate: string;
  reefSeed: number;
  coreSeed: number;
  platformSeed: number;
  identitySignature: string;
}

export interface ReefCoreAge {
  requestedDaysTogether: number;
  daysTogether: number;
  ageYears: number;
  completedYears: number;
  maxYears: number;
  progress: number;
  growth: number;
}

export interface ReefCoreMorphology {
  phaseA: number;
  phaseB: number;
  ruggedness: number;
  asymmetry: number;
  shoulderBias: number;
  leanX: number;
  leanZ: number;
}

export interface ReefCoreDimensions {
  radiusX: number;
  radiusZ: number;
  height: number;
}

export interface ReefCorePlatform {
  seed: number;
  radiusX: number;
  radiusZ: number;
  thickness: number;
  irregularity: number;
  rotationRadians: number;
}

export interface ReefCoreManifest {
  version: typeof REEF_CORE_VERSION;
  identity: ReefCoreIdentity;
  age: ReefCoreAge;
  morphology: ReefCoreMorphology;
  dimensions: ReefCoreDimensions;
  platform: ReefCorePlatform;
  signature: string;
}

function normalizedIdentityPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Reef Core requires ${label}.`);
  return normalized;
}

function finiteDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(REEF_CORE_MAX_DAYS, Math.floor(value)));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

/**
 * Phase 1 growth intentionally keeps a visible long tail all the way to year 50.
 * The canonical progress is linear; this display curve gives the young reef
 * enough presence without allowing the first few years to consume the mature
 * size budget.
 */
function reefCoreGrowth(progress: number): number {
  const t = clamp01(progress);
  return round6(0.35 * t + 0.65 * Math.sqrt(t));
}

function hex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * Converts two explicit portal dates to the Phase 1 day count. Date parsing is
 * delegated to the accepted Evolution calendar so timezone/date-only behavior
 * stays aligned with the rest of Amore.
 */
export function reefDaysTogether(relationshipStartDate: string, asOf: string): number | null {
  return daysBetweenExplicit(relationshipStartDate, asOf);
}

/**
 * Canonical deterministic source of truth for Reef Phase 1.
 *
 * Identity is permanent and depends only on the couple and relationship start.
 * Age changes dimensions, never the seed. No module data, annual structures,
 * colonies, fish, atmosphere or renderer state is allowed into this manifest.
 */
export function buildReefCore(input: ReefCoreInput): ReefCoreManifest {
  const coupleId = normalizedIdentityPart(input.coupleId, 'coupleId');
  const relationshipStartDate = normalizedIdentityPart(
    input.relationshipStartDate,
    'relationshipStartDate',
  );
  const requestedDaysTogether = Number.isFinite(input.daysTogether)
    ? Math.max(0, Math.floor(input.daysTogether))
    : 0;
  const daysTogether = finiteDays(input.daysTogether);

  // Exact permanent seed contract: hash(coupleId + startDate + namespace).
  const reefSeed = stableHash32(
    `${coupleId}${relationshipStartDate}${REEF_CORE_SEED_NAMESPACE}`,
  );
  // Exact derived seed contract required by Growth System v1.
  const coreSeed = stableHash32(`${reefSeed}:core`);
  const platformSeed = stableHash32(`${reefSeed}:platform`);

  const progress = round6(daysTogether / REEF_CORE_MAX_DAYS);
  const growth = reefCoreGrowth(progress);
  const ageYears = round6(daysTogether / REEF_CORE_YEAR_DAYS);
  const completedYears = Math.min(REEF_CORE_MAX_YEARS, Math.floor(ageYears));

  const widthBias = lerp(0.94, 1.06, seededUnit(coreSeed, 'width-bias'));
  const depthBias = lerp(0.92, 1.08, seededUnit(coreSeed, 'depth-bias'));
  const heightBias = lerp(0.94, 1.06, seededUnit(coreSeed, 'height-bias'));

  const morphology: ReefCoreMorphology = {
    phaseA: round6(seededUnit(coreSeed, 'phase-a') * Math.PI * 2),
    phaseB: round6(seededUnit(coreSeed, 'phase-b') * Math.PI * 2),
    ruggedness: round6(lerp(0.11, 0.18, seededUnit(coreSeed, 'ruggedness'))),
    asymmetry: round6(lerp(-0.08, 0.08, seededUnit(coreSeed, 'asymmetry'))),
    shoulderBias: round6(lerp(0.88, 1.12, seededUnit(coreSeed, 'shoulder-bias'))),
    leanX: round6(lerp(-0.045, 0.045, seededUnit(coreSeed, 'lean-x'))),
    leanZ: round6(lerp(-0.045, 0.045, seededUnit(coreSeed, 'lean-z'))),
  };

  const dimensions: ReefCoreDimensions = {
    radiusX: round6(lerp(0.92, 6.05, growth) * widthBias),
    radiusZ: round6(lerp(0.78, 5.35, growth) * depthBias),
    height: round6(lerp(1.08, 7.45, growth) * heightBias),
  };

  const platformGrowth = round6(0.4 * progress + 0.6 * Math.sqrt(progress));
  const platform: ReefCorePlatform = {
    seed: platformSeed,
    radiusX: round6(lerp(1.55, 8.35, platformGrowth) * lerp(
      0.96,
      1.04,
      seededUnit(platformSeed, 'radius-x'),
    )),
    radiusZ: round6(lerp(1.38, 7.55, platformGrowth) * lerp(
      0.95,
      1.05,
      seededUnit(platformSeed, 'radius-z'),
    )),
    thickness: round6(lerp(0.42, 1.35, platformGrowth)),
    irregularity: round6(lerp(0.055, 0.11, seededUnit(platformSeed, 'irregularity'))),
    rotationRadians: round6(seededUnit(platformSeed, 'rotation') * Math.PI * 2),
  };

  const identitySignature = hex32(stableHash32(
    `${reefSeed}\u001f${coreSeed}\u001f${platformSeed}\u001f${REEF_CORE_VERSION}`,
  ));
  const signature = hex32(stableHash32(
    `${identitySignature}\u001f${daysTogether}\u001f${dimensions.radiusX}\u001f${dimensions.radiusZ}\u001f${dimensions.height}`,
  ));

  return {
    version: REEF_CORE_VERSION,
    identity: {
      coupleId,
      relationshipStartDate,
      reefSeed,
      coreSeed,
      platformSeed,
      identitySignature,
    },
    age: {
      requestedDaysTogether,
      daysTogether,
      ageYears,
      completedYears,
      maxYears: REEF_CORE_MAX_YEARS,
      progress,
      growth,
    },
    morphology,
    dimensions,
    platform,
    signature,
  };
}
