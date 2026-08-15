export const REEF_SURFACE_SLOT_VERSION = 'reef-surface-slots-v3';

const TAU = Math.PI * 2;
const SLOT_SPACING = 0.34;
const REQUEST_AWARE_CANDIDATE_LIMIT = 64;
const CLEARANCE_PASSES = [1, 0.9, 0.82, 0.74] as const;

export interface ReefSurfacePoint {
  x: number;
  y: number;
  z: number;
}

export interface ReefSurfaceSlotCandidate {
  id: string;
  x: number;
  z: number;
  position?: ReefSurfacePoint;
  maxFootprintRadius?: number;
  availableFromEpoch?: number;
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

export type ReefSurfaceSampler = (x: number, z: number) => ReefSurfacePoint | null;
export type ReefRequestSurfaceSampler = (
  request: ReefSurfaceSlotRequest,
  x: number,
  z: number,
) => ReefSurfacePoint | null;

interface SampledCandidate {
  id: string;
  kind: ReefAllocatedSurfaceSlot['kind'];
  position: ReefSurfacePoint;
  availableFromEpoch?: number;
  maxFootprintRadius?: number;
}

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

function requestSampleKey(requestId: string, x: number, z: number): string {
  return `${requestId}:${sampleKey(x, z)}`;
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
    const minimumDistance = (request.footprintRadius + slot.footprintRadius) * clearanceRatio;
    if (dx * dx + dz * dz < minimumDistance * minimumDistance - 1e-8) return false;
  }
  return true;
}

function scoreCandidate(candidate: SampledCandidate, request: ReefSurfaceSlotRequest): number {
  const horizontalDistance = Math.hypot(
    candidate.position.x - request.preferred.x,
    candidate.position.z - request.preferred.z,
  );
  const verticalDistance = Math.abs(candidate.position.y - request.preferred.y);
  return horizontalDistance + verticalDistance * 0.14;
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

function requestCandidatePool(
  candidates: readonly ReefSurfaceSlotCandidate[],
  request: ReefSurfaceSlotRequest,
): readonly ReefSurfaceSlotCandidate[] {
  if (candidates.length <= REQUEST_AWARE_CANDIDATE_LIMIT) return candidates;
  return [...candidates]
    .sort((left, right) => {
      const leftX = left.position?.x ?? left.x;
      const leftZ = left.position?.z ?? left.z;
      const rightX = right.position?.x ?? right.x;
      const rightZ = right.position?.z ?? right.z;
      const leftDistance = (leftX - request.preferred.x) ** 2
        + (leftZ - request.preferred.z) ** 2;
      const rightDistance = (rightX - request.preferred.x) ** 2
        + (rightZ - request.preferred.z) ** 2;
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    })
    .slice(0, REQUEST_AWARE_CANDIDATE_LIMIT);
}

export function allocateReefSurfaceSlots({
  requests,
  candidates,
  sample,
  sampleForRequest,
}: {
  requests: readonly ReefSurfaceSlotRequest[];
  candidates: readonly ReefSurfaceSlotCandidate[];
  sample: ReefSurfaceSampler;
  sampleForRequest?: ReefRequestSurfaceSampler;
}): ReefSurfaceSlotAllocation {
  const cache = new Map<string, ReefSurfacePoint | null>();
  const requestCache = new Map<string, ReefSurfacePoint | null>();
  const requestAwareSampledCandidateIds = new Set<string>();

  const sampleAt = (x: number, z: number): ReefSurfacePoint | null => {
    const key = sampleKey(x, z);
    if (cache.has(key)) return cache.get(key) ?? null;
    const result = sample(x, z);
    cache.set(key, result);
    return result;
  };

  const sampleAtForRequest = (
    request: ReefSurfaceSlotRequest,
    x: number,
    z: number,
  ): ReefSurfacePoint | null => {
    if (!sampleForRequest) return sampleAt(x, z);
    const key = requestSampleKey(request.id, x, z);
    if (requestCache.has(key)) return requestCache.get(key) ?? null;
    const result = sampleForRequest(request, x, z);
    requestCache.set(key, result);
    return result;
  };

  const registry = sampleForRequest
    ? []
    : candidates.flatMap<SampledCandidate>((candidate) => {
        const position = candidate.position ? { ...candidate.position } : sampleAt(candidate.x, candidate.z);
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
            }]
          : [];
      });

  const orderedRequests = [...requests].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
  const slots: ReefAllocatedSurfaceSlot[] = [];
  const unresolvedRequestIds: string[] = [];

  for (const request of orderedRequests) {
    const pool = sampleForRequest ? requestCandidatePool(candidates, request) : candidates;
    const requestRegistry = sampleForRequest
      ? pool.flatMap<SampledCandidate>((candidate) => {
          const sampleX = candidate.position?.x ?? candidate.x;
          const sampleZ = candidate.position?.z ?? candidate.z;
          const position = sampleAtForRequest(request, sampleX, sampleZ);
          if (!position) return [];
          requestAwareSampledCandidateIds.add(candidate.id);
          return [{
            id: candidate.id,
            kind: 'registry',
            position,
            ...(candidate.availableFromEpoch === undefined
              ? {}
              : { availableFromEpoch: candidate.availableFromEpoch }),
            ...(candidate.maxFootprintRadius === undefined
              ? {}
              : { maxFootprintRadius: candidate.maxFootprintRadius }),
          }];
        })
      : registry;

    const preferredPosition = sampleAtForRequest(
      request,
      request.preferred.x,
      request.preferred.z,
    );
    const options: SampledCandidate[] = preferredPosition
      ? [{
          id: `reef:surface-slot:preferred:${request.id}`,
          kind: 'preferred',
          position: preferredPosition,
        }, ...requestRegistry]
      : [...requestRegistry];
    const availableOptions = options
      .filter((candidate) => isAvailableForRequest(candidate, request))
      .sort((left, right) => (
        scoreCandidate(left, request) - scoreCandidate(right, request)
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
  return {
    slots,
    diagnostics: {
      version: REEF_SURFACE_SLOT_VERSION,
      requestedCount: requests.length,
      registryCandidateCount: candidates.length,
      sampledCandidateCount: sampleForRequest
        ? requestAwareSampledCandidateIds.size
        : registry.length,
      allocatedCount: slots.length,
      preferredCount,
      relocatedCount: slots.filter((slot) => slot.displacement > 1e-4).length,
      relaxedCount: slots.filter((slot) => slot.clearanceRatio < 1).length,
      unresolvedRequestIds,
    },
  };
}
