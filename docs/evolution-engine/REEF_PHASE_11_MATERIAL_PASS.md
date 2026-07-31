# Reef Phase 11 — Material Pass

## Goal

Replace the visually flat beige prototype language with a readable marine material system while preserving the accepted Reef pipeline, stable colony identity and Pixel 8 Pro budgets.

## Renderer-only implementation

Phase 11 runs after the Phase 10 shape presentation and reuses the existing Three.js material objects and vertex-color buffers.

It adds:

- a separate palette and PBR response for every accepted morphotype;
- warm mineral colors for branching and massive hard corals;
- pale green plating corals;
- rose encrusting colonies;
- lavender soft coral;
- blue-violet sea fans;
- stable per-colony variation from existing mesh range IDs;
- root-to-tip and bounded edge gradients;
- a lighter sandy top, readable stone side and cool underside for the foundation;
- reduced ambient light so roughness, sheen and clearcoat remain visible on mobile.

## Preserved contracts

- no new geometry;
- no new material objects;
- no textures or custom shaders;
- no new draw calls;
- unchanged colony IDs, mesh ranges, indices, vertices and triangles;
- Phase 7 motion continues to restore and pulse the exact Phase 11 `baseColors`;
- Phase 9 production and identity signatures remain unchanged;
- no Supabase writes or schema changes;
- Crystal and Tree remain unchanged.

## Diagnostics

The production DOM publishes:

- `data-reef-material-presentation="reef-material-v1"`;
- `data-reef-material-pass="phase-11-material-pass"`.

Each presented geometry publishes the same values through `userData`.

## Acceptance

Phase 11 is complete only when:

1. typecheck, tests, Pages/PWA build and Pixel 8 Pro preview pass;
2. material count and draw calls remain within the accepted ceiling;
3. every visible morphotype has a distinguishable color/material language;
4. the foundation no longer reads as one flat gray-brown disc;
5. before/after screenshots are compared under the Artifact Visual Acceptance Workflow.
