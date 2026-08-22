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
    expect(first.collar.ringCount).toBe(7);
    expect(first.collar.profileExponent).toBeGreaterThan(1);
    expect(first.collar.topRadius).toBeLessThan(preview.species.structure.baseRadius);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedAdditionalMaterials).toBe(0);
  });

  it('clips only derived root prefixes and terminates them at the ground plane', () => {
    const contact = buildTreeLabPreview('medium').groundContact;

    expect(contact.visibleRootFrames.curves.length).toBe(contact.roots.length);
    let reachedGround = 0;
    for (const curve of contact.visibleRootFrames.curves) {
      expect(curve.samples.length).toBeGreaterThanOrEqual(2);
      // The load-bearing half: nothing visible may hang below the plane.
      expect(curve.samples.every(
        (sample) => sample.position.y >= contact.ground.levelY - 0.000001,
      )).toBe(true);
      // The other half applies to roots that reach the plane at all. This used
      // to be asserted of every root, and passed only because seededUnit was
      // returning a near-linear ramp rather than noise (see growth/math.ts), so
      // every root happened to be steep enough to cross. With real noise some
      // roots flare outward and end above the plane — the ground plane sits a
      // fixed burial depth below the collar and nothing makes a root reach it.
      const last = curve.samples.at(-1)!.position.y;
      if (Math.abs(last - contact.ground.levelY) < 1e-6) reachedGround += 1;
    }

    // The clip path still has to be exercised, or this test would pass on a
    // build where clipping silently stopped happening.
    expect(reachedGround).toBeGreaterThan(0);
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
