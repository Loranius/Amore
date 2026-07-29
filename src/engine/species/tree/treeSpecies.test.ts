import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildOrganicSkeleton } from '../../labs/organic';
import { treeToOrganicField } from './organicAdapter';
import { buildTreeSpeciesBlueprint } from './treeSpecies';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:proposal',
    episodeId: 'relationship:proposal',
    occurredAt: '2024-02-14T19:00:00+02:00',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.95, remembrance: 0.6, stability: 0.45 },
    portalActivity: 0.24,
  },
  {
    id: 'place:lviv',
    occurredAt: '2024-08-10T12:00:00+03:00',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.85, remembrance: 0.3, culture: 0.2 },
    portalActivity: 0.32,
  },
  {
    id: 'wish:camera',
    episodeId: 'wish:camera:fulfillment',
    occurredAt: '2025-01-05T14:00:00+02:00',
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.65, significance: 0.62, stability: 0.16 },
    portalActivity: 0.24,
  },
  {
    id: 'shopping:2025-01-06',
    occurredAt: '2025-01-06',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 0.08 },
    portalActivity: 0.02,
  },
];

function buildArtifact(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  return buildArtifactBlueprint({
    coupleId: 'amore:test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function buildTree(
  events: readonly EvolutionEventInput[] = BASE_EVENTS,
  asOf = '2025-07-01',
) {
  return buildTreeSpeciesBlueprint({
    artifact: buildArtifact(events),
    config: { asOf, rulesVersion: 'tree-1.0.0' },
  });
}

function withoutMaturity<T extends { maturity: number }>(value: T): Omit<T, 'maturity'> {
  const { maturity: _maturity, ...stable } = value;
  return stable;
}

describe('Tree Species', () => {
  it('is deterministic regardless of source event order', () => {
    expect(buildTree([...BASE_EVENTS].reverse())).toEqual(buildTree());
  });

  it('translates anniversaries and event channels into stable branch intent', () => {
    const tree = buildTree();

    expect({
      species: `${tree.species}@${tree.speciesBlueprintVersion}`,
      stage: tree.state.stage,
      annual: tree.diagnostics.annualInstructionCount,
      growth: tree.growth.map(
        (instruction) => `${instruction.id}:${instruction.kind}:${instruction.tier}:${instruction.attractorCount}`,
      ),
    }).toMatchInlineSnapshot(`
      {
        "annual": 1,
        "growth": [
          "tree:event:calendar:proposal:landmark:support:3",
          "tree:event:place:lviv:explorer:companion:2",
          "tree:annual:1:annual-bough:family:1",
          "tree:event:wish:camera:crown:companion:2",
          "tree:event:shopping:2025-01-06:support:micro:1",
        ],
        "species": "tree@1",
        "stage": "young",
      }
    `);
  });

  it('keeps existing branch intent byte-stable when a later event is appended', () => {
    const base = buildTree(BASE_EVENTS.slice(0, 3));
    const extended = buildTree([
      ...BASE_EVENTS.slice(0, 3),
      {
        id: 'memory:summer',
        occurredAt: '2025-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]);

    const existingIds = new Set(base.growth.map((instruction) => instruction.id));
    expect(extended.growth.filter((instruction) => existingIds.has(instruction.id))).toEqual(base.growth);
    expect(extended.structure).toEqual(base.structure);
  });

  it('lets time add annual growth and maturity without moving old morphology', () => {
    const earlier = buildTree(BASE_EVENTS, '2025-07-01');
    const later = buildTree(BASE_EVENTS, '2026-07-01');

    expect(later.structure).toEqual(earlier.structure);
    expect(later.diagnostics.annualInstructionCount).toBe(2);
    expect(earlier.diagnostics.annualInstructionCount).toBe(1);

    for (const before of earlier.growth) {
      const after = later.growth.find((instruction) => instruction.id === before.id);
      expect(after).toBeDefined();
      expect(withoutMaturity(after!)).toEqual(withoutMaturity(before));
      expect(after!.maturity).toBeGreaterThanOrEqual(before.maturity);
    }
  });

  it('diagnoses future and zero-pressure facts without growing branches from them', () => {
    const tree = buildTree([
      ...BASE_EVENTS,
      {
        id: 'future:trip',
        occurredAt: '2027-01-01',
        source: 'plans@1',
        evidence: 'verified',
        channels: { exploration: 1 },
      },
      {
        id: 'activity-only',
        occurredAt: '2025-02-01',
        source: 'legacy@1',
        evidence: 'historical-estimate',
        channels: {},
        portalActivity: 0.2,
      },
    ]);

    expect(tree.diagnostics.futureEventIds).toEqual(['future:trip']);
    expect(tree.diagnostics.zeroPressureEventIds).toEqual(['activity-only']);
    expect(tree.growth.some((instruction) => instruction.sourceEventId === 'future:trip')).toBe(false);
    expect(tree.growth.some((instruction) => instruction.sourceEventId === 'activity-only')).toBe(false);
    expect(tree.state.eventCount).toBe(BASE_EVENTS.length + 1);
  });

  it('preserves organic attractors and skeleton nodes when later growth is appended', () => {
    const baseTree = buildTree(BASE_EVENTS.slice(0, 3));
    const extendedTree = buildTree([
      ...BASE_EVENTS.slice(0, 3),
      {
        id: 'memory:summer',
        occurredAt: '2025-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
      },
    ]);
    const baseField = treeToOrganicField(baseTree);
    const extendedField = treeToOrganicField(extendedTree);
    const baseSkeleton = buildOrganicSkeleton({
      seed: baseField.seed,
      attractors: baseField.attractors,
      config: baseField.skeletonConfig,
    });
    const extendedSkeleton = buildOrganicSkeleton({
      seed: extendedField.seed,
      attractors: extendedField.attractors,
      config: extendedField.skeletonConfig,
    });

    expect(extendedField.attractors.slice(0, baseField.attractors.length)).toEqual(baseField.attractors);
    expect(extendedSkeleton.nodes.slice(0, baseSkeleton.nodes.length)).toEqual(baseSkeleton.nodes);
  });

  it('truncates only the newest instructions at an explicit adapter budget', () => {
    const field = treeToOrganicField(buildTree(), {
      rulesVersion: 'test-cap',
      maxAttractors: 4,
      maxNodes: 80,
      maxGeneration: 3,
      maxBranchSegments: 8,
    });

    expect(field.attractors).toHaveLength(4);
    expect(field.attractors.map((attractor) => attractor.id)).toEqual([
      'tree:event:calendar:proposal:attractor:0',
      'tree:event:calendar:proposal:attractor:1',
      'tree:event:calendar:proposal:attractor:2',
      'tree:event:place:lviv:attractor:0',
    ]);
    expect(field.diagnostics.truncatedInstructionIds).toEqual([
      'tree:event:place:lviv',
      'tree:annual:1',
      'tree:event:wish:camera',
      'tree:event:shopping:2025-01-06',
    ]);
  });
});
