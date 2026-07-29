# Tree Lab — Phase 3: Isolated Visual Preview

## Purpose

Phase 3 proves that the deterministic Tree Lab pipeline can become one practical mobile WebGL object
without entering the production Crystal renderer or the future Tree Species adapter.

```text
fixed Tree Lab seed
  -> Phase 1 append-only skeleton
  -> Phase 2 curves, frames, junction collars and shared LOD
  -> plain OrganicSweepMesh arrays
  -> thin Three.js BufferGeometry adapter
  -> one R3F mesh
  -> runtime and mobile-budget acceptance
```

## Isolation

The preview is mounted only through an explicit query parameter:

```text
?engine=tree-lab&treeLod=medium#/
```

Published LOD values are `high`, `medium` and `low`. Invalid or absent values fall back to `medium`.
Without `engine=tree-lab`, Home keeps its existing production renderer. The existing
`engine=evolution` preview remains unchanged.

The Tree Lab scene is lazy-loaded, so its React scene code does not enter the default Home render path.
No Supabase state, relationship events or production Crystal state are read or changed.

## Renderer boundary

`createThreeOrganicSweepGeometry()` is deliberately thin. It only maps the pure mesh arrays to:

- position, normal and UV attributes;
- one triangle index buffer;
- bounding box and bounding sphere;
- diagnostic metadata in `geometry.userData`.

It contains no growth, curve, junction or LOD decisions. The preview renders the result as one
`MeshStandardMaterial` mesh with restrained neutral lighting and no cinematic post-processing.

## Mobile acceptance budget

The initial Pixel 8 Pro laboratory budget is:

| Metric | Limit |
| --- | ---: |
| vertices | 12,000 |
| triangles | 16,000 |
| synchronous build | 80 ms |
| draw calls | 2 |

The badge stays in `warming` until real WebGL renderer metrics arrive. It then changes to `pass` or
`fail` and exposes the result through stable `data-tree-lab-*` attributes.

These are explicit laboratory limits, not a claim that every future Tree Species composition is already
approved. Species integration must keep or tighten them after real event mapping, materials and life
animation are introduced.

## Automated checks

Unit tests cover:

- explicit preview and strict LOD parsing;
- deterministic repeated preview builds;
- medium topology inside the published mobile limits;
- Three.js attribute/index integrity;
- independent reporting of every exceeded budget.

The Visual Preview workflow also logs in on the Pixel 8 Pro viewport, opens the medium Tree Lab LOD,
waits for real draw-call metrics, requires `data-tree-lab-acceptance="pass"`, and stores a full-page
screenshot in the workflow artifact.

## Explicitly not included

- Tree Species adapter;
- mapping relationship memories to attractors;
- bark textures or displacement;
- leaves, flowers or fruit;
- wind or Life Engine animation;
- production Home rollout;
- destructive manifold boolean fusion.

## Next phase

After this preview is accepted, the next engineering phase is Tree Species adaptation: convert stable
relationship events into append-only tree attractors and species parameters while preserving the exact
Phase 1–3 renderer-independent contracts and mobile budgets.
