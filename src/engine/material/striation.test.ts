import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { createThreeCrystalMaterial } from '../renderer/three/material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState, striationCount } from './engine';
import type { CrystalMaterialQuality } from './types';

function pipeline(years: number, quality: CrystalMaterialQuality = 'high') {
  const events: EvolutionEventInput[] = [];
  const sources = ['media@1', 'memories@1', 'plans@1', 'wishlist@1', 'map@1', 'calendar@1'];
  for (let index = 0; index < 80; index += 1) {
    events.push({
      id: `event-${index}`,
      occurredAt: new Date(
        Date.UTC(2026, 6, 1) - (index + 1) * ((years * 365) / 80) * 86400000,
      ).toISOString(),
      source: sources[index % sources.length]!,
      evidence: 'verified',
      channels: { remembrance: 0.6, significance: 0.4 },
      portalActivity: 0.3,
    });
  }
  const artifact = buildArtifactBlueprint({
    coupleId: 'striation',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: new Date(Date.UTC(2026, 6, 1) - years * 365.25 * 86400000)
        .toISOString()
        .slice(0, 10),
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-01T00:00:00Z', rulesVersion: '1.0.0' },
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
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
  return { species, composition, material };
}

describe('growth striation — the count', () => {
  it('is one band per year together', () => {
    // Striations *are* growth increments on a real crystal, so the mineral's
    // own texture and the artifact's meaning are the same thing here rather
    // than one dressed as the other. This is also the monarch's only expression
    // of the year count; until now she carried it solely as height.
    expect(striationCount(365 * 7)).toBe(7);
    expect(striationCount(365 * 12)).toBe(12);
    for (let years = 4; years <= 30; years += 1) {
      expect(striationCount(365 * years)).toBe(years);
    }
  });

  it('never leaves the shaft blank or hatched', () => {
    // A couple in their first year would otherwise get one line across the
    // shaft, which reads as a defect rather than as a texture — a crystal has
    // striations from the moment it has a prism face.
    expect(striationCount(0)).toBe(4);
    expect(striationCount(365 * 2)).toBe(4);
    // And the ceiling is where the pattern stops being resolvable on a phone:
    // the monarch stands about 300px tall in portrait, so 36 bands is 8px
    // apart. Past that the shader's derivative fade would be deciding the look
    // instead of the number.
    expect(striationCount(365 * 60)).toBe(36);
    expect(striationCount(365 * 400)).toBe(36);
  });

  it('is monotone and finite on anything', () => {
    let previous = 0;
    for (let days = 0; days < 365 * 50; days += 97) {
      const count = striationCount(days);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
    // Anything that is not a real age falls to the floor rather than the
    // ceiling: an infinite age is a broken input, not an ancient couple, and a
    // crystal hatched with 36 lines would announce the bug on the home screen.
    expect(striationCount(Number.NaN)).toBe(4);
    expect(striationCount(-1000)).toBe(4);
    expect(striationCount(Number.POSITIVE_INFINITY)).toBe(4);
  });
});

describe('growth striation — where it is drawn', () => {
  it('reaches the shaft of every crystal but never the rock', () => {
    const { composition, material } = pipeline(6);
    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));

    let striated = 0;
    for (const body of material.bodies) {
      const role = roleOf.get(body.bodyId);
      if (role === undefined) {
        // The substrate. A striation records the increments a crystal grew in,
        // and this is the stone it grew out of.
        expect(body.shader.striationStrength).toBe(0);
        continue;
      }
      // The smallest bodies are a few pixels wide; a terrace across nine of
      // them is not a texture, it is noise.
      if (role === 'micro') expect(body.shader.striationStrength).toBe(0);
      else {
        expect(body.shader.striationStrength).toBeGreaterThan(0);
        striated += 1;
      }
      expect(body.shader.striationCount).toBe(striationCount(6 * 365.25));
    }
    expect(striated).toBeGreaterThan(0);
  });

  it('is off on the fallback tier and on nothing else', () => {
    for (const quality of ['high', 'balanced', 'low'] as const) {
      const { material } = pipeline(6, quality);
      expect(material.bodies.some((body) => body.shader.striationStrength > 0)).toBe(true);
    }
    const { material } = pipeline(6, 'fallback');
    expect(material.bodies.every((body) => body.shader.striationStrength === 0)).toBe(true);
  });

  it('carries the striation into the compiled shader', () => {
    // The recipe field is only half of it: a term nothing reads is the failure
    // mode Pass 4 found twice in one afternoon. This asserts the uniforms and
    // the branch actually reach the program.
    const { composition, material } = pipeline(6);
    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));
    const focal = material.bodies.find((body) => roleOf.get(body.bodyId) === 'focal')!;
    expect(focal.shader.striationStrength).toBeGreaterThan(0);

    const three = createThreeCrystalMaterial(focal);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    three.onBeforeCompile!(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      null as unknown as THREE.WebGLRenderer,
    );
    const uniforms = shader.uniforms as Record<string, { value: number }>;
    expect(uniforms['uEvolutionStriationStrength']!.value).toBe(focal.shader.striationStrength);
    expect(uniforms['uEvolutionStriationCount']!.value).toBe(focal.shader.striationCount);
    three.dispose();
  });
});
