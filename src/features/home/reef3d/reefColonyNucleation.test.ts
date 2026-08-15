import { describe, expect, it } from 'vitest';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import {
  buildReefColonyNucleationPlan,
  createReefColonyNucleationScorer,
  REEF_COLONY_NUCLEATION_PASS,
  REEF_COLONY_NUCLEATION_VERSION,
} from './reefColonyNucleation';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
  type ReefSurfaceScoreCandidate,
  type ReefSurfaceScoreContext,
  type ReefSurfaceSlotRequest,
} from './reefSurfaceSlots';

function emptyCounts(): Record<ReefColonyMorphotype, number> {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

function manualPlan(morphotypes: readonly ReefColonyMorphotype[]): ReefLivingCanopyPlan {
  const counts = emptyCounts();
  const colonies = morphotypes.map((morphotype, index): ReefLivingCanopyColony => {
    counts[morphotype] += 1;
    const footprintRadius = morphotype === 'encrusting' ? 0.13 : 0.31;
    const request: ReefSurfaceSlotRequest = {
      id: `reef:nucleation:request:${morphotype}:${index}`,
      sequence: index * 7 + 1,
      epochIndex: 1,
      preferred: {
        x: Math.cos(index * 0.63) * (0.34 + index * 0.05),
        y: 0.46 + index * 0.015,
        z: Math.sin(index * 0.63) * (0.34 + index * 0.05),
      },
      footprintRadius,
    };
    return {
      id: `reef:nucleation:test:${morphotype}:${index}`,
      sourceColonyId: `reef:colony:nucleation:${morphotype}:${index}`,
      sourceModule: morphotype === 'encrusting' ? 'memories' : 'wishlist',
      morphotype,
      tier: morphotype === 'encrusting' ? 'micro' : 'primary',
      seed: 4_021 + index * 421 + morphotype.length * 97,
      emphasized: false,
      weight: 0.72,
      maturity: 0.82,
      footprintRadius,
      targetHeight: morphotype === 'encrusting' ? 0.11 : 0.58,
      facingRad: index * 0.31,
      request,
    };
  });
  return {
    colonies,
    requests: colonies.map((colony) => colony.request),
    morphotypeCounts: counts,
  };
}

function scoreContext(
  request: ReefSurfaceSlotRequest,
  candidate: ReefSurfaceScoreCandidate,
): ReefSurfaceScoreContext {
  return {
    request,
    candidate,
    occupied: [],
    baseScore: 0.4,
  };
}

function candidate(
  id: string,
  x: number,
  y: number,
  z: number,
  normalY: number,
): ReefSurfaceScoreCandidate {
  return {
    id,
    kind: 'registry',
    position: { x, y, z },
    normalY,
    supportRadius: 0.42,
  };
}

function candidateOnPreferredRay(
  id: string,
  request: ReefSurfaceSlotRequest,
  radius: number,
  y: number,
  normalY: number,
): ReefSurfaceScoreCandidate {
  const preferredAngle = Math.atan2(request.preferred.z, request.preferred.x);
  return candidate(
    id,
    Math.cos(preferredAngle) * radius,
    y,
    Math.sin(preferredAngle) * radius,
    normalY,
  );
}

describe('reef colony nucleation stage 4', () => {
  it('publishes a deterministic append-stable settlement plan', () => {
    expect(REEF_COLONY_NUCLEATION_VERSION).toBe('reef-colony-nucleation-v1');
    expect(REEF_COLONY_NUCLEATION_PASS).toContain('ecological-settlement');

    const initial = manualPlan(['branching', 'massive', 'plating']);
    const extended = manualPlan(['branching', 'massive', 'plating', 'encrusting']);
    const first = buildReefColonyNucleationPlan({
      plan: initial,
      foundationRadius: 2.4,
      seed: 91,
    });
    const repeated = buildReefColonyNucleationPlan({
      plan: initial,
      foundationRadius: 2.4,
      seed: 91,
    });
    const grown = buildReefColonyNucleationPlan({
      plan: extended,
      foundationRadius: 2.4,
      seed: 91,
    });

    expect(repeated).toEqual(first);
    expect(grown.colonies.slice(0, first.colonies.length)).toEqual(first.colonies);
    expect(grown.requests.slice(0, first.requests.length)).toEqual(first.requests);
  });

  it('prefers exposed horizontal substrate for plating and sheltered lower substrate for encrusting', () => {
    const platingPlan = buildReefColonyNucleationPlan({
      plan: manualPlan(['plating']),
      foundationRadius: 2.2,
      seed: 123,
    });
    const platingRequest = platingPlan.requests[0]!;
    const platingScore = createReefColonyNucleationScorer({
      plan: platingPlan,
      foundationRadius: 2.2,
      seed: 123,
    });
    const exposedPlating = candidateOnPreferredRay(
      'plating:exposed',
      platingRequest,
      1.72,
      platingRequest.preferred.y + 0.17,
      0.9,
    );
    const shelteredPlating = candidateOnPreferredRay(
      'plating:sheltered',
      platingRequest,
      0.52,
      platingRequest.preferred.y - 0.08,
      0.7,
    );

    expect(platingScore(scoreContext(platingRequest, exposedPlating)))
      .toBeLessThan(platingScore(scoreContext(platingRequest, shelteredPlating)));

    const encrustingPlan = buildReefColonyNucleationPlan({
      plan: manualPlan(['encrusting']),
      foundationRadius: 2.2,
      seed: 123,
    });
    const encrustingRequest = encrustingPlan.requests[0]!;
    const encrustingScore = createReefColonyNucleationScorer({
      plan: encrustingPlan,
      foundationRadius: 2.2,
      seed: 123,
    });
    const shelteredEncrusting = candidateOnPreferredRay(
      'encrusting:sheltered',
      encrustingRequest,
      0.62,
      encrustingRequest.preferred.y - 0.03,
      0.7,
    );
    const exposedEncrusting = candidateOnPreferredRay(
      'encrusting:exposed',
      encrustingRequest,
      1.78,
      encrustingRequest.preferred.y + 0.2,
      0.96,
    );

    expect(encrustingScore(scoreContext(encrustingRequest, shelteredEncrusting)))
      .toBeLessThan(encrustingScore(scoreContext(encrustingRequest, exposedEncrusting)));
  });

  it('keeps chronological ecological allocation append-only and inside real substrate bounds', () => {
    const foundationRadius = 2.35;
    const seed = 217;
    const initialPlan = buildReefColonyNucleationPlan({
      plan: manualPlan(['branching', 'massive', 'plating', 'encrusting', 'soft-coral']),
      foundationRadius,
      seed,
    });
    const extendedPlan = buildReefColonyNucleationPlan({
      plan: manualPlan([
        'branching',
        'massive',
        'plating',
        'encrusting',
        'soft-coral',
        'sea-fan',
      ]),
      foundationRadius,
      seed,
    });
    const candidates = buildReefSurfaceSlotCandidates({ foundationRadius, seed });
    const sample = (x: number, z: number) => {
      const radius = Math.hypot(x, z);
      if (radius > foundationRadius * 0.94) return null;
      return {
        x,
        y: 0.38 + radius * 0.11,
        z,
        normalY: Math.max(0.72, 0.98 - radius * 0.07),
      };
    };
    const first = allocateReefSurfaceSlots({
      requests: initialPlan.requests,
      candidates,
      sample,
      candidateScorer: createReefColonyNucleationScorer({
        plan: initialPlan,
        foundationRadius,
        seed,
      }),
    });
    const grown = allocateReefSurfaceSlots({
      requests: extendedPlan.requests,
      candidates,
      sample,
      candidateScorer: createReefColonyNucleationScorer({
        plan: extendedPlan,
        foundationRadius,
        seed,
      }),
    });

    expect(first.diagnostics.unresolvedRequestIds).toEqual([]);
    expect(grown.diagnostics.unresolvedRequestIds).toEqual([]);
    expect(grown.slots.slice(0, first.slots.length)).toEqual(first.slots);
    expect(grown.slots.every((slot) => (
      Math.hypot(slot.position.x, slot.position.z) <= foundationRadius * 0.94 + 1e-6
    ))).toBe(true);

    for (let left = 0; left < grown.slots.length; left += 1) {
      for (let right = left + 1; right < grown.slots.length; right += 1) {
        const firstSlot = grown.slots[left]!;
        const secondSlot = grown.slots[right]!;
        const distance = Math.hypot(
          firstSlot.position.x - secondSlot.position.x,
          firstSlot.position.z - secondSlot.position.z,
        );
        expect(distance).toBeGreaterThan(0.05);
      }
    }
  });
});
