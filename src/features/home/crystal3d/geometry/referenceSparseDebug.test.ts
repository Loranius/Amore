import { it } from 'vitest';
import { buildBranches } from '../__tests__/fixture';
import { publishCrystal } from '../crystalPublication';

it('prints sparse reference composition for diagnostics', () => {
  const { branches, material } = buildBranches('8264-3607-EEA8', 'sparse');
  const published = publishCrystal(branches, material, { lod: 'high' });
  console.log('SPARSE_INPUT', branches.map((branch) => ({
    key: branch.key,
    role: branch.role,
    tier: branch.tier,
    archetype: branch.archetype,
    primary: branch.primary,
    hostKey: branch.hostKey,
    height: branch.height,
  })));
  console.log('SPARSE_PUBLISHED', published.bodies.map((body) => ({
    key: body.branch.key,
    role: body.branch.role,
    tier: body.branch.tier,
    archetype: body.branch.archetype,
    primary: body.branch.primary,
    hostKey: body.branch.hostKey,
    height: body.branch.height,
    triangles: (body.geometry.getIndex()?.count ?? 0) / 3,
    capBuried: body.trim.capBuried,
  })));
});
