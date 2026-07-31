# Reef Species — Phase 10: Colony Shape Pass

## Purpose

Phase 10 improves the production readability of the accepted reef colony morphotypes without changing their engine identity, topology, material count, draw calls or life bindings.

The pass runs after the accepted Three.js scene is created and before Phase 7 motion samples the buffers.

## Contract

The pass preserves:

- colony IDs and stable mesh ranges;
- vertex and triangle counts;
- index topology;
- material assignments and vertex colors;
- draw-call and material budgets;
- Phase 7 motion bindings;
- Phase 9 production signature and engine acceptance state.

It may change renderer-only positions and regenerated normals.

## Morphotype silhouettes

- `branching`: taller tapered form with bounded organic lean;
- `massive`: lower, wider dome with a fuller middle volume;
- `plating`: narrow stalk, expanded plate edge and bounded rim lift;
- `encrusting`: low substrate-hugging patch;
- `soft-coral`: fuller upper lobes with stronger current-readable bend;
- `sea-fan`: taller and wider fan with reduced depth.

Each profile is deterministic from the stable mesh range ID. No random runtime state is introduced.

## Renderer integration

`applyReefPresentation` publishes:

- `reef-visual-v2` presentation version;
- `phase-10-colony-shapes` shape-pass diagnostic;
- recomputed normals captured as the exact base buffers for ambient motion.

## Mobile budget

Unchanged from the accepted Reef production contract:

- up to 7 draw calls;
- up to 7 materials;
- up to 24,256 vertices;
- up to 36,512 triangles;
- no new geometry or material resources;
- no Supabase writes or schema changes.

## Acceptance

Phase 10 is accepted when:

1. all six morphotypes have distinct bounded shape profiles;
2. colony positions change deterministically while indices and counts remain exact;
3. regenerated normals remain finite and unit length;
4. reduced motion and ambient current both use the shaped base buffers;
5. Pixel 8 Pro preview reports `reef-visual-v2` and `phase-10-colony-shapes`;
6. typecheck, full tests, Pages/PWA build and visual preview pass.
