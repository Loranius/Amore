import { describe, expect, it } from 'vitest';
import type { GrowthBody } from '../growth';
import { buildCrystalFacePlanes } from './planes';

function body(seed: number): GrowthBody {
  return { id: 'b', seed, attributes: {} } as unknown as GrowthBody;
}

const base = {
  baseY: 0,
  topY: 1,
  radius: 0.08,
  mainFacets: 7,
  bevels: 2,
  blunt: false,
  broken: false,
  lod: 'high' as const,
};

/**
 * Children are not scaled monarchs.
 *
 * Pass 1 called this out and Pass 9 measured it: a child carried eleven prism
 * faces to the monarch's eleven, a crown holding 0.11 of its prism area to her
 * 0.10, and an aspect of 3.15 to her 4.01. The archetype's anisotropy was the
 * only thing separating them, and anisotropy only flattens — it does not change
 * the habit.
 *
 * The distinction is real mineralogy rather than a size setting. A crystal that
 * grew fast develops fewer forms and more equal faces: supply is not the limit,
 * so every prism face advances at the same rate and the minor forms never get
 * time to appear. A crystal that grew slowly for years develops the subsidiary
 * forms and the strongly unequal faces that come with competing for room.
 */
describe('juvenile habit', () => {
  it('carries no subsidiary form near the shoulder', () => {
    // The shoulder cut is a form that develops on a mature termination. It is
    // most of what separates the two silhouettes: the monarch's shaft is
    // interrupted and steps back, a child's runs clean.
    for (let seed = 1; seed <= 20; seed += 1) {
      const mature = buildCrystalFacePlanes(body(seed * 7919), { ...base, habit: 'mature' });
      const juvenile = buildCrystalFacePlanes(body(seed * 7919), { ...base, habit: 'juvenile' });
      expect(mature.filter((p) => p.kind === 'shoulder').length).toBeGreaterThan(0);
      expect(juvenile.filter((p) => p.kind === 'shoulder')).toHaveLength(0);
    }
  });

  it('spaces its prism faces more evenly than a mature crystal', () => {
    // Measured on the built druse: the largest prism face of a child was up to
    // 402 times the smallest, against 9.65 on the monarch, and the thinnest was
    // 7.4% of its body's width. After: 19 times and 41%.
    const spread = (habit: 'mature' | 'juvenile') => {
      const offsets: number[] = [];
      for (let seed = 1; seed <= 20; seed += 1) {
        const planes = buildCrystalFacePlanes(body(seed * 7919), { ...base, habit })
          .filter((p) => p.kind === 'prism');
        offsets.push(Math.max(...planes.map((p) => p.offset)) / Math.min(...planes.map((p) => p.offset)));
      }
      return offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
    };
    expect(spread('juvenile')).toBeLessThan(spread('mature'));
  });

  it('closes its minor rhombohedral faces rather than shrinking them', () => {
    // Past closing, not near it. On a fast crystal the minor form is absent,
    // not small — and a face left at a fraction of its size is the sliver Pass 2
    // documented. The first value tried here was 0.72 of the closing distance,
    // which leaves 28% of the linear size, and the regression sweep put a facet
    // at 0.0011 of its body's width on a 25-year `sparse` couple.
    let matureMinors = 0;
    let juvenileMinors = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const count = (habit: 'mature' | 'juvenile') => {
        const planes = buildCrystalFacePlanes(body(seed * 7919), { ...base, habit });
        const crown = planes.filter((p) => p.kind === 'crown');
        // The apex the majors pass through, taken from the majors themselves.
        const majors = crown.filter((_, index) => index % 2 === 0);
        const minors = crown.filter((_, index) => index % 2 === 1);
        const reach = (p: (typeof crown)[number]) => p.offset;
        // A minor that has retreated past its neighbours stands further out.
        return minors.filter((m) => reach(m) > Math.max(...majors.map(reach))).length;
      };
      matureMinors += count('mature');
      juvenileMinors += count('juvenile');
    }
    expect(juvenileMinors).toBeGreaterThan(matureMinors);
  });

  it('stays a crystal: the base and the crown are still there', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const planes = buildCrystalFacePlanes(body(seed * 7919), { ...base, habit: 'juvenile' });
      expect(planes.filter((p) => p.kind === 'base')).toHaveLength(1);
      expect(planes.filter((p) => p.kind === 'prism').length).toBeGreaterThanOrEqual(6);
      expect(planes.filter((p) => p.kind === 'crown').length).toBeGreaterThan(3);
      for (const plane of planes) {
        expect(Number.isFinite(plane.offset)).toBe(true);
        // Six decimals, because that is the precision the planes are
        // published at: rounding each component independently leaves the
        // length off by up to about 5e-7.
        expect(Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z)).toBeCloseTo(1, 5);
      }
    }
  });
});
