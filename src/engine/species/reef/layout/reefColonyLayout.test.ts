import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { DEFAULT_REEF_COLONY_LAYOUT_CONFIG } from './config';
import { buildReefColonyLayout } from './reefColonyLayout';

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
    id: 'achievement:home',
    occurredAt: '2024-05-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.86, stability: 0.22 },
    portalActivity: 0.2,
  },
  {
    id: 'memory:first-album',
    occurredAt: '2024-07-02',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.88, culture: 0.16 },
    portalActivity: 0.28,
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
    id: 'culture:concert',
    occurredAt: '2024-10-12',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.9, significance: 0.8 },
    portalActivity: 0.25,
  },
  {
    id: 'shopping:2025-01-06',
    occurredAt: '2025-01-06',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 0.3 },
    portalActivity: 0.02,
  },
];

function buildSpecies(
  events: readonly EvolutionEventInput[] = BASE_EVENTS,
  asOf = '2026-07-01',
) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-layout-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  return buildReefSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion: 'reef-species-v1.0.0' },
  });
}

function buildLayout(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  return buildReefColonyLayout({ species: buildSpecies(events) });
}

describe('Reef Species Phase 2 Colony Layout', () => {
  it('is deterministic and does not mutate the accepted Reef Species blueprint', () => {
    const species = buildSpecies();
    const before = structuredClone(species);
    const first = buildReefColonyLayout({ species });
    const second = buildReefColonyLayout({ species });

    expect(second).toEqual(first);
    expect(species).toEqual(before);
    expect(first.descriptor.id).toBe('reef:colony-layout');
    expect(first.cells).toHaveLength(
      species.grammar.radialBandCount
        * DEFAULT_REEF_COLONY_LAYOUT_CONFIG.azimuthSectorCount,
    );
    expect(first.colonies.length).toBeGreaterThan(10);
    expect(first.diagnostics.acceptedColonyCount).toBe(first.colonies.length);
    expect(new Set(first.colonies.map((colony) => colony.id)).size).toBe(first.colonies.length);
  });

  it('publishes bounded substrate anchors, normalized normals and explicit occupancy', () => {
    const species = buildSpecies();
    const layout = buildReefColonyLayout({ species });
    const cellsById = new Map(layout.cells.map((cell) => [cell.id, cell] as const));
    const padding = species.structure.substrateRadius
      * DEFAULT_REEF_COLONY_LAYOUT_CONFIG.radialPaddingRatio;

    for (const colony of layout.colonies) {
      const cell = cellsById.get(colony.substrateCellId);
      expect(cell).toBeDefined();
      expect(cell?.occupiedColonyIds).toContain(colony.id);
      expect(colony.radialBand).toBeGreaterThanOrEqual(0);
      expect(colony.radialBand).toBeLessThan(species.grammar.radialBandCount);
      expect(colony.verticalBand).toBeGreaterThanOrEqual(0);
      expect(colony.verticalBand).toBeLessThan(species.grammar.verticalBandCount);
      expect(colony.azimuthSectorIndex).toBeGreaterThanOrEqual(0);
      expect(colony.azimuthSectorIndex).toBeLessThan(
        DEFAULT_REEF_COLONY_LAYOUT_CONFIG.azimuthSectorCount,
      );
      expect(colony.radialDistance + colony.footprintRadius).toBeLessThanOrEqual(
        species.structure.substrateRadius - padding + 1e-5,
      );
      expect(Math.hypot(colony.normal.x, colony.normal.y, colony.normal.z)).toBeCloseTo(1, 5);
      expect(colony.currentExposure).toBeGreaterThanOrEqual(0);
      expect(colony.currentExposure).toBeLessThanOrEqual(1);
      expect(colony.targetHeight).toBeGreaterThan(0);
    }

    for (const cell of layout.cells) {
      expect(cell.occupiedColonyIds.length).toBeLessThanOrEqual(cell.capacity);
      expect(Math.hypot(cell.normal.x, cell.normal.y, cell.normal.z)).toBeCloseTo(1, 5);
    }
    expect(layout.diagnostics.occupiedCellIds).toEqual(
      layout.cells.filter((cell) => cell.occupiedColonyIds.length > 0).map((cell) => cell.id),
    );
  });

  it('keeps all accepted colony footprints collision-safe', () => {
    const layout = buildLayout();
    const ratio = DEFAULT_REEF_COLONY_LAYOUT_CONFIG.minimumClearanceRatio;

    for (let leftIndex = 0; leftIndex < layout.colonies.length; leftIndex += 1) {
      const left = layout.colonies[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < layout.colonies.length; rightIndex += 1) {
        const right = layout.colonies[rightIndex];
        if (!right) continue;
        const distance = Math.hypot(
          left.position.x - right.position.x,
          left.position.z - right.position.z,
        );
        expect(distance).toBeGreaterThanOrEqual(
          (left.footprintRadius + right.footprintRadius) * ratio - 1e-5,
        );
      }
    }
    expect(layout.diagnostics.minimumAcceptedClearance).not.toBeNull();
    expect(layout.diagnostics.minimumAcceptedClearance ?? -1).toBeGreaterThanOrEqual(0);
  });

  it('preserves existing colony anchors when later history is appended', () => {
    const base = buildLayout(BASE_EVENTS.slice(0, 4));
    const extended = buildLayout([
      ...BASE_EVENTS.slice(0, 4),
      {
        id: 'memory:summer',
        occurredAt: '2026-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]);
    const extendedById = new Map(
      extended.colonies.map((colony) => [colony.id, colony] as const),
    );

    for (const colony of base.colonies) {
      expect(extendedById.get(colony.id)).toEqual(colony);
    }
    expect(extended.colonies.length).toBeGreaterThan(base.colonies.length);
  });

  it('truncates only newest colony candidates after the accepted colony budget', () => {
    const species = buildSpecies();
    const full = buildReefColonyLayout({ species });
    const constrainedSpecies = {
      ...species,
      grammar: { ...species.grammar, maximumAcceptedColonies: 4 },
    };
    const constrained = buildReefColonyLayout({ species: constrainedSpecies });

    expect(constrained.colonies).toHaveLength(4);
    expect(constrained.colonies).toEqual(full.colonies.slice(0, 4));
    expect(constrained.diagnostics.colonyBudgetReached).toBe(true);
    expect(constrained.diagnostics.truncatedColonyIds.length).toBeGreaterThan(0);
    expect(constrained.diagnostics.truncatedInstructionIds.length).toBeGreaterThan(0);
    expect(constrained.diagnostics.maximumAcceptedColonies).toBe(4);
  });

  it('rejects invalid occupancy configuration', () => {
    const species = buildSpecies();
    expect(() => buildReefColonyLayout({
      species,
      config: { ...DEFAULT_REEF_COLONY_LAYOUT_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefColonyLayout({
      species,
      config: { ...DEFAULT_REEF_COLONY_LAYOUT_CONFIG, azimuthSectorCount: 7 },
    })).toThrow('azimuthSectorCount');
    expect(() => buildReefColonyLayout({
      species,
      config: { ...DEFAULT_REEF_COLONY_LAYOUT_CONFIG, minimumClearanceRatio: 0 },
    })).toThrow('minimumClearanceRatio');
  });
});
