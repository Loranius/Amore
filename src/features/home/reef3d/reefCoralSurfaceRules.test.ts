import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  assessVolcanoCoralLocalPoint,
  chooseReefCoralPreferredSurface,
  classifyReefCoralSurface,
  reefCoralMorphotypeCanColonizeSurface,
  reefCoralSurfaceColonizationPolicy,
  VOLCANO_CORAL_SUMMIT_NO_GROW_RATIO,
} from './reefCoralSurfaceRules';

describe('reef coral surface taxonomy', () => {
  it('classifies the procedural volcano separately from ordinary reef rock', () => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const volcano = new THREE.Mesh(geometry);
    volcano.userData.reefSupportSurface = true;
    volcano.userData.reefSupportSurfaceKind = 'volcano';
    volcano.userData.reefVolcano = true;

    expect(classifyReefCoralSurface(volcano)).toBe('volcano');
    geometry.dispose();
  });

  it('recognises the terraced foundation as the primary terrace habitat', () => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const terrace = new THREE.Mesh(geometry);
    terrace.name = 'reef-terraced-foundation';

    expect(classifyReefCoralSurface(terrace)).toBe('terrace');
    geometry.dispose();
  });
});

describe('reef coral surface colonization', () => {
  it('keeps dense terraces generalist while volcanic pioneer habitat stays selective', () => {
    expect(reefCoralMorphotypeCanColonizeSurface('branching', 'terrace')).toBe(true);
    expect(reefCoralMorphotypeCanColonizeSurface('branching', 'volcano')).toBe(false);
    expect(reefCoralMorphotypeCanColonizeSurface('encrusting', 'volcano')).toBe(true);
    expect(reefCoralMorphotypeCanColonizeSurface('sea-fan', 'arch')).toBe(true);
    expect(reefCoralMorphotypeCanColonizeSurface('sea-fan', 'volcano')).toBe(false);
  });

  it('allows steeper attachment on arches and volcano slopes than on terraces', () => {
    const terrace = reefCoralSurfaceColonizationPolicy('terrace');
    const volcano = reefCoralSurfaceColonizationPolicy('volcano');
    const arch = reefCoralSurfaceColonizationPolicy('arch');

    expect(volcano.minNormalY).toBeLessThan(terrace.minNormalY);
    expect(arch.minNormalY).toBeLessThan(volcano.minNormalY);
    expect(arch.maxHeightDelta).toBeGreaterThan(terrace.maxHeightDelta);
  });

  it('chooses a deterministic weighted habitat without assigning forbidden morphotypes', () => {
    const available = ['terrace', 'volcano', 'arch', 'rock'] as const;
    const first = chooseReefCoralPreferredSurface({
      seed: 72_041,
      morphotype: 'encrusting',
      availableSurfaceTypes: available,
    });
    const second = chooseReefCoralPreferredSurface({
      seed: 72_041,
      morphotype: 'encrusting',
      availableSurfaceTypes: available,
    });
    const branchingSelections = Array.from({ length: 48 }, (_value, index) => (
      chooseReefCoralPreferredSurface({
        seed: 3_100 + index * 97,
        morphotype: 'branching',
        availableSurfaceTypes: available,
      })
    ));

    expect(second).toBe(first);
    expect(first).not.toBeNull();
    expect(first && reefCoralMorphotypeCanColonizeSurface('encrusting', first)).toBe(true);
    expect(branchingSelections).not.toContain('volcano');
    expect(new Set(branchingSelections).size).toBeGreaterThan(1);
  });
});

describe('volcano coral no-grow zone', () => {
  const envelope = {
    minY: 0,
    maxY: 10,
    maxRadius: 10,
  } as const;

  it('rejects every summit point in the sterile upper quarter', () => {
    const assessment = assessVolcanoCoralLocalPoint(
      { x: 5, y: VOLCANO_CORAL_SUMMIT_NO_GROW_RATIO * 10 + 0.01, z: 0 },
      envelope,
    );

    expect(assessment.allowed).toBe(false);
    expect(assessment.reason).toBe('volcano-summit');
  });

  it('rejects the crater neighbourhood before it reaches the summit cutoff', () => {
    const assessment = assessVolcanoCoralLocalPoint(
      { x: 1, y: 6, z: 0.2 },
      envelope,
    );

    expect(assessment.allowed).toBe(false);
    expect(assessment.reason).toBe('volcano-crater');
  });

  it('keeps lower and middle volcanic slopes available for sparse future colonies', () => {
    const assessment = assessVolcanoCoralLocalPoint(
      { x: 5.4, y: 4.2, z: 0.6 },
      envelope,
    );

    expect(assessment.allowed).toBe(true);
    expect(assessment.surfaceType).toBe('volcano');
  });

  it('uses exact crater metadata when the volcano supplies it', () => {
    const assessment = assessVolcanoCoralLocalPoint(
      { x: 2.2, y: 6, z: 0 },
      { ...envelope, craterRadius: 1.6 },
    );

    expect(assessment.allowed).toBe(false);
    expect(assessment.reason).toBe('volcano-crater');
  });
});
