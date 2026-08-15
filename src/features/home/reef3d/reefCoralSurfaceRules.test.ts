import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  assessVolcanoCoralLocalPoint,
  classifyReefCoralSurface,
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
