# Reef Species — Phase 9: Production Acceptance / Pipeline Consolidation

## Purpose

Phase 9 closes the first complete Reef Species production track.

Phase 8 made the accepted Reef phases visible in Home. Phase 9 removes acceptance ownership from the feature layer and publishes one renderer-independent engine contract for the complete Phase 1–8 pipeline.

No new coral geometry, materials, animation rules or visual effects are introduced.

## Canonical production pipeline

```text
1. Reef Species / Growth Grammar
2. Colony Layout / Substrate Occupancy
3. Reef Foundation Mesh
4. Morphotype Skeletons
5. Morphotype Mesh Batches
6. Reef Materials
7. Reef Life
8. Three.js Production Renderer
9. Production Acceptance / Pipeline Consolidation
```

The Phase 9 contract publishes eight ordered checkpoints for the accepted implementation phases. Phase 9 itself is the validator and does not become another renderer resource.

## Phase checkpoints

Every checkpoint contains:

- canonical phase ID;
- sequence number;
- source rules version;
- deterministic fingerprint;
- pass/fail status.

The contract rejects missing fingerprints, incorrect ordering and broken source-rules provenance between adjacent states.

## Colony identity chain

The accepted layout colony IDs must be preserved through:

```text
layout colony
→ foundation attachment
→ morphotype skeleton
→ mesh range
→ material binding
→ life binding
```

Phase 9 verifies both complete set coverage and uniqueness. Reordering caused by morphotype batching is allowed; missing, duplicated or fabricated colony identities are not.

A deterministic identity signature is generated from the sorted accepted layout colony IDs.

## Range and binding chain

Phase 5 mesh-range IDs must match exactly:

- Phase 6 material `sourceRangeId` values;
- Phase 7 life `sourceRangeId` values.

Phase 6 material-binding IDs must also match every Phase 7 `sourceMaterialBindingId`.

This prevents the renderer from animating or tinting a colony slice that was not published by the accepted geometry pipeline.

## Foundation and reduced motion

Production acceptance requires:

- a closed Phase 3 foundation shell;
- one foundation attachment for every accepted layout colony;
- no foundation geometry budget overflow;
- a fully static reduced-motion profile for every Phase 7 binding;
- zero reduced-motion sway, polyp pulse and time scale.

## Renderer consolidation

Phase 8 renderer metrics are validated against the actual accepted states rather than trusted as independent counters.

The contract verifies:

- renderer batch IDs equal the active Phase 5 batch IDs;
- vertex count equals Phase 3 vertices plus all Phase 5 vertices;
- triangle count equals Phase 3 triangles plus all Phase 5 triangles;
- estimated draw calls equal one foundation draw plus one draw per active morphotype batch;
- material count equals one foundation material plus the Phase 6 colony assignments;
- no per-colony mesh or material is introduced.

## Static and runtime acceptance

Static acceptance checks deterministic pipeline structure and budgets.

Runtime acceptance separately checks:

- synchronous production build time;
- measured Three.js draw calls;
- measured renderer triangles.

Runtime status is:

- `warming` until runtime metrics exist;
- `pass` when static and runtime checks pass;
- `fail` when any contract or mobile budget is violated.

Reduced-motion mode may use the already-created static scene metrics without waiting for animation warm-up.

## Mobile production budget

```text
maximum vertices: 24,256
maximum triangles: 36,512
maximum synchronous build: 220 ms
maximum draw calls: 7
maximum materials: 7
DPR ceiling: 1.5
shadow passes: 0
post-processing passes: 0
```

The old Phase 8 feature budget export remains as a backwards-compatible alias of the centralized Phase 9 engine budget.

## Home diagnostics

The production Reef scene exposes:

- static and runtime acceptance status;
- production signature;
- colony identity signature;
- checkpoint count;
- phase-order and provenance state;
- colony-identity and range-binding state;
- runtime draw calls, triangles and build time.

Pixel 8 Pro acceptance verifies the production signature remains unchanged after reload for the same couple-day portal snapshot.

## Boundaries

Phase 9 adds no:

- new Reef Species rules;
- new colonies, skeletons, vertices or triangles;
- new materials, textures or shaders;
- new draw calls;
- new per-frame work;
- fish, particles, physics or cinematic effects;
- Supabase reads, writes or schema changes;
- Crystal or Tree pipeline changes.
