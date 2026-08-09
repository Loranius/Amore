import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { CRYSTAL_SUBSTRATE_BODY_ID } from '../geometry/substrate';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';

function pipeline(options: { events: number; spacingDays: number }) {
  const events: EvolutionEventInput[] = [];
  const sources = ['media@1', 'memories@1', 'plans@1', 'wishlist@1', 'map@1', 'calendar@1'];
  for (let index = 0; index < options.events; index += 1) {
    events.push({
      id: `event-${index}`,
      occurredAt: new Date(
        Date.UTC(2026, 6, 1) - (index + 1) * options.spacingDays * 86400000,
      ).toISOString(),
      source: sources[index % sources.length]!,
      evidence: 'verified',
      channels: { remembrance: 0.6, significance: 0.4 },
      portalActivity: 0.3,
    });
  }
  const artifact = buildArtifactBlueprint({
    coupleId: 'zoning',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-12-26',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-08-09T00:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: DEFAULT_CRYSTAL_MATERIAL_CONFIG,
  });
  return { species, composition, material };
}

/**
 * The zoning amplitude, evaluated the way the shader evaluates it.
 *
 * `zoning = 1 + (zone − 0.5) · 2 · density` multiplies the inner light, so the
 * amplitude is what decides whether a body reads as a stone with stages in it or
 * as one flat tone. This mirror exists because the number is the whole point of
 * the change and a recipe field nothing reads is the failure mode four passes
 * in a row have now turned up.
 */
const swing = (density: number): number => 2 * density;

describe('Crystal material — zoning inside the stone', () => {
  it('gives every crystal a zoning swing wide enough to read', () => {
    // Measured on the live portal by zeroing the term and diffing: the old
    // thresholded band moved 0.42 of 255 on average over 7% of the artifact's
    // pixels, which is Pass 1's "no zoning, no inclusion depth at portal size"
    // as a number. After the change it moves 1.97 over 34% of them, and the
    // broad variation inside a single facet rose 13%.
    const { composition, material } = pipeline({ events: 120, spacingDays: 11 });
    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));

    let checked = 0;
    for (const body of material.bodies) {
      if (body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
      const role = roleOf.get(body.bodyId);
      if (role === 'micro' || role === undefined) continue;
      // Never one flat tone: the floor is what stops a couple with a spotless
      // history getting a body with no stages in it at all.
      expect(swing(body.shader.inclusionDensity)).toBeGreaterThan(0.9);
      // And never so wide that a zone snuffs the inner light out entirely.
      expect(swing(body.shader.inclusionDensity)).toBeLessThanOrEqual(2);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('clouds a fractured history more than a settled one', () => {
    // The amplitude still carries meaning — it is not a constant wearing a
    // derivation's name. A couple who logged in bursts and went quiet gets a
    // stone with more distinct stages in it than one who showed up steadily.
    // The burst is a real burst: 240 entries inside a month, then silence.
    // A first attempt used two-day spacing, which still spans sixteen months
    // and left both couples on the same consistency — the test passed nothing.
    const bursty = pipeline({ events: 240, spacingDays: 0.12 });
    const steady = pipeline({ events: 120, spacingDays: 11 });
    const monarchOf = (result: ReturnType<typeof pipeline>) =>
      result.material.bodies.find((body) => body.bodyId === 'crystal:mother')!;

    expect(bursty.species.state.consistency).toBeLessThan(steady.species.state.consistency);
    expect(monarchOf(bursty).shader.inclusionDensity)
      .toBeGreaterThan(monarchOf(steady).shader.inclusionDensity);
    // And the derivation has to stay off its own ceiling, or it stops being a
    // derivation. Measured: 0.986 for the burst, 0.796 for the steady couple —
    // a quarter of the range apart, neither clamped. At the first slope tried
    // both came out at 1.0 and the number meant nothing.
    expect(monarchOf(bursty).shader.inclusionDensity).toBeLessThan(1);
    expect(
      monarchOf(bursty).shader.inclusionDensity - monarchOf(steady).shader.inclusionDensity,
    ).toBeGreaterThan(0.1);
  });

  it('keeps the boundary sharpness a fraction, so a zone edge is an edge', () => {
    // `contrast` now mixes the smooth band toward a step. Outside 0..1 the mix
    // extrapolates, which puts the zone outside the range the swing is bounded
    // against and can drive the inner light negative.
    const { material } = pipeline({ events: 120, spacingDays: 11 });
    for (const body of material.bodies) {
      expect(body.shader.inclusionContrast).toBeGreaterThanOrEqual(0);
      expect(body.shader.inclusionContrast).toBeLessThanOrEqual(1);
    }
  });

  it('leaves the rock alone', () => {
    // A zone records a stage the crystal grew in. The substrate is the stone it
    // grew out of, and its inner light is two hundredths of a crystal's.
    const { material } = pipeline({ events: 120, spacingDays: 11 });
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
    expect(rock.shader.coreStrength).toBeLessThan(0.05);
  });
});
