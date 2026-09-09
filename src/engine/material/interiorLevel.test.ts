import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { createThreeCrystalMaterial } from '../renderer/three/material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';
import type { CrystalMaterialQuality } from './types';

/*
 * ВИМОГА (ADR-0175): нутро грані темне, обвід світлий.
 *
 * Виміряно на живому кадрі, чому це окрема вимога: у стовбурі монарха
 * найтемніша грань стояла на 75% яскравості екрана, найсвітліші — на 93%
 * із насиченістю 0.23. Тіло сиділо на плечі кривої тонування, де
 * заслужений колір (ADR-0004) вицвітає в білий, і власник назвав це
 * «сирим». Еталонні камені (`amore-crystal-look`) влаштовані навпаки.
 *
 * Тут стережуться дві половини цього, бо кожна поодинці дає гірший кадр,
 * ніж було: сам множник (без нього нічого не темніє) і його МІСЦЕ в
 * шейдері — перед обводом. Опущене разом із обводом тіло читається
 * силуетом, а не кристалом.
 */

const SEED_YEAR = '2011-03-04T09:00:00Z';

function events(): EvolutionEventInput[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `interior-${index}`,
    occurredAt: `${2001 + Math.floor(index / 6)}-0${(index % 6) + 1}-12T10:00:00Z`,
    source: index % 2 === 0 ? 'memories@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, achievement: 0.5 },
    portalActivity: 0.4,
  }));
}

function build(quality: CrystalMaterialQuality) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'interior-level',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: events(),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: SEED_YEAR, rulesVersion: '1.0.0' },
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
  return buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
}

/** Скомпільований фрагмент — так само, як його збирає three. */
function fragmentOf(material: THREE.MeshPhysicalMaterial): string {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'void main() {\n#include <roughnessmap_fragment>\n#include <opaque_fragment>\n}',
  };
  material.onBeforeCompile(shader as never, null as never);
  return shader.fragmentShader;
}

describe('рівень нутра грані', () => {
  it('опускає нутро кристала на кожному рівні якості', () => {
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      for (const body of build(quality).bodies) {
        if (body.bodyId === 'crystal:substrate') continue;
        expect(body.shader.interiorLevel, `${quality} ${body.bodyId}`).toBeLessThan(1);
        // Нижче половини тіло перестає бути каменем пари й стає силуетом:
        // при 0.55 найтемніша грань стоїть на 0.58 значення, і це вже межа.
        expect(body.shader.interiorLevel, `${quality} ${body.bodyId}`).toBeGreaterThan(0.4);
      }
    }
  });

  it('не чіпає камінь підкладки', () => {
    const substrate = build('high').bodies.find((body) => body.bodyId === 'crystal:substrate');
    expect(substrate).toBeDefined();
    expect(substrate?.shader.interiorLevel).toBe(1);
  });

  it('множить ПЕРЕД обводом, а не після', () => {
    const body = build('high').bodies.find((entry) => entry.bodyId === 'crystal:mother');
    expect(body).toBeDefined();
    const fragment = fragmentOf(createThreeCrystalMaterial(body!));
    const level = fragment.indexOf('outgoingLight *= uEvolutionInteriorLevel');
    const rim = fragment.indexOf('outgoingLight += evolutionEdgePaint');
    expect(level).toBeGreaterThan(0);
    expect(rim).toBeGreaterThan(0);
    // Порядок і є вимога: обвід, помножений на рівень, гасне разом із
    // нутром, і темне тіло без світлого ребра читається силуетом.
    expect(rim).toBeGreaterThan(level);
  });

  it('розводить по різних програмах тіла з різним рівнем нутра', () => {
    /*
     * Ключ програми, а не лише уніформа. Батч ділить ОДИН матеріал, тож
     * якщо колись з'явиться тіло з іншим рівнем нутра, воно не має
     * потрапити в чужий батч і засвітитись чужим рівнем — та сама пастка,
     * яку коментар про `innerFlowStrength` уже описав у підписі матеріалу.
     */
    const body = build('high').bodies.find((entry) => entry.bodyId === 'crystal:mother')!;
    const brighter = { ...body, shader: { ...body.shader, interiorLevel: 1 } };
    const keyOf = (source: typeof body) => {
      const material = createThreeCrystalMaterial(source);
      return material.customProgramCacheKey();
    };
    expect(keyOf(brighter)).not.toBe(keyOf(body));
  });
});
