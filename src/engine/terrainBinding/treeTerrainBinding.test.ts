import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_TERRAIN_BINDING_CONFIG } from './config';
import { buildTreeTerrainBinding } from './treeTerrainBinding';

function build(lod: 'high' | 'medium' | 'low') {
  const preview = buildTreeLabPreview('medium');
  return buildTreeTerrainBinding({
    species: preview.species,
    contact: preview.groundContact,
    lod,
    config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
  });
}

describe('Tree Terrain Binding Lab', () => {
  it('is deterministic, fulfils the stable binding and preserves the contact plane', () => {
    const first = build('medium');
    const second = build('medium');

    expect(second).toEqual(first);
    expect(first.binding).toEqual({
      id: 'tree:terrain:binding',
      sourceBindingId: 'tree:terrain:future',
      surfaceId: 'tree:terrain:surface',
      heightfieldId: 'tree:terrain:heightfield',
      groundPlaneId: 'tree:ground:contact-plane',
    });
    expect(first.groundLevelY).toBe(buildTreeLabPreview('medium').groundContact.ground.levelY);
    expect(first.diagnostics.groundPlanePreserved).toBe(true);
    expect(first.diagnostics.rootCoveragePreserved).toBe(true);
    expect(first.plateauRadius).toBeGreaterThanOrEqual(first.diagnostics.rootCoverageRadius);
    expect(first.diagnostics.mergedIntoRootGeometry).toBe(true);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('keeps identity and footprint stable while reducing only mesh density by LOD', () => {
    const high = build('high');
    const medium = build('medium');
    const low = build('low');

    expect(high.binding).toEqual(medium.binding);
    expect(medium.binding).toEqual(low.binding);
    expect(high.groundLevelY).toBe(medium.groundLevelY);
    expect(medium.groundLevelY).toBe(low.groundLevelY);
    expect(high.surfaceRadius).toBe(medium.surfaceRadius);
    expect(medium.surfaceRadius).toBe(low.surfaceRadius);
    expect(high.plateauRadius).toBe(medium.plateauRadius);
    expect(medium.plateauRadius).toBe(low.plateauRadius);
    expect(high.diagnostics.vertexCount).toBeGreaterThan(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThan(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThan(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThan(low.diagnostics.triangleCount);
  });

  it('does not mutate Tree Species or Ground Contact', () => {
    const preview = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(preview.species);
    const contactBefore = JSON.stringify(preview.groundContact);

    buildTreeTerrainBinding({
      species: preview.species,
      contact: preview.groundContact,
      lod: 'medium',
      config: DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
    });

    expect(JSON.stringify(preview.species)).toBe(speciesBefore);
    expect(JSON.stringify(preview.groundContact)).toBe(contactBefore);
  });

  it('rejects publication when a dedicated terrain budget is exceeded', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeTerrainBinding({
      species: preview.species,
      contact: preview.groundContact,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_TERRAIN_BINDING_CONFIG,
        maximumVerticesByLod: {
          ...DEFAULT_TREE_TERRAIN_BINDING_CONFIG.maximumVerticesByLod,
          medium: 0,
        },
      },
    })).toThrow(/exceeded the medium mobile mesh budget/);
  });
});
