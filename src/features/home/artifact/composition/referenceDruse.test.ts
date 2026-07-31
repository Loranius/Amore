import { describe, expect, it } from 'vitest';
import type {
  ColonyRole,
  CompositionTier,
  DepositedCrystal,
  NodeKind,
} from '../artifactTypes';
import { MATURITY_HEIGHT_SCALE } from '../growthSurface';
import { dot, sub, v3 } from '../vec3';
import { applyReferenceDruseComposition } from './referenceDruse';

function body(
  key: string,
  options: {
    kind?: NodeKind;
    role?: ColonyRole;
    tier?: CompositionTier;
    length?: number;
    radius?: number;
    primary?: boolean;
    emphasized?: boolean;
  } = {},
): DepositedCrystal {
  const role = options.role ?? 'dominant';
  return {
    key,
    kind: options.kind ?? 'memory',
    domain: options.kind === 'core' ? null : 'memory',
    anchor: v3(0.12, -0.2, 0.04),
    renderedAnchor: v3(0.12, -0.2, 0.04),
    direction: v3(0.08, 0.98, 0.06),
    length: options.length ?? 0.45,
    radius: options.radius ?? 0.06,
    maturity: 1,
    ageDays: 900,
    growthEnergy: 0.9,
    colonyId: key,
    role,
    attachment: {
      hostKey: options.primary ? null : 'old-host',
      contactPoint: v3(0.1, 0.4, 0),
      contactNormal: v3(1, 0, 0),
      hostT: 0.55,
      hostAngle: 1.2,
    },
    primary: options.primary ?? false,
    tier: options.tier ?? (options.primary ? 'king' : role === 'micro' ? 'micro' : 'family'),
    archetype: options.primary ? 'massive' : 'blade',
    ...(options.emphasized === undefined ? {} : { emphasized: options.emphasized }),
    breathePhase: 0,
    breatheSpeed: 0.5,
    spin: 0,
  };
}

const FIXTURE: DepositedCrystal[] = [
  body('core-0', { kind: 'core', primary: true, length: 2.42, radius: 0.2 }),
  body('milestone-1', {
    kind: 'milestone',
    tier: 'support',
    length: 0.72,
    radius: 0.1,
    emphasized: true,
  }),
  body('country-1', { kind: 'country', tier: 'support', length: 0.82, radius: 0.11 }),
  body('memory-1', { length: 0.32, radius: 0.05 }),
  body('memory-1~s0', { role: 'satellite', tier: 'companion', length: 0.21, radius: 0.04 }),
  body('memory-1~m0', { role: 'micro', tier: 'micro', length: 0.1, radius: 0.025 }),
];

describe('reference druse composition', () => {
  it('builds one volumetric monarch, one hero spire and a basal crown', () => {
    const result = applyReferenceDruseComposition(FIXTURE, 12345);
    const monarch = result.find((entry) => entry.primary)!;
    const hero = result.find((entry) => entry.key === 'milestone-1')!;

    expect(monarch.archetype).toBe('prismatic');
    expect(monarch.length).toBeLessThanOrEqual(2.15);
    expect(monarch.length / monarch.radius).toBeLessThanOrEqual(4.85);

    expect(hero.tier).toBe('support');
    expect(hero.archetype).toBe('prismatic');
    expect(hero.length / monarch.length).toBeGreaterThanOrEqual(0.62);
    expect(hero.length / monarch.length).toBeLessThanOrEqual(0.78);

    const renderedHeight = monarch.length * MATURITY_HEIGHT_SCALE(monarch.maturity);
    for (const entry of result) {
      if (entry.primary) continue;
      expect(entry.attachment?.hostKey).toBe(monarch.key);
      expect(entry.attachment?.hostT).toBeLessThanOrEqual(0.11);
      expect(entry.direction.y).toBeGreaterThan(0);
      expect(entry.archetype).not.toBe('blade');
      expect(entry.archetype).not.toBe('tabular');

      const axial = dot(sub(entry.renderedAnchor, monarch.renderedAnchor), monarch.direction);
      expect(axial / renderedHeight).toBeLessThanOrEqual(0.12);
    }
  });

  it('is deterministic and does not mutate its input', () => {
    const before = structuredClone(FIXTURE);
    const first = applyReferenceDruseComposition(FIXTURE, 9876);
    const second = applyReferenceDruseComposition(FIXTURE, 9876);

    expect(second).toEqual(first);
    expect(FIXTURE).toEqual(before);
  });

  it('keeps existing crown slots stable when a later body is appended', () => {
    const earlier = applyReferenceDruseComposition(FIXTURE, 2026);
    const later = applyReferenceDruseComposition(
      [
        ...FIXTURE,
        body('later-memory', { kind: 'memory', length: 0.28, radius: 0.045 }),
        body('later-memory~m0', { role: 'micro', tier: 'micro', length: 0.08, radius: 0.02 }),
      ],
      2026,
    );

    for (const oldBody of earlier) {
      expect(later.find((entry) => entry.key === oldBody.key)).toEqual(oldBody);
    }
  });
});
