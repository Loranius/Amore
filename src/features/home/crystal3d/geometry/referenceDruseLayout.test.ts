import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ClusterBranch } from '../crystalCluster';
import { applyReferenceDruseLayout } from './referenceDruseLayout';

const UP = new THREE.Vector3(0, 1, 0);

function branch(
  key: string,
  options: Partial<ClusterBranch> = {},
): ClusterBranch {
  return {
    key,
    kind: 'memory',
    hostKey: 'core-0',
    domain: 'memory',
    height: 0.5,
    radiusBottom: 0.07,
    posX: 0.1,
    posY: -0.3,
    posZ: 0.08,
    quatX: 0,
    quatY: 0,
    quatZ: 0,
    quatW: 1,
    colorA: '#d98a4f',
    colorB: '#ffd9a8',
    breathePhase: 0,
    breatheSpeed: 0.5,
    maturity: 1,
    role: 'dominant',
    tier: 'family',
    archetype: 'blade',
    primary: false,
    ...options,
  };
}

const FIXTURE: ClusterBranch[] = [
  branch('__crystal_matrix__', {
    hostKey: null,
    domain: null,
    height: 0.28,
    radiusBottom: 0.34,
    archetype: 'matrix',
    role: 'dominant',
    tier: 'support',
  }),
  branch('core-0', {
    hostKey: '__crystal_matrix__',
    domain: null,
    kind: 'core',
    height: 2.5,
    radiusBottom: 0.2,
    primary: true,
    tier: 'king',
    archetype: 'massive',
  }),
  branch('milestone-1', {
    kind: 'milestone',
    domain: 'connection',
    height: 0.7,
    radiusBottom: 0.1,
    tier: 'support',
    emissive: true,
  }),
  branch('country-1', {
    kind: 'country',
    domain: 'exploration',
    height: 0.65,
    radiusBottom: 0.09,
    tier: 'support',
  }),
  branch('memory-1', { height: 0.32 }),
  branch('memory-1~s0', {
    hostKey: 'memory-1',
    height: 0.21,
    radiusBottom: 0.04,
    role: 'satellite',
    tier: 'companion',
  }),
  branch('memory-1~m0', {
    hostKey: 'memory-1',
    height: 0.1,
    radiusBottom: 0.025,
    role: 'micro',
    tier: 'micro',
  }),
];

function axisOf(value: ClusterBranch): THREE.Vector3 {
  const q = new THREE.Quaternion(value.quatX, value.quatY, value.quatZ, value.quatW);
  return UP.clone().applyQuaternion(q).normalize();
}

function positionOf(value: ClusterBranch): THREE.Vector3 {
  return new THREE.Vector3(value.posX, value.posY, value.posZ);
}

describe('renderer-only reference druse layout', () => {
  it('creates a volumetric monarch, one hero and a basal crown', () => {
    const result = applyReferenceDruseLayout(FIXTURE);
    const monarch = result.find((value) => value.primary)!;
    const hero = result.find((value) => value.key === 'milestone-1')!;
    const family = result.find((value) => value.key === 'memory-1')!;
    const satellite = result.find((value) => value.key === 'memory-1~s0')!;

    expect(monarch.archetype).toBe('prismatic');
    expect(monarch.height).toBeLessThanOrEqual(2.15);
    expect(monarch.height / monarch.radiusBottom).toBeLessThanOrEqual(4.7);

    expect(hero.hostKey).toBe(monarch.key);
    expect(hero.height / monarch.height).toBeGreaterThanOrEqual(0.64);
    expect(hero.height / monarch.height).toBeLessThanOrEqual(0.76);

    const monarchAxis = axisOf(monarch);
    const monarchHeight = monarch.height;
    for (const value of result) {
      if (value.primary || value.archetype === 'matrix' || value.role !== 'dominant') continue;
      const axial = positionOf(value).sub(positionOf(monarch)).dot(monarchAxis);
      expect(axial / monarchHeight, value.key).toBeLessThanOrEqual(0.12);
      expect(value.hostKey).toBe(monarch.key);
      expect(value.archetype).not.toBe('blade');
      expect(value.archetype).not.toBe('tabular');
    }

    expect(satellite.hostKey).toBe(family.key);
    expect(positionOf(satellite).distanceTo(positionOf(family))).toBeLessThan(family.radiusBottom * 1.4);
    expect(axisOf(satellite).y).toBeGreaterThan(0);
  });

  it('is deterministic and never mutates logical renderer input', () => {
    const before = structuredClone(FIXTURE);
    const first = applyReferenceDruseLayout(FIXTURE);
    const second = applyReferenceDruseLayout(FIXTURE);
    expect(second).toEqual(first);
    expect(FIXTURE).toEqual(before);
  });

  it('keeps old visual slots stable when later bodies append', () => {
    const earlier = applyReferenceDruseLayout(FIXTURE);
    const later = applyReferenceDruseLayout([
      ...FIXTURE,
      branch('later-memory', { height: 0.29 }),
      branch('later-memory~m0', {
        hostKey: 'later-memory',
        role: 'micro',
        tier: 'micro',
        height: 0.08,
      }),
    ]);

    for (const oldBranch of earlier) {
      expect(later.find((value) => value.key === oldBranch.key)).toEqual(oldBranch);
    }
  });
});
