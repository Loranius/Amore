import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import type { ReefAllocatedSurfaceSlot } from './reefSurfaceSlots';

export const REEF_COLONY_COMPETITION_VERSION = 'reef-colony-competition-v1';
export const REEF_COLONY_COMPETITION_PASS = 'chronological-space-competition-and-growth';

export interface ReefColonyCompetitionDiagnostics {
  version: typeof REEF_COLONY_COMPETITION_VERSION;
  colonyCount: number;
  settledColonyCount: number;
  pressuredCount: number;
  redirectedCount: number;
  compressedCount: number;
  heightCompetitionCount: number;
  exclusionCount: number;
  partialOvergrowthCount: number;
  maximumPressure: number;
  averagePressure: number;
}

export interface ReefColonyCompetitionResult {
  plan: ReefLivingCanopyPlan;
  diagnostics: ReefColonyCompetitionDiagnostics;
}

type CompetitionResponse = Readonly<{
  interactionRange: number;
  widthCompression: number;
  heightResponse: number;
  redirectStrength: number;
  exclusionCompression: number;
  permitsOvergrowth: boolean;
}>;

interface SettledColony {
  colony: ReefLivingCanopyColony;
  slot: ReefAllocatedSurfaceSlot;
}

interface CompetitionOutcome {
  colony: ReefLivingCanopyColony;
  pressure: number;
  redirected: boolean;
  compressed: boolean;
  heightCompetition: boolean;
  exclusion: boolean;
  partialOvergrowth: boolean;
}

const TAU = Math.PI * 2;

const RESPONSES: Readonly<Record<ReefColonyMorphotype, CompetitionResponse>> = Object.freeze({
  branching: {
    interactionRange: 2.85,
    widthCompression: 0.28,
    heightResponse: 0.28,
    redirectStrength: 0.92,
    exclusionCompression: 0.14,
    permitsOvergrowth: false,
  },
  massive: {
    interactionRange: 2.35,
    widthCompression: 0.16,
    heightResponse: -0.08,
    redirectStrength: 0.22,
    exclusionCompression: 0.18,
    permitsOvergrowth: false,
  },
  plating: {
    interactionRange: 3.15,
    widthCompression: 0.3,
    heightResponse: 0.18,
    redirectStrength: 0.98,
    exclusionCompression: 0.16,
    permitsOvergrowth: false,
  },
  encrusting: {
    interactionRange: 1.9,
    widthCompression: -0.22,
    heightResponse: -0.18,
    redirectStrength: 0.38,
    exclusionCompression: 0.16,
    permitsOvergrowth: true,
  },
  'soft-coral': {
    interactionRange: 2.45,
    widthCompression: 0.24,
    heightResponse: 0.12,
    redirectStrength: 0.72,
    exclusionCompression: 0.16,
    permitsOvergrowth: false,
  },
  'sea-fan': {
    interactionRange: 3.3,
    widthCompression: 0.32,
    heightResponse: 0.22,
    redirectStrength: 1,
    exclusionCompression: 0.18,
    permitsOvergrowth: false,
  },
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function wrapSignedAngle(value: number): number {
  let wrapped = (value + Math.PI) % TAU;
  if (wrapped < 0) wrapped += TAU;
  return wrapped - Math.PI;
}

function redirectAway(
  original: number,
  current: ReefAllocatedSurfaceSlot,
  neighbor: ReefAllocatedSurfaceSlot,
  amount: number,
): number {
  const away = Math.atan2(
    current.position.z - neighbor.position.z,
    current.position.x - neighbor.position.x,
  );
  return original + wrapSignedAngle(away - original) * clamp(amount, 0, 1);
}

function interactionContribution(
  current: SettledColony,
  older: SettledColony,
  response: CompetitionResponse,
): {
  pressure: number;
  exclusion: number;
  distance: number;
} {
  const distance = Math.hypot(
    current.slot.position.x - older.slot.position.x,
    current.slot.position.z - older.slot.position.z,
  );
  const footprintSum = Math.max(
    0.08,
    current.colony.footprintRadius + older.colony.footprintRadius,
  );
  const interactionDistance = footprintSum * response.interactionRange;
  const normalized = distance / Math.max(0.08, interactionDistance);
  const pressure = Math.pow(clamp(1 - normalized, 0, 1), 1.32);
  const clearanceRatio = distance / footprintSum;
  const exclusion = clamp((0.94 - clearanceRatio) / 0.28, 0, 1);
  return { pressure, exclusion, distance };
}

/**
 * Stage 5 is intentionally chronological: a colony only reacts to neighbors
 * that were already established when it appeared. Appending future portal
 * events therefore cannot resize, redirect or suppress an older colony.
 */
export function applyReefColonyCompetition({
  plan,
  slots,
}: {
  plan: ReefLivingCanopyPlan;
  slots: readonly ReefAllocatedSurfaceSlot[];
}): ReefColonyCompetitionResult {
  const slotByRequestId = new Map(slots.map((slot) => [slot.requestId, slot] as const));
  const ordered = [...plan.colonies].sort((left, right) => (
    left.request.sequence - right.request.sequence
    || left.id.localeCompare(right.id)
  ));
  const settledOlder: SettledColony[] = [];
  const outcomes = new Map<string, CompetitionOutcome>();

  for (const colony of ordered) {
    const slot = slotByRequestId.get(colony.request.id);
    if (!slot) {
      outcomes.set(colony.id, {
        colony,
        pressure: 0,
        redirected: false,
        compressed: false,
        heightCompetition: false,
        exclusion: false,
        partialOvergrowth: false,
      });
      continue;
    }

    const current: SettledColony = { colony, slot };
    const response = RESPONSES[colony.morphotype];
    let accumulatedPressure = 0;
    let strongestExclusion = 0;
    let nearest: SettledColony | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const older of settledOlder) {
      const interaction = interactionContribution(current, older, response);
      accumulatedPressure += interaction.pressure;
      strongestExclusion = Math.max(strongestExclusion, interaction.exclusion);
      if (interaction.distance < nearestDistance) {
        nearestDistance = interaction.distance;
        nearest = older;
      }
    }

    const pressure = clamp(
      accumulatedPressure * 0.76 + strongestExclusion * 0.52,
      0,
      1,
    );
    const meaningfulPressure = pressure > 0.08;
    const exclusion = strongestExclusion > 0.05;
    const partialOvergrowth = response.permitsOvergrowth
      && pressure > 0.12
      && strongestExclusion < 0.78;

    let widthScale = 1 - response.widthCompression * pressure;
    if (response.permitsOvergrowth) {
      widthScale = partialOvergrowth
        ? 1 + Math.min(0.24, pressure * 0.22)
        : 1 - strongestExclusion * response.exclusionCompression;
    } else {
      widthScale -= strongestExclusion * response.exclusionCompression;
    }
    widthScale = clamp(widthScale, 0.56, 1.24);

    const heightScale = clamp(
      1 + response.heightResponse * pressure - strongestExclusion * 0.04,
      0.7,
      1.34,
    );
    const redirectAmount = nearest && meaningfulPressure
      ? pressure * response.redirectStrength
      : 0;
    const facingRad = nearest
      ? redirectAway(colony.facingRad, slot, nearest.slot, redirectAmount)
      : colony.facingRad;

    const nextColony: ReefLivingCanopyColony = {
      ...colony,
      footprintRadius: round6(colony.footprintRadius * widthScale),
      targetHeight: round6(colony.targetHeight * heightScale),
      facingRad: round6(facingRad),
    };
    outcomes.set(colony.id, {
      colony: nextColony,
      pressure: round6(pressure),
      redirected: redirectAmount > 0.04,
      compressed: widthScale < 0.985,
      heightCompetition: Math.abs(heightScale - 1) > 0.02,
      exclusion,
      partialOvergrowth,
    });
    settledOlder.push({ colony: nextColony, slot });
  }

  const colonies = plan.colonies.map((colony) => outcomes.get(colony.id)?.colony ?? colony);
  const renderedOutcomes = colonies.map((colony) => outcomes.get(colony.id)).filter(
    (outcome): outcome is CompetitionOutcome => Boolean(outcome),
  );
  const pressures = renderedOutcomes.map((outcome) => outcome.pressure);
  const pressureTotal = pressures.reduce((sum, pressure) => sum + pressure, 0);
  const diagnostics: ReefColonyCompetitionDiagnostics = {
    version: REEF_COLONY_COMPETITION_VERSION,
    colonyCount: plan.colonies.length,
    settledColonyCount: plan.colonies.filter((colony) => slotByRequestId.has(colony.request.id)).length,
    pressuredCount: renderedOutcomes.filter((outcome) => outcome.pressure > 0.08).length,
    redirectedCount: renderedOutcomes.filter((outcome) => outcome.redirected).length,
    compressedCount: renderedOutcomes.filter((outcome) => outcome.compressed).length,
    heightCompetitionCount: renderedOutcomes.filter((outcome) => outcome.heightCompetition).length,
    exclusionCount: renderedOutcomes.filter((outcome) => outcome.exclusion).length,
    partialOvergrowthCount: renderedOutcomes.filter((outcome) => outcome.partialOvergrowth).length,
    maximumPressure: round6(pressures.length > 0 ? Math.max(...pressures) : 0),
    averagePressure: round6(pressures.length > 0 ? pressureTotal / pressures.length : 0),
  };

  return {
    plan: {
      ...plan,
      colonies,
      // Settlement requests remain immutable after nucleation. Competition only
      // changes visible growth around already accepted surface slots.
      requests: plan.requests,
    },
    diagnostics,
  };
}
