import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_SOIL_SURFACE_CONFIG } from './config';
import { buildTreeSoilSurface } from './treeSoilSurface';

function build(lod: 'high' | 'medium' | 'low' = 'medium') {
  const preview = buildTreeLabPreview(lod);
  return {
    preview,
    soil: buildTreeSoilSurface({
      species: preview.species,
      terrain: preview.terrain,
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
      config: DEFAULT_TREE_SOIL_SURFACE_CONFIG,
    }),
  };
}

describe('Tree Soil Surface Lab', () => {
  it('is deterministic and publishes one bounded tint per static-mesh vertex', () => {
    const first = build('medium');
    const second = build('medium');

    expect(second.soil).toEqual(first.soil);
    expect(first.soil.vertexColors).toHaveLength(
      first.preview.rootGeometry.diagnostics.vertexCount * 3,
    );
    expect(first.soil.diagnostics.terrainVertexCount).toBe(
      first.preview.terrain.diagnostics.vertexCount,
    );
    expect(first.soil.diagnostics.tintedTerrainVertexCount).toBe(
      first.preview.terrain.diagnostics.vertexCount,
    );
    expect(first.soil.diagnostics.uniqueTintCount).toBeGreaterThan(1);
    expect(first.soil.diagnostics.uniqueTintCount).toBeLessThanOrEqual(
      first.soil.diagnostics.tintBudget,
    );
    expect(first.soil.diagnostics.materialCount).toBe(2);
    expect(first.soil.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.soil.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('preserves the root and collar prefix as white bark multipliers', () => {
    const { soil } = build('medium');
    const prefix = soil.vertexColors.slice(0, soil.diagnostics.terrainVertexOffset * 3);
    const terrain = soil.vertexColors.slice(soil.diagnostics.terrainVertexOffset * 3);

    expect(prefix.every((channel) => channel === 1)).toBe(true);
    expect(terrain.some((channel) => channel < 1)).toBe(true);
    expect(soil.diagnostics.prefixWhitePreserved).toBe(true);
    expect(soil.diagnostics.terrainRangePreserved).toBe(true);
  });

  it('quantizes every terrain tint channel to the published palette resolution', () => {
    const { soil } = build('medium');
    const steps = soil.diagnostics.quantizationSteps;
    const terrain = soil.vertexColors.slice(soil.diagnostics.terrainVertexOffset * 3);

    for (const channel of terrain) {
      const scaled = channel * (steps - 1);
      expect(scaled).toBeCloseTo(Math.round(scaled), 4);
    }
  });

  it('keeps palette identity stable while LOD changes only tint sampling density', () => {
    const high = build('high').soil;
    const medium = build('medium').soil;
    const low = build('low').soil;

    expect(high.descriptor).toEqual(medium.descriptor);
    expect(medium.descriptor).toEqual(low.descriptor);
    expect(high.palette).toEqual(medium.palette);
    expect(medium.palette).toEqual(low.palette);
    expect(high.diagnostics.terrainVertexCount).toBeGreaterThanOrEqual(
      medium.diagnostics.terrainVertexCount,
    );
    expect(medium.diagnostics.terrainVertexCount).toBeGreaterThanOrEqual(
      low.diagnostics.terrainVertexCount,
    );
  });

  it('does not mutate accepted species, terrain, geometry or material state', () => {
    const preview = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      species: preview.species,
      terrain: preview.terrain,
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
    });

    buildTreeSoilSurface({
      species: preview.species,
      terrain: preview.terrain,
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
      config: DEFAULT_TREE_SOIL_SURFACE_CONFIG,
    });

    expect(JSON.stringify({
      species: preview.species,
      terrain: preview.terrain,
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
    })).toBe(before);
  });

  it('rejects mismatched provenance and tint-band budgets', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeSoilSurface({
      species: preview.species,
      terrain: { ...preview.terrain, artifactSeed: preview.terrain.artifactSeed + 1 },
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
      config: DEFAULT_TREE_SOIL_SURFACE_CONFIG,
    })).toThrow(/different artifacts/);

    expect(() => buildTreeSoilSurface({
      species: preview.species,
      terrain: preview.terrain,
      rootGeometry: preview.rootGeometry,
      materials: preview.materials,
      config: {
        ...DEFAULT_TREE_SOIL_SURFACE_CONFIG,
        maximumUniqueTints: 2,
        radialTintBands: 3,
        variationTintBands: 2,
      },
    })).toThrow(/tint bands exceed/);
  });
});
