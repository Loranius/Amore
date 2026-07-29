# Tree Species — Phase 2: End-to-End Preview

## Purpose

Phase 2 replaces the free-standing Tree Lab attractor fixture with a complete deterministic pipeline:

```text
fixed EvolutionEventInput[]
  -> ArtifactBlueprint
  -> TreeSpeciesBlueprint
  -> TreeOrganicField
  -> OrganicSkeletonState
  -> OrganicCurveFrameState
  -> OrganicSweepMesh
  -> thin Three.js adapter
  -> isolated Pixel 8 Pro preview
```

The visible tree is now produced by the same Species boundary planned for production. The Evolution
Engine remains species-neutral, while Tree Species decides how anniversaries and relationship events
become branch intent.

## Fixture boundary

The preview uses a fixed laboratory history in `treeSpeciesFixture.ts`:

- relationship start: 2024-01-01;
- explicit `Europe/Kyiv` time zone;
- explicit `feb-28` leap-day policy;
- fixed `asOf`: 2026-07-29;
- eight verified sample events across all Evolution channels.

The fixture contains no production users, Supabase rows or live portal data. Its only purpose is to make
end-to-end output reproducible in unit tests, CI and screenshots.

## Provenance exposed by the preview

The Tree Lab root exposes stable acceptance attributes:

- `data-tree-lab-source="tree-species"`;
- current Tree Species life stage;
- annual instruction count;
- event instruction count;
- organic attractor count;
- truncation count;
- geometry and renderer metrics.

The current fixture produces:

- two annual bough instructions;
- eight event instructions;
- fifteen organic attractors;
- no adapter truncation.

A compact top badge displays Species state, while the existing bottom badge continues to display LOD,
branches, junctions, vertices, triangles, draw calls and synchronous build time.

## Acceptance

The same mobile laboratory limits remain active:

| Metric | Limit |
| --- | ---: |
| vertices | 12,000 |
| triangles | 16,000 |
| synchronous end-to-end build | 80 ms |
| draw calls | 2 |

Build time now includes Evolution blueprint creation, Tree Species translation, Organic Growth,
curve/frame generation and sweep meshing. This makes the budget stricter and more representative than
the earlier free-standing geometry fixture.

The Pixel 8 Pro Playwright test requires:

- Tree Species provenance;
- the exact fixture instruction and attractor counts;
- zero truncation;
- medium LOD;
- a final mobile acceptance result of `pass`;
- a stored full-page screenshot.

## Guarantees tested

- repeated builds produce identical Artifact, Species, Growth and Geometry results;
- preview output originates from Tree Species rather than generated ellipsoid attractors;
- fixture event and annual counts remain locked;
- no growth is silently truncated;
- the medium topology remains inside mobile limits;
- the pure sweep mesh still maps to one indexed Three.js geometry.

## Explicitly not included

- live Supabase or portal-module adapters;
- choosing Tree as the production artifact;
- foliage, roots, flowers or fruit geometry;
- bark, annual-ring or leaf materials;
- Composition Framework optimization;
- Life Engine animation;
- migration or replacement of Crystal Species.

## Next phase

Phase 3 should add a read-only preview adapter from already-normalized portal Evolution events. It must
preserve this fixture as a regression baseline, keep Tree opt-in only, reject future or invalid data
safely, and compare live-adapter output against the same mobile and append-only contracts before any
production rollout decision.
