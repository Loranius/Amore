import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../../growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../../species/crystal';
import { createThreeCrystalGeometry } from './bufferGeometry';

/*
 * ЧИ ФАРБА ГРАНІ ДОХОДИТЬ ДО МЕША — питання, на яке досі відповідали лише
 * знімком, і знімок відповідав неправильно (ADR-0174).
 *
 * `amore-crystal-look`: сусідні грані мають різнитися на 30%+. Тон їде
 * атрибутом `evolutionFacetTone` за РАНГОМ грані в поясі (ADR-0086), і
 * три попередні ключі були зламані так, що сусіди діставали один тон.
 * Тут це перевіряється на самій геометрії — без браузера, без тонування,
 * без острова в кадрі, тобто без жодного з того, чим вимір уже брехав.
 *
 * Насіння записане: 7, рік 2011 для пари, що почалась 2000-01-01.
 */

const SEED = 7;

function events(): EvolutionEventInput[] {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `facet-tone-${index}`,
    occurredAt: `${2001 + Math.floor(index / 8)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
}

function monarch() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'facet-tone',
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
    config: { asOf: '2011-03-04T09:00:00Z', rulesVersion: '1.0.0' },
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
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
  });
  const mesh = geometry.meshes.find((entry) => entry.bodyId === 'crystal:mother')
    ?? geometry.meshes[0]!;
  const body = material.bodies.find((entry) => entry.bodyId === mesh.bodyId)
    ?? material.bodies[0]!;
  return { mesh, body };
}

/** Бічні грані призми, по одній на грань, за азимутом. */
function shaftFaces(): { azimuth: number; tone: number }[] {
  const { mesh, body } = monarch();
  const geometry = createThreeCrystalGeometry(mesh, body, SEED);
  const tone = geometry.getAttribute('evolutionFacetTone');
  const byFace = new Map<number, { azimuth: number; tone: number }>();
  for (let triangle = 0; triangle * 3 < mesh.indices.length; triangle += 1) {
    const vertex = mesh.indices[triangle * 3] ?? 0;
    const nx = mesh.normals[vertex * 3] ?? 0;
    const ny = mesh.normals[vertex * 3 + 1] ?? 0;
    const nz = mesh.normals[vertex * 3 + 2] ?? 0;
    // Пояс стінки: нормаль дивиться вбік, а не вгору й не вниз.
    if (Math.abs(ny) > 0.2) continue;
    const face = mesh.faceIds?.[triangle] ?? 0;
    if (byFace.has(face)) continue;
    byFace.set(face, { azimuth: Math.atan2(nz, nx), tone: tone.getX(vertex) });
  }
  return [...byFace.values()].sort((left, right) => left.azimuth - right.azimuth);
}

describe('фарба грані доходить до геометрії', () => {
  it('пише атрибут на кожну вершину', () => {
    const { mesh, body } = monarch();
    const geometry = createThreeCrystalGeometry(mesh, body, SEED);
    const tone = geometry.getAttribute('evolutionFacetTone');
    expect(tone).toBeDefined();
    expect(tone.count).toBe(mesh.positions.length / 3);
    // Геометрія розрізана по гранях — інакше вершина належала б двом
    // граням і не могла б нести власний тон (`amore-crystal-look`).
    expect(mesh.positions.length / 3).toBe(mesh.indices.length);
  });

  it('дає сусіднім бічним граням тони, що різняться щонайменше на 30%', () => {
    const faces = shaftFaces();
    expect(faces.length).toBeGreaterThanOrEqual(6);
    const steps: number[] = [];
    for (let index = 1; index < faces.length; index += 1) {
      const low = Math.min(faces[index - 1]!.tone, faces[index]!.tone);
      const high = Math.max(faces[index - 1]!.tone, faces[index]!.tone);
      steps.push((high - low) / high);
    }
    // Найслабша пара з усього кола, а не медіана: одна пара, що збіглася,
    // читається оком як одна площина, і саме так ламались усі три
    // попередні ключі (ADR-0086).
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0.3);
  });

  it('не тонує, коли тон один — підкладка лишається без смуг', () => {
    const { mesh, body } = monarch();
    const geometry = createThreeCrystalGeometry(
      mesh,
      { ...body, facets: { tints: [{ r: 1, g: 1, b: 1 }], cumulativeWeights: [1] } },
      SEED,
    );
    const tone = geometry.getAttribute('evolutionFacetTone');
    for (let index = 0; index < tone.count; index += 1) expect(tone.getX(index)).toBe(1);
  });
});
