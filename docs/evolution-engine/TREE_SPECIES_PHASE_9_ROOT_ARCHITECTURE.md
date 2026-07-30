# Tree Species — Phase 9: Root Architecture Lab

## Purpose

This phase adds a deterministic, renderer-independent root system after accepted Tree Composition and before any root geometry, terrain or weathering work.

## Pipeline position

```text
Portal Events
→ Evolution Engine
→ Tree Species
→ Organic Skeleton
→ Curve Frames
→ Tree Composition
→ Root Architecture
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material
→ Tree Life
→ Three.js Renderer
```

## Published state

`TreeRootArchitectureState` contains:

- stable root IDs: `tree:root:<sequence>`;
- surface and near-surface root roles;
- stable azimuth, bend, length, depth and taper;
- canonical renderer-independent curve-frame samples;
- explicit provenance to Species, Composition and Organic Curve Frames;
- dedicated root and sample budgets;
- truncation diagnostics.

## Append-only rule

Age controls only how much of the mature root prefix is exposed. A root descriptor depends on:

- artifact seed;
- immutable trunk-base frame;
- root sequence;
- stable Tree Species structure.

Later history may expose additional roots, but it cannot move, resize, renumber or regenerate an already exposed root.

## Mobile budgets

Default limits:

- minimum roots: 3;
- maximum roots: 9;
- canonical samples per root: 7;
- maximum canonical samples: 63.

When the sample budget is exhausted, only later root candidates are truncated.

## Architectural boundary

This phase intentionally does not:

- render roots;
- add root triangles or draw calls;
- merge roots into the animated branch sweep;
- change Tree Life motion;
- add terrain, soil, textures, weathering or root collision;
- write to Supabase;
- change production Home.

The structural state is exposed in Tree Lab diagnostics for fixture and portal histories.

## Acceptance

The phase is accepted when:

- fixture output is deterministic;
- older trees expose a longer stable prefix;
- root and sample budgets are respected;
- upstream Species, Composition and Frames remain immutable;
- Pixel 8 Pro preview remains inside the existing two-draw-call budget.

## Next phase

**Root Geometry Integration Lab** will convert accepted root curves into a static root sweep and integrate it without allowing Tree Life to deform the anchored root system.
