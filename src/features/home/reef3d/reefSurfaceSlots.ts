export const REEF_SURFACE_SLOT_VERSION = 'reef-surface-slots-v3';

const TAU = Math.PI * 2;
const SLOT_SPACING = 0.34;
const CLEARANCE_PASSES = [1, 0.9, 0.82, 0.74] as const;

export interface ReefSurfacePoint {
  x: number;
  y: number;
  z: number;
}

/** Optional ecological metadata gathered while sampling the real reef support. */
export interface ReefSurfaceSample extends ReefSurfacePoint {
  /** World-space upward component of the supporting surface normal. */
  normalY?: number;
  /** Approximate usable support radius when the sampler knows it. */
  supportRadius?: number;
}

export interface ReefSurfaceSlotCandidate {
  id: string;
  x: number;
  z: number;
  /** Exact authored support point, used for shelves that must not be re-raycast. */
  position?: ReefSurfacePoint;
  /** Largest colony footprint that fits fully on this authored support. */
  maxFootprintRadius?: number;
  /** Optional growth epoch that must exist before this support can be used. */
  availableFromEpoch?: number;
  /** Optional known orientation for authored supports. */
  normalY?: number;
  /** Optional approximate free support radius for ecological scoring. */
  supportRadius?: number;
}

export interface ReefSurfaceSlotRequest {
  id: string;
  sequence: number;
  epochIndex?: number;
  preferred: ReefSurfacePoint;
  footprintRadius: number;
}

export interface ReefAllocatedSurfaceSlot {
  requestId: string;
  candidateId: string;
  kind: 'preferred' | 'registry';
  position: ReefSurfacePoint;
  footprintRadius: number;
  clearanceRatio: number;
  displacement: number;
}

export interface ReefSurfaceSlotDiagnostics {
  version: typeof REEF_SURFACE_SLOT_VERSION;
  requestedCount: number;
  registryCandidateCount: number;
  sampledCandidateCount: number;
  allocatedCount: number;
  preferredCount: number;
  relocatedCount: number;
  relaxedCount: number;
  unresolvedRequestIds: string[];
}

export interface ReefSurfaceSlotAllocation {
  slots: ReefAllocatedSurfaceSlot[];
  diagnostics: ReefSurfaceSlotDiagnostics;
}

export type ReefSurfaceSampler = (x: number, z: number) => ReefSurfaceSample | null;

export interface ReefSurfaceScoreCandidate {
  id: string;
  kind: ReefAllocatedSurfaceSlot['kind'];
  position: ReefSurfacePoint;
  availableFromEpoch?: number;
  maxFootprintRadius?: number;
  normalY?: number;
  supportRadius?: number;
}

export interface ReefSurfaceScoreContext {
  candidate: ReefSurfaceScoreCandidate;
  request: ReefSurfaceSlotRequest;
  occupied: readonly ReefAllocatedSurfaceSlot[];
  /** Legacy nearest-preferred score. Lower remains better. */
  baseScore: number;
}

export type ReefSurfaceCandidateScorer = (context: ReefSurfaceScoreContext) => number;

type SampledCandidate = ReefSurfaceScoreCandidate;

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

function pointFromSample(sample: ReefSurfaceSample): ReefSurfacePoint {
  return { x: sample.x, y: sample.y, z: sample.z };
}

/**
 * Creates an absolute, append-only registry. Growing the foundation only adds
 * outer rings; it never moves the slots that already existed closer to the
 * centre.
 */
export function buildReefSurfaceSlotCandidates({
  foundationRadius,
  seed,
}: {
  foundationRadius: number;
  seed: number;
}): ReefSurfaceSlotCandidate[] {
  const usableRadius = Math.max(SLOT_SPACING, foundationRadius * 0.94);
  const ringCount = Math.max(1, Math.floor(usableRadius / SLOT_SPACING));
  const candidates: ReefSurfaceSlotCandidate[] = [
    { id: 'reef:surface-slot:center', x: 0, z: 0 },
  ];

  for (let ring = 1; ring <= ringCount; ring += 1) {
    const radius = ring * SLOT_SPACING;
    const pointCount = Math.max(6, Math.round(TAU * radius / SLOT_SPACING));
    const phase = stableUnit(seed, `reef:surface-slot:ring:${ring}`) * TAU;

    for (let point = 0; point < pointCount; point += 1) {
      const angle = phase + point / pointCount * TAU;
      candidates.push({
        id: `reef:surface-slot:ring:${ring}:point:${point}`,
        x: round6(Math.cos(angle) * radius),
        z: round6(Math.sin(angle) * radius),
      });
    }
  }

  return candidates;
}

function sampleKey(x: number, z: number): string {
  return `${round6(x)}:${round6(z)}`;
}

function canOccupy(
  candidate: SampledCandidate,
  request: ReefSurfaceSlotRequest,
  occupied: readonly ReefAllocatedSurfaceSlot[],
  clearanceRatio: number,
): boolean {
  for (const slot of occupied) {
    const verticalTolerance = Math.max(
      0.28,
      Math.min(0.48, (request.footprintRadius + slot.footprintRadius) * 0.62),
    );
    if (Math.abs(candidate.position.y - slot.position.y) > verticalTolerance) continue;

    const dx = candidate.position.x - slot.position.x;
    const dz = candidate.position.z - slot.position.z;
    const minimumDistance = (request.footprintRadius + slot.footprintRadius)
      * clearanceRatio;
    if (dx * dx + dz * dz < minimumDistance * minimumDistance - 1e-8) return false;
  }

  return true;
}

function baseCandidateScore(
  candidate: SampledCandidate,
  request: ReefSurfaceSlotRequest,
): number {
  const horizontalDistance = Math.hypot(
    candidate.position.x - request.preferred.x,
    candidate.position.z - request.preferred.z,
  );
  const verticalDistance = Math.abs(candidate.position.y - request.preferred.y);
  return horizontalDistance + verticalDistance * 0.14;
}

function scoreCandidate(
  candidate: SampledCandidate,
  request: ReefSurfaceSlotRequest,
  occupied: readonly ReefAllocatedSurfaceSlot[],
  candidateScorer?: ReefSurfaceCandidateScorer,
): number {
  const baseScore = baseCandidateScore(candidate, request);
  if (!candidateScorer) return baseScore;
  const score = candidateScorer({
    candidate,
    request,
    occupied,
    baseScore,
  });
  return Number.isFinite(score) ? score : baseScore;
}

function isAvailableForRequest(
  candidate: SampledCandidate,
  request: ReefSurfaceSlotRequest,
): boolean {
  if (
    candidate.maxFootprintRadius !== undefined
    && request.footprintRadius > candidate.maxFootprintRadius + 1e-8
  ) return false;
  if (candidate.availableFromEpoch === undefined || request.epochIndex === undefined) return true;
  return candidate.availableFromEpoch <= request.epochIndex;
}

/**
 * Assigns one chronological surface slot to every request whenever any sampled
 * support exists. Preferred anchors win first in the legacy path; an optional
 * deterministic scorer can instead rank real supports by ecology while the
 * same collision, epoch, footprint and append-only contracts remain enforced.
 */
export function allocateReefSurfaceSlots({
  requests,
  candidates,
  sample,
  candidateScorer,
}: {
  requests: readonly ReefSurfaceSlotRequest[];
  candidates: readonly ReefSurfaceSlotCandidate[];
  sample: ReefSurfaceSampler;
  candidateScorer?: ReefSurfaceCandidateScorer;
}): ReefSurfaceSlotAllocation {
  const cache = new Map<string, ReefSurfaceSample | null>();
  const sampleAt = (x: number, z: number): ReefSurfaceSample | null => {
    const key = sampleKey(x, z);
    if (cache.has(key)) return cache.get(key) ?? null;
    const result = sample(x, z);
    cache.set(key, result);
    return result;
  };
  const registry = candidates.flatMap<SampledCandidate>((candidate) => {
    const sampled = candidate.position
      ? null
      : sampleAt(candidate.x, candidate.z);
    const position = candidate.position
      ? { ...candidate.position }
      : sampled
        ? pointFromSample(sampled)
        : null;
    const normalY = candidate.normalY ?? sampled?.normalY;
    const supportRadius = candidate.supportRadius ?? sampled?.supportRadius;
    return position
      ? [{
          id: candidate.id,
          kind: 'registry',
          position,
          ...(candidate.availableFromEpoch === undefined
            ? {}
            : { availableFromEpoch: candidate.availableFromEpoch }),
          ...(candidate.maxFootprintRadius === undefined
            ? {}
            : { maxFootprintRadius: candidate.maxFootprintRadius }),
          ...(normalY === undefined ? {} : { normalY }),
          ...(supportRadius === undefined ? {} : { supportRadius }),
        }]
      : [];
  });
  const orderedRequests = [...requests].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
  const slots: ReefAllocatedSurfaceSlot[] = [];
  const unresolvedRequestIds: string[] = [];

  for (const request of orderedRequests) {
    const preferredSample = sampleAt(request.preferred.x, request.preferred.z);
    const options: SampledCandidate[] = preferredSample
      ? [{
          id: `reef:surface-slot:preferred:${request.id}`,
          kind: 'preferred',
          position: pointFromSample(preferredSample),
          ...(preferredSample.normalY === undefined ? {} : { normalY: preferredSample.normalY }),
          ...(preferredSample.supportRadius === undefined
            ? {}
            : { supportRadius: preferredSample.supportRadius }),
        }, ...registry]
      : [...registry];
    const availableOptions = options.filter((candidate) => (
      isAvailableForRequest(candidate, request)
    ));
    availableOptions.sort((left, right) => (
      scoreCandidate(left, request, slots, candidateScorer)
      - scoreCandidate(right, request, slots, candidateScorer)
      || left.id.localeCompare(right.id)
    ));

    let accepted: ReefAllocatedSurfaceSlot | null = null;
    for (const clearanceRatio of CLEARANCE_PASSES) {
      const candidate = availableOptions.find((option) => (
        canOccupy(option, request, slots, clearanceRatio)
      ));
      if (!candidate) continue;

      const displacement = Math.hypot(
        candidate.position.x - request.preferred.x,
        candidate.position.z - request.preferred.z,
      );
      accepted = {
        requestId: request.id,
        candidateId: candidate.id,
        kind: candidate.kind,
        position: { ...candidate.position },
        footprintRadius: request.footprintRadius,
        clearanceRatio,
        displacement: round6(displacement),
      };
      break;
    }

    if (accepted) slots.push(accepted);
    else unresolvedRequestIds.push(request.id);
  }

  const preferredCount = slots.filter((slot) => slot.kind === 'preferred').length;
  const relocatedCount = slots.filter((slot) => slot.displacement > 1e-4).length;
  return {
    slots,
    diagnostics: {
      version: REEF_SURFACE_SLOT_VERSION,
      requestedCount: requests.length,
      registryCandidateCount: candidates.length,
      sampledCandidateCount: registry.length,
      allocatedCount: slots.length,
      preferredCount,
      relocatedCount,
      relaxedCount: slots.filter((slot) => slot.clearanceRatio < 1).length,
      unresolvedRequestIds,
    },
  };
}
