import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_GROUND_DETAIL_CONFIG } from './config';
import { buildTreeGroundDetail } from './treeGroundDetail';

function rebuild(lod: 'high' | 'medium' | 'low') {
  const preview = buildTreeLabPreview(lod);
  return buildTreeGroundDetail({
    species: preview.species,
    terrain: preview.terrain,
    soil: preview.soilSurface,
    config: DEFAULT_TREE_GROUND_DETAIL_CONFIG,
  });
}

describe('Tree Ground Detail Lab', () => {
  it('is deterministic and fills the exact medium mobile budget', () => {
    const first = rebuild('medium');
    const second = rebuild('medium');

    expect(second).toEqual(first);
    expect(first.instances).toHaveLength(72);
    expect(first.diagnostics.stoneCount).toBe(24);
    expect(first.diagnostics.fallenLeafCount).toBe(24);
    expect(first.diagnostics.mossCount).toBe(24);
    expect(first.diagnostics.instanceBudget).toBe(72);
    expect(first.diagnostics.renderedTriangleCount).toBe(
      first.template.triangleCount * first.instances.length,
    );
    expect(first.diagnostics.estimatedDrawCalls).toBe(1);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(1);
    expect(first.diagnostics.totalMaterialCount).toBe(3);
  });

  it('keeps lower-LOD logical instance IDs as stable prefixes', () => {
    const high = rebuild('high');
    const medium = rebuild('medium');
    const low = rebuild('low');
    const highIds = high.instances.map((instance) => instance.id);
    const mediumIds = medium.instances.map((instance) => instance.id);
    const lowIds = low.instances.map((instance) => instance.id);

    expect(high.instances).toHaveLength(108);
    expect(medium.instances).toHaveLength(72);
    expect(low.instances).toHaveLength(36);
    expect(highIds.slice(0, mediumIds.length)).toEqual(mediumIds);
    expect(mediumIds.slice(0, lowIds.length)).toEqual(lowIds);
    expect(new Set(highIds).size).toBe(highIds.length);
  });

  it('anchors every detail inside terrain and publishes bounded transforms', () => {
    const preview = buildTreeLabPreview('medium');
    const state = preview.groundDetails;

    for (const instance of state.instances) {
      const radius = Math.hypot(
        instance.position.x - preview.terrain.center.x,
        instance.position.z - preview.terrain.center.z,
      );
      expect(radius).toBeLessThanOrEqual(preview.terrain.surfaceRadius * 0.921);
      expect(radius).toBeGreaterThanOrEqual(preview.terrain.surfaceRadius * 0.299);
      expect(instance.normal.y).toBeGreaterThan(0);
      expect(instance.scale.x).toBeGreaterThan(0);
      expect(instance.scale.y).toBeGreaterThan(0);
      expect(instance.scale.z).toBeGreaterThan(0);
      expect(instance.sourceTerrainVertexIndex).toBeGreaterThanOrEqual(0);
      expect(instance.sourceTerrainVertexIndex).toBeLessThan(preview.terrain.diagnostics.vertexCount);
    }
  });

  it('does not mutate accepted species, terrain or soil state', () => {
    const preview = buildTreeLabPreview('medium');
    const before = JSON.stringify({
      species: preview.species,
      terrain: preview.terrain,
      soil: preview.soilSurface,
    });

    buildTreeGroundDetail({
      species: preview.species,
      terrain: preview.terrain,
      soil: preview.soilSurface,
      config: DEFAULT_TREE_GROUND_DETAIL_CONFIG,
    });

    expect(JSON.stringify({
      species: preview.species,
      terrain: preview.terrain,
      soil: preview.soilSurface,
    })).toBe(before);
  });

  it('rejects mismatched provenance and invalid template budgets', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeGroundDetail({
      species: preview.species,
      terrain: { ...preview.terrain, artifactSeed: preview.terrain.artifactSeed + 1 },
      soil: preview.soilSurface,
      config: DEFAULT_TREE_GROUND_DETAIL_CONFIG,
    })).toThrow(/different artifacts/);

    expect(() => buildTreeGroundDetail({
      species: preview.species,
      terrain: preview.terrain,
      soil: preview.soilSurface,
      config: {
        ...DEFAULT_TREE_GROUND_DETAIL_CONFIG,
        maximumTemplateVertices: 1,
        maximumTemplateTriangles: 1,
      },
    })).toThrow(/shared-template budget/);
  });
});
