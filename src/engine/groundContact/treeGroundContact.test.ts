import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { buildTreeRootArchitecture } from '../rootArchitecture';
import { DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG } from '../rootArchitecture/config';
import { DEFAULT_TREE_GROUND_CONTACT_CONFIG } from './config';
import { buildTreeGroundContact } from './treeGroundContact';

function buildAtAge(ageDays: number) {
  const preview = buildTreeLabPreview('medium');
  const species = {
    ...preview.species,
    state: { ...preview.species.state, ageDays },
  };
  const roots = buildTreeRootArchitecture({
    species,
    composition: preview.composition,
    frames: preview.frames,
    config: DEFAULT_TREE_ROOT_ARCHITECTURE_CONFIG,
  });
  return buildTreeGroundContact({
    species,
    roots,
    config: DEFAULT_TREE_GROUND_CONTACT_CONFIG,
  });
}

describe('Tree Ground Contact Lab', () => {
  it('is deterministic and publishes explicit ground, burial and visibility', () => {
    const preview = buildTreeLabPreview('medium');
    const first = preview.groundContact;
    const second = buildTreeGroundContact({
      species: preview.species,
      roots: preview.roots,
      config: DEFAULT_TREE_GROUND_CONTACT_CONFIG,
    });

    expect(second).toEqual(first);
    expect(first.burialDepth).toBeGreaterThan(0);
    expect(first.ground.levelY).toBeLessThan(first.collar.center.y);
    expect(first.diagnostics.visiblePathFraction).toBeGreaterThan(0);
    expect(first.diagnostics.visiblePathFraction).toBeLessThan(1);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('clips only derived root prefixes and terminates them at the ground plane', () => {
    const contact = buildTreeLabPreview('medium').groundContact;

    expect(contact.visibleRootFrames.curves.length).toBe(contact.roots.length);
    for (const curve of contact.visibleRootFrames.curves) {
      expect(curve.samples.length).toBeGreaterThanOrEqual(2);
      expect(curve.samples.every(
        (sample) => sample.position.y >= contact.ground.levelY - 0.000001,
      )).toBe(true);
      expect(curve.samples.at(-1)?.position.y).toBeCloseTo(contact.ground.levelY, 6);
    }
  });

  it('keeps ground and old root contact descriptors stable as the tree ages', () => {
    const young = buildAtAge(0);
    const old = buildAtAge(50_000);

    expect(old.ground).toEqual(young.ground);
    expect(old.collar).toEqual(young.collar);
    expect(old.roots.slice(0, young.roots.length)).toEqual(young.roots);
    expect(old.visibleRootFrames.curves.slice(0, young.visibleRootFrames.curves.length))
      .toEqual(young.visibleRootFrames.curves);
  });

  it('does not mutate species or accepted root architecture', () => {
    const preview = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(preview.species);
    const rootsBefore = JSON.stringify(preview.roots);

    buildTreeGroundContact({
      species: preview.species,
      roots: preview.roots,
      config: DEFAULT_TREE_GROUND_CONTACT_CONFIG,
    });

    expect(JSON.stringify(preview.species)).toBe(speciesBefore);
    expect(JSON.stringify(preview.roots)).toBe(rootsBefore);
  });
});
