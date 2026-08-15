import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import {
  buildReefSurfaceBoundLivingCanopyGeometry,
  buildReefCoralSurfaceFrame,
  hasReefCoralTerrainFootprintSupport,
  naturalizeReefLivingCanopyPlan,
  reefCoralNaturalVariation,
  REEF_CORAL_NATURAL_PLACEMENT_VERSION,
  REEF_CORAL_SURFACE_BINDING_VERSION,
} from './reefCoralNaturalPlacement';
import {
  buildReefLivingCanopyGeometry,
  type ReefLivingCanopyColony,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import type { ReefAllocatedSurfaceSlot } from './reefSurfaceSlots';

const MORPHOTYPES: ReefColonyMorphotype[] = [
  'branching',
  'massive',
  'plating',
  'encrusting',
  'soft-coral',
  'sea-fan',
];

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

function manualFixture(morphotype: ReefColonyMorphotype = 'branching'): {
  plan: ReefLivingCanopyPlan;
  slot: ReefAllocatedSurfaceSlot;
} {
  const request = {
    id: 'reef:test:natural-placement',
    sequence: 4,
    epochIndex: 2,
    preferred: { x: 0.4, y: 0.32, z: -0.2 },
    footprintRadius: 0.34,
  };
  const colony: ReefLivingCanopyColony = {
    id: 'reef:living-canopy:test:natural-placement',
    sourceColonyId: 'reef:colony:test:natural-placement',
    sourceModule: 'wishlist',
    morphotype,
    tier: morphotype === 'encrusting' ? 'micro' : 'primary',
    seed: 82_417,
    emphasized: false,
    weight: 0.72,
    maturity: 0.81,
    footprintRadius: request.footprintRadius,
    targetHeight: morphotype === 'encrusting' ? 0.12 : 0.58,
    facingRad: 0.42,
    request,
  };
  const counts = emptyCounts();
  counts[morphotype] = 1;
  return {
    plan: {
      colonies: [colony],
      requests: [request],
      morphotypeCounts: counts,
    },
    slot: {
      requestId: request.id,
      candidateId: 'reef:test:natural-slot',
      kind: 'registry',
      position: { ...request.preferred },
      footprintRadius: request.footprintRadius,
      clearanceRatio: 1,
      displacement: 0,
    },
  };
}

describe('reef coral natural placement', () => {
  it('keeps deterministic species-bounded size, yaw and tilt variation', () => {
    const signatures = MORPHOTYPES.map((morphotype) => {
      const first = reefCoralNaturalVariation(12_345, morphotype);
      const second = reefCoralNaturalVariation(12_345, morphotype);
      expect(second).toEqual(first);
      expect(first.radialScale).toBeGreaterThanOrEqual(0.89);
      expect(first.radialScale).toBeLessThanOrEqual(1.1);
      expect(first.heightScale).toBeGreaterThanOrEqual(0.86);
      expect(first.heightScale).toBeLessThanOrEqual(1.16);
      expect(Math.abs(first.yawOffsetRad)).toBeLessThanOrEqual(1);
      expect(first.tiltRad).toBeGreaterThan(0);
      expect(first.tiltRad).toBeLessThanOrEqual(10 * Math.PI / 180);
      return `${first.radialScale}:${first.heightScale}:${first.yawOffsetRad}:${first.tiltRad}`;
    });

    expect(new Set(signatures).size).toBeGreaterThan(2);
    expect(reefCoralNaturalVariation(12_346, 'branching'))
      .not.toEqual(reefCoralNaturalVariation(12_345, 'branching'));
  });

  it('naturalizes canopy dimensions without changing colony identity or ordering', () => {
    const { plan } = manualFixture('soft-coral');
    const source = plan.colonies[0]!;
    const naturalized = naturalizeReefLivingCanopyPlan(plan);
    const result = naturalized.colonies[0]!;

    expect(result.id).toBe(source.id);
    expect(result.sourceColonyId).toBe(source.sourceColonyId);
    expect(result.seed).toBe(source.seed);
    expect(result.request.id).toBe(source.request.id);
    expect(result.request.footprintRadius).toBe(result.footprintRadius);
    expect(result.footprintRadius).not.toBe(source.footprintRadius);
    expect(result.targetHeight).not.toBe(source.targetHeight);
    expect(result.facingRad).not.toBe(source.facingRad);
  });

  it('leans around the real support normal instead of global Y', () => {
    const sourceNormal = new THREE.Vector3(0.32, 0.91, -0.18).normalize();
    const frame = buildReefCoralSurfaceFrame({
      seed: 42_001,
      morphotype: 'branching',
      surfaceNormal: sourceNormal,
    });
    const support = new THREE.Vector3(
      frame.supportNormal.x,
      frame.supportNormal.y,
      frame.supportNormal.z,
    );
    const growth = new THREE.Vector3(
      frame.growthAxis.x,
      frame.growthAxis.y,
      frame.growthAxis.z,
    );
    const angle = support.angleTo(growth);

    expect(support.length()).toBeCloseTo(1, 5);
    expect(growth.length()).toBeCloseTo(1, 5);
    expect(support.y).toBeGreaterThan(0);
    expect(angle).toBeCloseTo(frame.tiltRad, 4);
    expect(angle).toBeLessThan(10 * Math.PI / 180);
  });

  it('rejects terrace lips and abrupt height discontinuities', () => {
    expect(hasReefCoralTerrainFootprintSupport({
      x: 0,
      z: 0,
      centerY: 0.4,
      sample: () => ({ y: 0.4 }),
    })).toBe(true);

    expect(hasReefCoralTerrainFootprintSupport({
      x: 0,
      z: 0,
      centerY: 0.4,
      sample: (x) => (x > 0.08 ? null : { y: 0.4 }),
    })).toBe(false);

    expect(hasReefCoralTerrainFootprintSupport({
      x: 0,
      z: 0,
      centerY: 0.4,
      sample: (x) => ({ y: x > 0.08 ? 0.7 : 0.4 }),
    })).toBe(false);
  });

  it('keeps a sloped coral above its support plane while preserving one draw call', () => {
    const { plan: sourcePlan, slot } = manualFixture('branching');
    const plan = naturalizeReefLivingCanopyPlan(sourcePlan);
    const ordinary = buildReefLivingCanopyGeometry({ plan, slots: [slot] });
    const surfaceNormal = new THREE.Vector3(0.34, 0.92, 0.18).normalize();
    const normalMap = new Map([
      [slot.requestId, {
        x: surfaceNormal.x,
        y: surfaceNormal.y,
        z: surfaceNormal.z,
      }],
    ]);
    const bound = buildReefSurfaceBoundLivingCanopyGeometry({
      plan,
      slots: [slot],
      surfaceNormalByRequestId: normalMap,
    });
    const positions = bound.getAttribute('position') as THREE.BufferAttribute;
    const normals = bound.getAttribute('normal') as THREE.BufferAttribute;
    const supportPoint = new THREE.Vector3(
      slot.position.x,
      slot.position.y,
      slot.position.z,
    );
    const point = new THREE.Vector3();
    let minimumPlaneDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < positions.count; index += 1) {
      point.set(positions.getX(index), positions.getY(index), positions.getZ(index));
      minimumPlaneDistance = Math.min(
        minimumPlaneDistance,
        point.sub(supportPoint).dot(surfaceNormal),
      );
      expect(Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index)))
        .toBeCloseTo(1, 4);
    }

    expect(bound.userData.reefCoralNaturalPlacementVersion)
      .toBe(REEF_CORAL_NATURAL_PLACEMENT_VERSION);
    expect(bound.userData.reefCoralSurfaceBindingVersion)
      .toBe(REEF_CORAL_SURFACE_BINDING_VERSION);
    expect(bound.userData.reefCoralSurfaceBoundColonyCount).toBe(1);
    expect(bound.userData.reefLivingCanopyMetrics.drawCalls).toBe(1);
    expect(minimumPlaneDistance).toBeGreaterThanOrEqual(0.0029);
    expect(Array.from(bound.getAttribute('position').array))
      .not.toEqual(Array.from(ordinary.getAttribute('position').array));

    ordinary.dispose();
    bound.dispose();
  });
});
