import { expect, it } from 'vitest';
import { buildBranches } from '../__tests__/fixture';
import { publishCrystal } from '../crystalPublication';
import { applyReferenceDruseLayout } from './referenceDruseLayout';
import { enforceReferenceDruseContract } from './referenceDruseContract';
import { selectReferenceAccentKeys } from './referenceDruseAccent';

it('diagnoses remaining backfilled specks', () => {
  const seed = '8264-3607-EEA8';
  const { branches, material } = buildBranches(seed, 'backfilled');
  const base = enforceReferenceDruseContract(applyReferenceDruseLayout(branches));
  const accentKeys = selectReferenceAccentKeys(base);
  const published = publishCrystal(branches, material);
  const monarch = published.bodies.find((body) => body.branch.primary)!;
  const children = new Map<string, number>();
  for (const body of published.bodies) {
    if (body.branch.hostKey !== null) {
      children.set(body.branch.hostKey, (children.get(body.branch.hostKey) ?? 0) + 1);
    }
  }
  const specks = published.renderable
    .filter((body) => !body.branch.primary && body.solid.profile.h < monarch.solid.profile.r)
    .map((body) => ({
      key: body.branch.key,
      role: body.branch.role,
      tier: body.branch.tier,
      hostKey: body.branch.hostKey,
      accent: accentKeys.has(body.branch.key),
      childCount: children.get(body.branch.key) ?? 0,
      h: Number(body.solid.profile.h.toFixed(4)),
      kingR: Number(monarch.solid.profile.r.toFixed(4)),
      triangles: (body.geometry.getIndex()?.count ?? 0) / 3,
    }));

  expect(specks, JSON.stringify({ visible: published.renderable.length, specks }, null, 2)).toEqual([]);
});
