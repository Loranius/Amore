import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import {
  CRYSTAL_SUBSTRATE_BODY_ID,
  DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  buildCrystalGeometry,
} from '../../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../../growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../../species/crystal';
import {
  createThreeCrystalRenderBundle,
  setThreeCrystalBodyVisible,
  type ThreeCrystalRenderBundle,
} from './bundle';

const AS_OF = '2026-07-01T12:00:00Z';

function events(startYear: number): EvolutionEventInput[] {
  return [
    {
      id: 'proposal',
      occurredAt: `${startYear}-06-14T18:00:00Z`,
      source: 'calendar@1',
      evidence: 'verified',
      channels: { significance: 1, stability: 0.72, remembrance: 0.58 },
      portalActivity: 0.5,
    },
    {
      id: 'trip',
      occurredAt: `${startYear + 1}-06-10T10:00:00Z`,
      source: 'plans@1',
      evidence: 'verified',
      channels: { exploration: 0.92, remembrance: 0.36 },
      portalActivity: 0.3,
    },
  ];
}

function fitFor(
  startedAt: string,
  startYear: number,
  inspect?: (bundle: ThreeCrystalRenderBundle) => void,
) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'crystal-fit-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: startedAt,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: events(startYear),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: AS_OF, rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'balanced' },
  });
  const bundle = createThreeCrystalRenderBundle(geometry, material);
  inspect?.(bundle);
  const fit = bundle.fit;
  const renderedHeight = fit.sourceSize.y * fit.scale;
  bundle.dispose();
  return { fit, renderedHeight };
}

describe('crystal render fit', () => {
  it('renders a longer relationship visibly larger than a young one', () => {
    // The whole point of the artifact is that it grows with the relationship.
    // The fit used to scale every crystal to fill the frame, which made a
    // 3-year and a 10-year couple render at identical on-screen size and
    // silently cancelled the growth the engine had computed.
    const young = fitFor('2023-06-14', 2023);
    const old = fitFor('2016-06-14', 2016);

    expect(old.renderedHeight).toBeGreaterThan(young.renderedHeight * 1.1);
  });

  it('scales by a fixed reference so size reflects the crystal, not the frame', () => {
    const young = fitFor('2023-06-14', 2023);
    const older = fitFor('2021-06-14', 2021);

    // Neither is large enough to need clamping, so both take the same scale
    // factor — the on-screen difference comes from the geometry itself.
    // (A much older couple does get clamped: since ADR-0004 the ring of
    // annual crystals genuinely outgrows the frame eventually, which the
    // overflow test below covers.)
    expect(young.fit.clamped).toBe(false);
    expect(older.fit.clamped).toBe(false);
    expect(young.fit.scale).toBeCloseTo(young.fit.referenceScale, 6);
    expect(older.fit.scale).toBeCloseTo(young.fit.scale, 6);
  });

  it('never lets a crystal overflow the frame', () => {
    // The reference scale is a target, not a licence to spill: whatever the
    // couple's history, the artifact still has to fit its container.
    for (const started of ['2023-06-14', '2016-06-14', '2006-06-14']) {
      const startYear = Number(started.slice(0, 4));
      const { fit } = fitFor(started, startYear);
      expect(fit.sourceSize.y * fit.scale).toBeLessThanOrEqual(fit.targetHeight + 1e-6);
      expect(Math.max(fit.sourceSize.x, fit.sourceSize.z) * fit.scale)
        .toBeLessThanOrEqual(fit.targetWidth + 1e-6);
      expect(fit.scale).toBeLessThanOrEqual(fit.referenceScale + 1e-6);
    }
  });

  it('can omit only the substrate as a renderer presentation choice', () => {
    fitFor('2022-06-14', 2022, (bundle) => {
      expect(setThreeCrystalBodyVisible(bundle, CRYSTAL_SUBSTRATE_BODY_ID, false)).toBe(true);

      let hiddenSubstrate = 0;
      let visibleCrystals = 0;
      for (const batch of bundle.batches) {
        batch.bodyIds.forEach((bodyId, instanceId) => {
          if (bodyId === CRYSTAL_SUBSTRATE_BODY_ID) {
            expect(batch.mesh.getVisibleAt(instanceId)).toBe(false);
            hiddenSubstrate += 1;
          } else {
            expect(batch.mesh.getVisibleAt(instanceId)).toBe(true);
            visibleCrystals += 1;
          }
        });
      }

      expect(hiddenSubstrate).toBe(1);
      expect(visibleCrystals).toBeGreaterThan(0);
    });
  });
});
