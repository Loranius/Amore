import { describe, expect, it } from 'vitest';
import { publishCrystal } from '../crystalPublication';
import { buildBranches, SEEDS } from './fixture';

describe('Phase 3B-2 — bounded implicit junction fusion', () => {
  it('adds validated renderer-only collars without changing logical body identity', () => {
    let junctionCount = 0;
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const published = publishCrystal(branches, material, { lod: 'low' });
      junctionCount += published.junctions.length;

      expect(published.bodies.map((body) => body.branch.key)).toEqual(
        branches.map((branch) => branch.key),
      );

      const renderableKeys = new Set(
        published.renderable.map((body) => body.branch.key),
      );
      const junctionKeys = new Set(
        published.junctions.map((body) => body.branch.key),
      );

      // `renderable` is the semantic one-body-per-logical-key set. The scene
      // may intentionally draw a smaller canonical subset when the controlled
      // reference crown is active, while still adding the surviving collars.
      expect(published.drawables.length).toBeLessThanOrEqual(
        published.renderable.length + published.junctions.length,
      );
      for (const drawable of published.drawables) {
        expect(
          renderableKeys.has(drawable.branch.key)
          || junctionKeys.has(drawable.branch.key),
        ).toBe(true);
      }

      // Every display replacement must be present exactly once in the real
      // scene; its canonical source with the same logical key must not leak in.
      for (const display of published.displayBodies) {
        expect(
          published.drawables.filter(
            (body) => body.branch.key === display.branch.key,
          ),
        ).toEqual([display]);
      }

      expect(published.junctions.length).toBeLessThanOrEqual(4);

      for (const junction of published.junctions) {
        expect(junction.branch.key.endsWith(':implicit-junction')).toBe(true);
        expect(junction.implicitJunction?.exposedBoundaryEdges).toBe(0);
        expect(junction.implicitJunction?.trianglesKept).toBeGreaterThan(0);
        expect(junction.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(junction.geometry.getAttribute('color').count).toBe(
          junction.geometry.getAttribute('position').count,
        );
      }
    }
    expect(junctionCount).toBeGreaterThan(0);
  });

  it('is deterministic and can be disabled for A/B validation', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const first = publishCrystal(branches, material, { lod: 'low' });
    const repeated = publishCrystal(branches, material, { lod: 'low' });
    const disabled = publishCrystal(branches, material, { lod: 'low', skipFusion: true });

    expect(repeated.junctions.map((body) => body.branch.key)).toEqual(
      first.junctions.map((body) => body.branch.key),
    );
    expect(repeated.drawables.map((body) => body.branch.key)).toEqual(
      first.drawables.map((body) => body.branch.key),
    );
    first.junctions.forEach((body, index) => {
      const again = repeated.junctions[index]!;
      expect(Array.from(again.geometry.getAttribute('position').array)).toEqual(
        Array.from(body.geometry.getAttribute('position').array),
      );
      expect(Array.from(again.geometry.getIndex()!.array)).toEqual(
        Array.from(body.geometry.getIndex()!.array),
      );
    });

    expect(disabled.junctions).toHaveLength(0);
    expect(
      disabled.drawables.every((body) => disabled.renderable.includes(body)),
    ).toBe(true);
    for (const display of disabled.displayBodies) {
      expect(disabled.drawables).toContain(display);
    }
  });
});
