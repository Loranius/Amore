import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  REEF_COLONY_MORPHOTYPES,
  type ReefColonyMorphotype,
} from '@/engine/species/reef';
import {
  REEF_LIVING_CANOPY_BUDGET,
  type ReefLivingCanopyColony,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import {
  buildReefMorphologyFamiliesGeometry,
  REEF_MORPHOLOGY_FAMILIES_PASS,
  REEF_MORPHOLOGY_FAMILIES_VERSION,
  type ReefMorphologyFamiliesMetrics,
} from './reefMorphologyFamilies';
import type { ReefAllocatedSurfaceSlot } from './reefSurfaceSlots';

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

function manualPlan(
  morphotypes: readonly ReefColonyMorphotype[],
  emphasizedIndex = -1,
): {
  plan: ReefLivingCanopyPlan;
  slots: ReefAllocatedSurfaceSlot[];
} {
  const counts = emptyCounts();
  const colonies = morphotypes.map((morphotype, index): ReefLivingCanopyColony => {
    counts[morphotype] += 1;
    return {
      id: `reef:morphology:test:${morphotype}:${index}`,
      sourceColonyId: `reef:colony:morphology:test:${morphotype}:${index}`,
      sourceModule: morphotype === 'encrusting' ? 'memories' : 'wishlist',
      morphotype,
      tier: morphotype === 'encrusting' ? 'micro' : 'primary',
      seed: 2_611 + index * 503 + morphotype.length * 71,
      emphasized: index === emphasizedIndex,
      weight: 0.72,
      maturity: 0.84,
      footprintRadius: morphotype === 'encrusting' ? 0.15 : 0.38,
      targetHeight: morphotype === 'encrusting' ? 0.12 : 0.62,
      facingRad: index * 0.37,
      request: {
        id: `reef:morphology:request:${morphotype}:${index}`,
        sequence: index,
        epochIndex: 1,
        preferred: { x: index * 1.5, y: 0.24, z: 0 },
        footprintRadius: morphotype === 'encrusting' ? 0.15 : 0.38,
      },
    };
  });
  const slots = colonies.map((colony, index): ReefAllocatedSurfaceSlot => ({
    requestId: colony.request.id,
    candidateId: `reef:morphology:slot:${index}`,
    kind: 'registry',
    position: { x: index * 1.5, y: 0.24, z: 0 },
    footprintRadius: colony.request.footprintRadius,
    clearanceRatio: 1,
    displacement: 0,
  }));

  return {
    plan: {
      colonies,
      requests: colonies.map((colony) => colony.request),
      morphotypeCounts: counts,
    },
    slots,
  };
}

function metrics(geometry: THREE.BufferGeometry): ReefMorphologyFamiliesMetrics {
  return geometry.userData.reefMorphologyFamiliesMetrics as ReefMorphologyFamiliesMetrics;
}

function dimensions(morphotype: ReefColonyMorphotype): THREE.Vector3 {
  const { plan, slots } = manualPlan([morphotype]);
  const geometry = buildReefMorphologyFamiliesGeometry({ plan, slots });
  geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
  geometry.dispose();
  return size;
}

describe('reef morphology families stage 3', () => {
  it('publishes six distinct bounded topology signatures in one shared renderer path', () => {
    const signatures = REEF_COLONY_MORPHOTYPES.map((morphotype) => {
      const { plan, slots } = manualPlan([morphotype]);
      const geometry = buildReefMorphologyFamiliesGeometry({ plan, slots });
      const diagnostics = metrics(geometry);

      expect(geometry.userData.reefMorphologyFamiliesVersion).toBe(
        REEF_MORPHOLOGY_FAMILIES_VERSION,
      );
      expect(geometry.userData.reefMorphologyFamiliesPass).toBe(
        REEF_MORPHOLOGY_FAMILIES_PASS,
      );
      expect(diagnostics.drawCalls).toBe(1);
      expect(diagnostics.budgetExceeded).toBe(false);
      geometry.dispose();
      return diagnostics.triangleCount;
    });

    expect(new Set(signatures).size).toBe(REEF_COLONY_MORPHOTYPES.length);
  });

  it('makes the four reef-building families readable from silhouette, not only colour', () => {
    const branching = dimensions('branching');
    const massive = dimensions('massive');
    const plating = dimensions('plating');
    const encrusting = dimensions('encrusting');
    const massiveHorizontal = Math.max(massive.x, massive.z);
    const platingHorizontal = Math.max(plating.x, plating.z);
    const encrustingHorizontal = Math.max(encrusting.x, encrusting.z);

    expect(branching.y).toBeGreaterThan(massive.y * 1.25);
    expect(massiveHorizontal).toBeGreaterThan(massive.y);
    expect(platingHorizontal).toBeGreaterThan(plating.y * 1.45);
    expect(encrusting.y).toBeLessThan(0.18);
    expect(encrustingHorizontal).toBeGreaterThan(encrusting.y * 2.4);
  });

  it('keeps stable dominant hierarchy and exact deterministic geometry', () => {
    const { plan, slots } = manualPlan(['branching', 'massive', 'plating'], 1);
    const first = buildReefMorphologyFamiliesGeometry({ plan, slots });
    const second = buildReefMorphologyFamiliesGeometry({ plan, slots });
    const firstMetrics = metrics(first);

    expect(firstMetrics.dominantColonyCount).toBeGreaterThanOrEqual(1);
    expect(Array.from(first.getAttribute('position').array)).toEqual(
      Array.from(second.getAttribute('position').array),
    );
    expect(Array.from(first.getAttribute('color').array)).toEqual(
      Array.from(second.getAttribute('color').array),
    );

    first.dispose();
    second.dispose();
  });

  it('keeps even a maximum population of the heaviest family inside the mobile budget', () => {
    const population = Array.from(
      { length: REEF_LIVING_CANOPY_BUDGET.maximumColonies },
      (): ReefColonyMorphotype => 'branching',
    );
    const { plan, slots } = manualPlan(population);
    const geometry = buildReefMorphologyFamiliesGeometry({ plan, slots });
    const diagnostics = metrics(geometry);

    expect(diagnostics.allocatedColonyCount).toBe(REEF_LIVING_CANOPY_BUDGET.maximumColonies);
    expect(diagnostics.vertexCount).toBeLessThanOrEqual(REEF_LIVING_CANOPY_BUDGET.maximumVertices);
    expect(diagnostics.triangleCount).toBeLessThanOrEqual(REEF_LIVING_CANOPY_BUDGET.maximumTriangles);
    expect(diagnostics.budgetExceeded).toBe(false);

    geometry.dispose();
  });
});
