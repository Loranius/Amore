# Reef Species — Phase 8: Three.js Renderer Integration / Production Reef Scene

## Purpose

Phase 8 replaces the truthful Home Reef placeholder with the first production Three.js scene backed exclusively by accepted Reef Species phases 1–7.

The renderer does not regenerate colony identity, layout, skeletons, geometry, materials or life rules. It consumes their published state and translates it into bounded Three.js resources.

## Production pipeline

```text
Portal module history
→ Evolution ArtifactBlueprint
→ Reef Species Blueprint
→ Colony Layout / Substrate Occupancy
→ Reef Foundation Mesh
→ Morphotype Skeletons
→ Morphotype Mesh Batches
→ Reef Materials
→ Reef Life
→ Phase 8 Three.js adapter
→ Home `artifact=reef`
```

The portal adapter is read-only and reuses the same normalized Evolution snapshot contract as the accepted Tree production path. Phase 8 adds no Supabase table, migration or write.

## Renderer topology

The scene publishes:

- one static foundation `BufferGeometry` and one foundation material;
- at most one merged `BufferGeometry` and one material for each of the six morphotypes;
- exactly the accepted positions, normals, UVs and flat index buffers from Phases 3 and 5;
- per-vertex foundation surface modifiers;
- per-colony tint bindings encoded into vertex colors inside the existing morphotype batch.

Maximum renderer topology:

```text
1 foundation draw call
+ 6 morphotype draw calls
= 7 draw calls

1 foundation material
+ 6 morphotype materials
= 7 materials
```

No colony becomes an individual Three.js mesh.

## Ambient motion

Phase 7 motion bindings map directly to their Phase 5 vertex ranges.

For every animated frame the adapter:

1. starts from the immutable accepted position, normal and color buffers;
2. samples the deterministic global current and colony sway profile;
3. rotates only the vertices in that colony's stable range around its accepted pivot;
4. weights bending by axial distance and the published bend exponent;
5. rotates the matching normals;
6. applies bounded polyp pulse through the existing vertex-color buffer.

This preserves batch identity and adds zero draw calls, zero material identities and zero geometry allocations per frame.

## Reduced motion

`prefers-reduced-motion: reduce` selects the exact static Phase 7 profile:

- continuous animation stops;
- accepted base positions are restored byte-for-byte;
- accepted base normals are restored byte-for-byte;
- accepted base vertex colors are restored byte-for-byte;
- the R3F canvas uses demand rendering.

The species pipeline is not rebuilt when the preference changes.

## Mobile production budget

The Phase 8 contract targets Pixel 8 Pro:

```text
maximum draw calls: 7
maximum materials: 7
maximum vertices: 24,256
maximum triangles: 36,512
maximum synchronous cold build: 220 ms
DPR ceiling: 1.5
shadow passes: 0
post-processing passes: 0
```

The geometry ceilings are the explicit Phase 3 foundation budget plus the explicit Phase 5 colony budget. Runtime renderer metrics are sampled after warm-up and exposed through `data-reef-*` acceptance attributes.

## Home integration

The existing `Кристал / Дерево / Риф` switcher now lazy-loads the production Reef scene.

- selection still persists in URL and `localStorage`;
- Crystal and Tree entries are unchanged;
- WebGL failure produces a truthful Reef fallback;
- portal assembly failure produces an explicit error state rather than fabricated geometry;
- the scene keeps touch orbit controls but disables panning and shadow passes.

## Acceptance

Unit coverage verifies:

- deterministic Phase 1–7 production builds;
- closed foundation and unchanged accepted geometry;
- one foundation draw plus at most six morphotype draws;
- exact material and life-binding coverage;
- in-place animation without new resources;
- exact reduced-motion buffer restoration;
- vertex, triangle, material and draw-call ceilings.

Pixel 8 Pro visual acceptance verifies:

- the Reef tab loads a real `[data-reef-preview="ready"]` scene;
- static and runtime acceptance reach `pass`;
- runtime draw calls remain at or below seven;
- geometry remains within explicit budgets;
- Reef selection survives reload.

## Boundaries

Phase 8 adds no:

- new Reef Species or Life rules;
- per-colony draw calls;
- textures or custom shaders;
- shadows or post-processing;
- physics, picking, fish, particles or cinematic effects;
- Supabase writes or schema changes;
- Crystal or Tree geometry changes.
