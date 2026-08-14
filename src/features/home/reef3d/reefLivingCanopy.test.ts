import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import {
  REEF_COLONY_MORPHOTYPES,
  type ReefColonyMorphotype,
} from '@/engine/species/reef';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  buildReefLivingCanopyGeometry,
  buildReefLivingCanopyPlan,
  REEF_LIVING_CANOPY_BUDGET,
  REEF_LIVING_CANOPY_PASS,
  REEF_LIVING_CANOPY_VERSION,
  type ReefLivingCanopyColony,
  type ReefLivingCanopyGeometryMetrics,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import { raycastReefSupport } from './reefSupportPlacement';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
  type ReefAllocatedSurfaceSlot,
} from './reefSurfaceSlots';
import {
  buildReefTerracedFoundationGeometry,
  createReefTerracedFoundationProfile,
} from './reefTerracedFoundation';

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
  morphotypes: readonly ReefColonyMorphotype[] = REEF_COLONY_MORPHOTYPES,
): {
  plan: ReefLivingCanopyPlan;
  slots: ReefAllocatedSurfaceSlot[];
} {
  const counts = emptyCounts();
  const colonies = morphotypes.map((morphotype, index): ReefLivingCanopyColony => {
    counts[morphotype] += 1;
    return {
      id: `reef:living-canopy:test:${morphotype}:${index}`,
      sourceColonyId: `reef:colony:test:${morphotype}:${index}`,
      sourceModule: morphotype === 'encrusting' ? 'memories' : 'wishlist',
      morphotype,
      tier: morphotype === 'encrusting' ? 'micro' : 'primary',
      seed: 1_001 + index * 137,
      emphasized: morphotype === 'massive',
      weight: 0.72,
      maturity: 0.84,
      footprintRadius: morphotype === 'encrusting' ? 0.13 : 0.38,
      targetHeight: morphotype === 'encrusting' ? 0.12 : 0.62,
      facingRad: index * 0.41,
      request: {
        id: `reef:colony-mesh-range:reef:colony:test:${morphotype}:${index}`,
        sequence: index,
        epochIndex: 1,
        preferred: { x: index * 1.1, y: 0.2 + index * 0.04, z: 0 },
        footprintRadius: morphotype === 'encrusting' ? 0.13 : 0.38,
      },
    };
  });
  const slots = colonies.map((colony, index): ReefAllocatedSurfaceSlot => ({
    requestId: colony.request.id,
    candidateId: `reef:test:slot:${index}`,
    kind: 'registry',
    position: { x: index * 1.1, y: 0.2 + index * 0.04, z: 0 },
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

const PORTAL_EVENTS: EvolutionEventInput[] = [
  ...Array.from({ length: 12 }, (_value, index): EvolutionEventInput => ({
    id: `wish:canopy:${index}`,
    occurredAt: '2024-05-12',
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.5, significance: 0.28, remembrance: 0.16 },
    portalActivity: 0.24,
  })),
  ...Array.from({ length: 9 }, (_value, index): EvolutionEventInput => ({
    id: `media:canopy:${index}`,
    occurredAt: '2024-08-18',
    source: 'media@1',
    evidence: 'historical-estimate',
    channels: { culture: 0.22, remembrance: 0.1, stability: 0.06 },
    portalActivity: 0.08,
  })),
  ...Array.from({ length: 4 }, (_value, index): EvolutionEventInput => ({
    id: `memory:canopy:${index}`,
    occurredAt: '2024-10-22',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.12 },
    portalActivity: 0.05,
  })),
  {
    id: 'calendar:canopy:landmark',
    occurredAt: '2025-02-14',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.96, remembrance: 0.72 },
    portalActivity: 0.24,
  },
  {
    id: 'calendar:canopy:culture',
    occurredAt: '2025-05-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.9, significance: 0.32 },
    portalActivity: 0.22,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-living-canopy-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: PORTAL_EVENTS,
  });
  return buildReefPreviewFromArtifact({ artifact, asOf: '2026-07-31' });
}

function makeSupport(build: ReturnType<typeof buildFixture>): THREE.Mesh {
  const profile = createReefTerracedFoundationProfile({
    radius: build.structures.visibleFoundationRadius,
    verticalScale: build.structures.foundationScaleY,
    seed: build.species.moduleEvolution.identitySeed,
  });
  const support = new THREE.Mesh(
    buildReefTerracedFoundationGeometry(profile),
    new THREE.MeshBasicMaterial(),
  );
  support.updateMatrixWorld(true);
  return support;
}

function metrics(geometry: THREE.BufferGeometry): ReefLivingCanopyGeometryMetrics {
  return geometry.userData.reefLivingCanopyMetrics as ReefLivingCanopyGeometryMetrics;
}

describe('reef living canopy', () => {
  it('publishes a distinct bounded geometry signature for all six morphotypes', () => {
    const signatures = REEF_COLONY_MORPHOTYPES.map((morphotype) => {
      const { plan, slots } = manualPlan([morphotype]);
      const geometry = buildReefLivingCanopyGeometry({ plan, slots });
      const triangleCount = metrics(geometry).triangleCount;
      geometry.dispose();
      return triangleCount;
    });

    expect(new Set(signatures).size).toBe(REEF_COLONY_MORPHOTYPES.length);
    expect(signatures.every((count) => count > 40)).toBe(true);
  });

  it('merges every allocated colony into one grounded vertex-coloured draw call', () => {
    const { plan, slots } = manualPlan();
    const geometry = buildReefLivingCanopyGeometry({ plan, slots });
    const diagnostics = metrics(geometry);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    let minimumY = Number.POSITIVE_INFINITY;

    for (let index = 0; index < positions.count; index += 1) {
      minimumY = Math.min(minimumY, positions.getY(index));
      expect(Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index)))
        .toBeCloseTo(1, 4);
      expect(colors.getX(index)).toBeGreaterThanOrEqual(0);
      expect(colors.getX(index)).toBeLessThanOrEqual(1);
    }

    expect(geometry.index).toBeNull();
    expect(geometry.userData.reefLivingCanopyVersion).toBe(REEF_LIVING_CANOPY_VERSION);
    expect(geometry.userData.reefLivingCanopyPass).toBe(REEF_LIVING_CANOPY_PASS);
    expect(diagnostics.sourceColonyCount).toBe(REEF_COLONY_MORPHOTYPES.length);
    expect(diagnostics.allocatedColonyCount).toBe(REEF_COLONY_MORPHOTYPES.length);
    expect(diagnostics.unresolvedColonyCount).toBe(0);
    expect(diagnostics.drawCalls).toBe(1);
    expect(diagnostics.vertexCount).toBe(positions.count);
    expect(diagnostics.triangleCount).toBe(positions.count / 3);
    expect(diagnostics.budgetExceeded).toBe(false);
    expect(minimumY).toBeGreaterThanOrEqual(Math.min(...slots.map((slot) => slot.position.y)));

    geometry.dispose();
  });

  it('keeps the maximum accepted colony population inside the canopy budget', () => {
    const maximumPopulation = Array.from(
      { length: REEF_LIVING_CANOPY_BUDGET.maximumColonies },
      (): ReefColonyMorphotype => 'soft-coral',
    );
    const { plan, slots } = manualPlan(maximumPopulation);
    const geometry = buildReefLivingCanopyGeometry({ plan, slots });
    const diagnostics = metrics(geometry);

    expect(diagnostics.allocatedColonyCount).toBe(
      REEF_LIVING_CANOPY_BUDGET.maximumColonies,
    );
    expect(diagnostics.vertexCount).toBeLessThanOrEqual(
      REEF_LIVING_CANOPY_BUDGET.maximumVertices,
    );
    expect(diagnostics.triangleCount).toBeLessThanOrEqual(
      REEF_LIVING_CANOPY_BUDGET.maximumTriangles,
    );
    expect(diagnostics.budgetExceeded).toBe(false);

    geometry.dispose();
  });

  it('derives diverse append-stable colonies from real portal facts and surface slots', () => {
    const build = buildFixture();
    const plan = buildReefLivingCanopyPlan(build);
    const support = makeSupport(build);
    const candidates = buildReefSurfaceSlotCandidates({
      foundationRadius: build.structures.visibleFoundationRadius,
      seed: build.species.moduleEvolution.identitySeed,
    });
    const allocation = allocateReefSurfaceSlots({
      requests: plan.requests,
      candidates,
      sample: (x, z) => {
        const hit = raycastReefSupport([support], x, z, 0.2);
        return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null;
      },
    });
    const first = buildReefLivingCanopyGeometry({ plan, slots: allocation.slots });
    const second = buildReefLivingCanopyGeometry({
      plan: buildReefLivingCanopyPlan(build),
      slots: allocation.slots,
    });
    const growthMorphotypes = new Set(build.species.growth.map((colony) => colony.morphotype));
    const diagnostics = metrics(first);

    expect(growthMorphotypes).toEqual(new Set(REEF_COLONY_MORPHOTYPES));
    expect(plan.colonies).toHaveLength(build.layout.colonies.length);
    expect(plan.requests).toHaveLength(plan.colonies.length);
    expect(new Set(plan.requests.map((request) => request.id)).size).toBe(plan.requests.length);
    expect(allocation.diagnostics.unresolvedRequestIds).toEqual([]);
    expect(diagnostics.allocatedColonyCount).toBe(plan.colonies.length);
    expect(diagnostics.vertexCount).toBeLessThanOrEqual(
      REEF_LIVING_CANOPY_BUDGET.maximumVertices,
    );
    expect(diagnostics.triangleCount).toBeLessThanOrEqual(
      REEF_LIVING_CANOPY_BUDGET.maximumTriangles,
    );
    expect(Array.from(first.getAttribute('position').array)).toEqual(
      Array.from(second.getAttribute('position').array),
    );
    expect(Array.from(first.getAttribute('color').array)).toEqual(
      Array.from(second.getAttribute('color').array),
    );

    first.dispose();
    second.dispose();
    support.geometry.dispose();
    (support.material as THREE.Material).dispose();
  });
});
