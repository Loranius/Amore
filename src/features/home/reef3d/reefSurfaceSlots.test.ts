import { describe, expect, it } from 'vitest';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
  type ReefSurfaceSampler,
  type ReefSurfaceSlotRequest,
} from './reefSurfaceSlots';

function discSampler(radius: number): ReefSurfaceSampler {
  return (x, z) => (
    Math.hypot(x, z) <= radius
      ? { x, y: 0.4 + Math.hypot(x, z) * 0.05, z }
      : null
  );
}

function request(
  id: string,
  sequence: number,
  x: number,
  z: number,
  footprintRadius = 0.18,
): ReefSurfaceSlotRequest {
  return {
    id,
    sequence,
    preferred: { x, y: 0.5, z },
    footprintRadius,
  };
}

describe('reef surface slots', () => {
  it('keeps inner registry slots fixed when the foundation gains outer rings', () => {
    const first = buildReefSurfaceSlotCandidates({ foundationRadius: 2.1, seed: 41 });
    const grown = buildReefSurfaceSlotCandidates({ foundationRadius: 3.4, seed: 41 });

    expect(grown.length).toBeGreaterThan(first.length);
    expect(grown.slice(0, first.length)).toEqual(first);
    expect(buildReefSurfaceSlotCandidates({ foundationRadius: 2.1, seed: 41 })).toEqual(first);
  });

  it('preserves supported preferred anchors and their full clearance', () => {
    const candidates = buildReefSurfaceSlotCandidates({ foundationRadius: 2, seed: 9 });
    const allocation = allocateReefSurfaceSlots({
      requests: [
        request('older', 1, -0.65, 0),
        request('newer', 2, 0.65, 0),
      ],
      candidates,
      sample: discSampler(2),
    });

    expect(allocation.diagnostics.unresolvedRequestIds).toEqual([]);
    expect(allocation.diagnostics.preferredCount).toBe(2);
    expect(allocation.diagnostics.relocatedCount).toBe(0);
    expect(allocation.diagnostics.relaxedCount).toBe(0);
    expect(allocation.slots.map((slot) => slot.kind)).toEqual(['preferred', 'preferred']);
  });

  it('moves unsupported anchors to real registry surfaces instead of dropping them', () => {
    const candidates = buildReefSurfaceSlotCandidates({ foundationRadius: 2, seed: 17 });
    const allocation = allocateReefSurfaceSlots({
      requests: [
        request('outside-left', 1, -3.2, 0),
        request('outside-right', 2, 3.2, 0),
      ],
      candidates,
      sample: discSampler(1.9),
    });

    expect(allocation.diagnostics.requestedCount).toBe(2);
    expect(allocation.diagnostics.allocatedCount).toBe(2);
    expect(allocation.diagnostics.unresolvedRequestIds).toEqual([]);
    expect(allocation.diagnostics.relocatedCount).toBe(2);
    expect(allocation.slots.every((slot) => slot.kind === 'registry')).toBe(true);
    expect(allocation.slots.every((slot) => Math.hypot(slot.position.x, slot.position.z) <= 1.9))
      .toBe(true);
  });

  it('reserves collision-safe slots chronologically and remains append-only', () => {
    const candidates = buildReefSurfaceSlotCandidates({ foundationRadius: 2.4, seed: 29 });
    const initialRequests = [
      request('first', 10, 0.2, 0.1, 0.24),
      request('second', 20, 0.2, 0.1, 0.24),
    ];
    const initial = allocateReefSurfaceSlots({
      requests: initialRequests,
      candidates,
      sample: discSampler(2.3),
    });
    const extended = allocateReefSurfaceSlots({
      requests: [
        ...initialRequests,
        request('third', 30, 0.2, 0.1, 0.24),
      ],
      candidates,
      sample: discSampler(2.3),
    });

    const [first, second] = initial.slots;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(Math.hypot(
      (first?.position.x ?? 0) - (second?.position.x ?? 0),
      (first?.position.z ?? 0) - (second?.position.z ?? 0),
    )).toBeGreaterThanOrEqual(0.48 - 1e-5);
    expect(extended.slots.slice(0, 2)).toEqual(initial.slots);
    expect(extended.diagnostics.allocatedCount).toBe(3);
  });

  it('reports total support loss without deleting the request contract', () => {
    const allocation = allocateReefSurfaceSlots({
      requests: [request('visible-fallback', 1, 4, 4)],
      candidates: buildReefSurfaceSlotCandidates({ foundationRadius: 2, seed: 3 }),
      sample: () => null,
    });

    expect(allocation.diagnostics.requestedCount).toBe(1);
    expect(allocation.diagnostics.allocatedCount).toBe(0);
    expect(allocation.diagnostics.unresolvedRequestIds).toEqual(['visible-fallback']);
  });
});
