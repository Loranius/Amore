import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { EVOLUTION_CHANNELS, type EvolutionChannel } from '../evolution/types';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';
import { CRYSTAL_FACET_TINTING } from './facets';
import type { CrystalMaterialQuality, CrystalRgb } from './types';

// The brief's section 6, held as assertions rather than as a paragraph.
//
// The whole crystal stays in one rose/amethyst family from any angle. The only
// permitted difference between two faces is the brightness of that one colour:
// no yellow back faces, no gold, no thin-film, no per-face hue drift.

/** A couple whose history is dominated by one pressure channel. */
function events(channel: EvolutionChannel): EvolutionEventInput[] {
  const sources: Record<EvolutionChannel, string> = {
    achievement: 'plans@1',
    remembrance: 'memories@1',
    exploration: 'map@1',
    culture: 'media@1',
    stability: 'calendar@1',
    significance: 'wishlist@1',
  };
  return Array.from({ length: 24 }, (_, index) => ({
    id: `${channel}-${index}`,
    occurredAt: `${2001 + Math.floor(index / 6)}-0${(index % 6) + 1}-12T10:00:00Z`,
    source: sources[channel],
    evidence: 'verified' as const,
    // One channel far above the rest, so `dominantChannel` is this one.
    channels: { [channel]: 0.94 } as Partial<Record<EvolutionChannel, number>>,
    portalActivity: 0.4,
  }));
}

function build(channel: EvolutionChannel, quality: CrystalMaterialQuality = 'high') {
  const artifact = buildArtifactBlueprint({
    coupleId: `palette:${channel}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: events(channel),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2006-01-02T09:00:00Z', rulesVersion: '1.0.0' },
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
  return buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
}

/** Yellow needs green high against blue. Nothing in the family may do that. */
function isYellowish(color: CrystalRgb): boolean {
  return color.g > color.b + 0.06 && color.r > color.b + 0.06;
}

describe('one rose/amethyst palette (crystal cluster brief §6)', () => {
  it('never lets any published colour drift yellow, whatever the dominant channel', () => {
    // The set this guards against spanned the wheel: amber for achievement,
    // cyan for exploration, green for stability. Since the palette mixes the
    // dominant channel into the shell, a couple who travelled a lot got a cyan
    // crystal — and a warm channel put yellow on the faces turned away from the
    // key light, which is the owner's original "golden side".
    for (const channel of EVOLUTION_CHANNELS) {
      const state = build(channel);
      for (const body of state.bodies) {
        const label = `${channel} ${body.bodyId}`;
        expect(isYellowish(body.baseColor), `${label} shell`).toBe(false);
        expect(isYellowish(body.emissiveColor), `${label} emissive`).toBe(false);
        expect(isYellowish(body.shader.rimColor), `${label} rim`).toBe(false);
        expect(isYellowish(body.shader.coreColor), `${label} core`).toBe(false);
        expect(isYellowish(body.shader.skyColor), `${label} sky`).toBe(false);
        expect(isYellowish(body.shader.groundColor), `${label} ground`).toBe(false);
        expect(isYellowish(body.shader.footColor), `${label} foot`).toBe(false);
      }
    }
  });

  it('keeps every body of one couple on the same hue', () => {
    // Not merely "no yellow": one family. Measured as the angle between two
    // shells in the red-blue plane — a difference in *value* moves both
    // channels together and leaves the ratio alone.
    for (const channel of EVOLUTION_CHANNELS) {
      const state = build(channel);
      const ratios = state.bodies
        .filter((body) => body.bodyId !== 'crystal:substrate')
        .map((body) => body.baseColor.r / Math.max(1e-6, body.baseColor.b));
      const spread = Math.max(...ratios) / Math.min(...ratios);
      expect(spread, channel).toBeLessThan(1.08);
    }
  });

  it('carries no thin-film iridescence at any quality tier', () => {
    // Thin-film is a hue shift by construction: at the 284–545 nm film this
    // crystal used to carry it put gold on one facet and green on the next.
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      for (const body of build('remembrance', quality).bodies) {
        expect(body.iridescence, `${quality} ${body.bodyId}`).toBe(0);
      }
    }
  });

  it('separates faces by brightness alone', () => {
    // The permitted difference between two faces of one crystal. Each tone is
    // a single number applied to all three channels, so a face can be darker
    // or brighter but never a different colour.
    for (const tint of CRYSTAL_FACET_TINTING.tints) {
      expect(tint.g, JSON.stringify(tint)).toBe(tint.r);
      expect(tint.b, JSON.stringify(tint)).toBe(tint.r);
    }
    /*
     * Золотий список рухався один раз, і ось семантика зміни (ADR-0120).
     *
     * Було `[0.73, 1, 1.18, 1.3]` у порядку циклу `1.0 / 0.73 / 1.18 / 1.30`.
     * Тон роздається за РАНГОМ грані в колі, тож різниця між сусідами — це
     * крок циклу: 27%, 62%, 10%, 23%. Два світлі тони поспіль давали чверть
     * усіх сусідніх пар різницю в десять відсотків — саме ту, яку
     * `amore-crystal-look` називає «читається гладкою формою».
     *
     * Стало `1.16 / 0.68 / 1.38 / 0.78`: темний і світлий чергуються, кроки
     * 41%, 103%, 44%, 49%. Виміряно на живій сцені — медіана розділення
     * сусідніх плато в тілі 11% → 16%, найбільша 54% → 46%.
     */
    const values = CRYSTAL_FACET_TINTING.tints.map((tint) => tint.r).sort((a, b) => a - b);
    expect(values).toEqual([0.68, 0.78, 1.16, 1.38]);
  });

  it('stays opaque, unlit by gold, and inside the brief’s physical bands', () => {
    // The shell only. The substrate is rock rather than gem and carries its own
    // band — asserting a polished stone's roughness on it would be asserting
    // that the vein is glass.
    for (const body of build('culture').bodies) {
      if (body.bodyId === 'crystal:substrate') continue;
      const label = body.bodyId;
      expect(body.metalness, label).toBe(0);
      expect(body.transmission, label).toBe(0);
      expect(body.opacity, label).toBe(1);
      expect(body.transparent, label).toBe(false);
      expect(body.depthWrite, label).toBe(true);
      expect(body.roughness, label).toBeGreaterThanOrEqual(0.1);
      expect(body.roughness, label).toBeLessThanOrEqual(0.16);
      expect(body.clearcoat, label).toBeGreaterThanOrEqual(0.75);
      expect(body.clearcoat, label).toBeLessThanOrEqual(0.95);
      expect(body.clearcoatRoughness, label).toBeGreaterThanOrEqual(0.03);
      expect(body.clearcoatRoughness, label).toBeLessThanOrEqual(0.07);
      expect(body.ior, label).toBeGreaterThanOrEqual(1.52);
      expect(body.ior, label).toBeLessThanOrEqual(1.58);
      expect(body.reflectivity, label).toBeGreaterThanOrEqual(0.74);
      expect(body.reflectivity, label).toBeLessThanOrEqual(1);
      expect(body.emissiveIntensity, label).toBeGreaterThanOrEqual(0.02);
      expect(body.emissiveIntensity, label).toBeLessThanOrEqual(0.06);
    }
  });
});
