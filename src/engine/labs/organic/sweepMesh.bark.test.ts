import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_GROUND_CONTACT_CONFIG } from '../../groundContact';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';

interface Ring {
  y: number;
  radii: number[];
  mean: number;
}

function trunkRings(limit: number): Ring[] {
  const build = buildTreeLabPreview('medium');
  const trunk = build.mesh.branches.find((branch) => branch.branchId === 'organic:trunk')!;
  const positions = build.mesh.positions;
  const rings: Ring[] = [];
  for (let ring = 0; ring < Math.min(limit, trunk.ringCount); ring += 1) {
    const start = trunk.firstVertex + ring * trunk.radialSegments;
    const points: [number, number, number][] = [];
    for (let slot = 0; slot < trunk.radialSegments; slot += 1) {
      const offset = (start + slot) * 3;
      points.push([positions[offset]!, positions[offset + 1]!, positions[offset + 2]!]);
    }
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length;
    const radii = points.map((p) => Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz));
    rings.push({ y: cy, radii, mean: radii.reduce((s, r) => s + r, 0) / radii.length });
  }
  return rings;
}

describe('Organic sweep bark relief', () => {
  it('gives the trunk a lobed cross-section rather than a circle', () => {
    // The complaint this answers was "square, sharp-angled trunk". Flat
    // shading was drawing hard facets on a perfectly circular tube; turning it
    // off left a rubber pipe. Wood is neither — it is genuinely not round.
    for (const ring of trunkRings(6)) {
      const min = Math.min(...ring.radii);
      const max = Math.max(...ring.radii);
      expect((max - min) / ring.mean).toBeGreaterThan(0.08);
    }
  });

  it('swells along the trunk, so it is not an extrusion of one profile', () => {
    const rings = trunkRings(24);
    const means = rings.map((ring) => ring.mean);
    // A pure taper falls monotonically. Real wood does not, and the swelling
    // is what reads at portal size where individual lobes are a pixel wide.
    const rises = means.filter((mean, index) => index > 0 && mean > means[index - 1]!);
    expect(rises.length).toBeGreaterThan(0);
  });

  it('keeps every published normal a unit vector after the lobe tilt', () => {
    const mesh = buildTreeLabPreview('medium').mesh;
    for (let index = 0; index < mesh.normals.length; index += 3) {
      const length = Math.hypot(
        mesh.normals[index]!,
        mesh.normals[index + 1]!,
        mesh.normals[index + 2]!,
      );
      expect(length).toBeCloseTo(1, 4);
    }
  });

  it('carries enough ring vertices to describe its own lobes', () => {
    // Below roughly three vertices per lobe the relief aliases into a gear.
    const { radialSegmentsByLod, bark } = DEFAULT_ORGANIC_SURFACE_CONFIG;
    for (const lod of ['high', 'medium'] as const) {
      expect(radialSegmentsByLod[lod]).toBeGreaterThanOrEqual(bark.lobeCount * 3);
    }
  });
});

describe('Trunk collar', () => {
  it('ends exactly on the trunk, leaving no lip where the two meshes meet', () => {
    // The collar is separate geometry from the sweep, so any ratio other than
    // one puts a step at the join — which is precisely the seam between stump
    // and trunk that the owner reported.
    expect(DEFAULT_TREE_GROUND_CONTACT_CONFIG.collarTopRadiusRatio).toBe(1);
  });

  it('flares wide enough at the ground to read as one form with the roots', () => {
    expect(DEFAULT_TREE_GROUND_CONTACT_CONFIG.collarBottomRadiusRatio).toBeGreaterThan(1.8);
  });
});
