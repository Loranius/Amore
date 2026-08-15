import { describe, expect, it } from 'vitest';
import { buildReefAccretion, REEF_ACCRETION_MAX_LAYERS, REEF_ACCRETION_VERSION } from './accretion';
import { buildReefComposition } from './composition';
import { buildReefCoralColonies } from './coralColonies';
import { buildReefCore, REEF_CORE_YEAR_DAYS } from './reefCore';
import { buildReefSurfaceSystem } from './surfaceSystem';
import { buildReefYearStructures } from './yearStructures';

const identity = {
  coupleId: 'couple:phase-6',
  relationshipStartDate: '2022-12-26',
};

function phaseAt(years: number, extraDays = 80) {
  const core = buildReefCore({
    ...identity,
    daysTogether: Math.floor(years * REEF_CORE_YEAR_DAYS + extraDays),
  });
  const yearStructures = buildReefYearStructures({ core });
  const composition = buildReefComposition({ core, yearStructures });
  const surfaces = buildReefSurfaceSystem({ core, composition });
  const colonies = buildReefCoralColonies({ core, surfaces });
  const accretion = buildReefAccretion({ core, composition, colonies });
  return { core, yearStructures, composition, surfaces, colonies, accretion };
}

describe('reef accretion phase 6', () => {
  it('is deterministic for identical reef history', () => {
    const first = phaseAt(8).accretion;
    const second = phaseAt(8).accretion;
    expect(second).toEqual(first);
    expect(first.version).toBe(REEF_ACCRETION_VERSION);
  });

  it('gives every baseline colony an encrusting sheet without creating core colonies', () => {
    const { colonies, accretion } = phaseAt(12);
    const sheets = accretion.layers.filter((layer) => layer.kind === 'ENCRUSTING_SHEET');
    expect(sheets).toHaveLength(colonies.colonies.length);
    expect(sheets.every((layer) => layer.anchorId.startsWith('reef:surface:'))).toBe(true);
    expect(sheets.every((layer) => !layer.sourceId.includes('core'))).toBe(true);
  });

  it('keeps accretion identity stable while old material matures', () => {
    const five = phaseAt(5).accretion.layers;
    const nine = phaseAt(9).accretion.layers;
    const laterById = new Map(nine.map((layer) => [layer.id, layer]));
    let compared = 0;

    for (const before of five) {
      const after = laterById.get(before.id);
      if (!after) continue;
      compared += 1;
      expect(after.seed).toBe(before.seed);
      expect(after.kind).toBe(before.kind);
      expect(after.sourceId).toBe(before.sourceId);
      expect(after.anchorId).toBe(before.anchorId);
      expect(after.identitySignature).toBe(before.identitySignature);
      expect(after.radiusX).toBe(before.radiusX);
      expect(after.radiusZ).toBe(before.radiusZ);
      expect(after.thickness).toBe(before.thickness);
      expect(after.growth).toBeGreaterThanOrEqual(before.growth);
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('turns older yearly structures into substrate skirts instead of extra props', () => {
    const { composition, accretion } = phaseAt(10);
    const skirts = accretion.layers.filter((layer) => layer.kind === 'STRUCTURE_SKIRT');
    expect(skirts.length).toBeGreaterThan(0);
    const structureIds = new Set(composition.structures.map((structure) => structure.id));
    expect(skirts.every((layer) => structureIds.has(layer.sourceId))).toBe(true);
    expect(skirts.every((layer) => layer.normal.y === 1)).toBe(true);
  });

  it('adds stacked plates only to plate colonies and preserves their anchor', () => {
    const { colonies, accretion } = phaseAt(25);
    const colonyByPatch = new Map(colonies.colonies.map((colony) => [colony.patchId, colony]));
    const stacks = accretion.layers.filter((layer) => layer.kind === 'PLATE_STACK');
    for (const stack of stacks) {
      const colony = colonyByPatch.get(stack.anchorId);
      expect(colony?.morphotype).toBe('PLATE');
      expect(stack.sourceId).toBe(colony?.sourceId);
      expect(stack.stackIndex === 1 || stack.stackIndex === 2).toBe(true);
    }
  });

  it('contains visible mineral/skeleton transitions in a mature reef', () => {
    const { accretion } = phaseAt(20);
    const transitionLayers = accretion.layers.filter((layer) => (
      layer.kind === 'MINERAL_TRANSITION' || layer.kind === 'SKELETON_BASE'
    ));
    expect(transitionLayers.length).toBeGreaterThan(0);
    expect(transitionLayers.some((layer) => layer.growth > 0.5)).toBe(true);
  });

  it('never exceeds the Phase 6 mobile layer ceiling at fifty years', () => {
    const { accretion } = phaseAt(50, 0);
    expect(accretion.diagnostics.layerCount).toBeLessThanOrEqual(REEF_ACCRETION_MAX_LAYERS);
    expect(accretion.diagnostics.boundedForMobile).toBe(true);
    expect(accretion.diagnostics.visibleLayerCount).toBeGreaterThan(0);
    expect(accretion.diagnostics.coveredSourceCount).toBeGreaterThan(0);
  });
});
