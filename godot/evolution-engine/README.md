# Amore Evolution Engine — Godot 4.7.1

This directory is the new 3D runtime for Amore artifacts. React/Vite remains the portal shell; Godot owns only procedural 3D generation, presentation and interaction for Crystal, Tree and Reef.

## Migration safety

The accepted Three.js implementation is preserved at:

- branch: `archive/threejs-evolution-engine-2026-07-31`
- source commit: `0b9fda4187aa2d1e9bf80f4b0c56c296ea0e5480`

Nothing in the existing React, Supabase or Three.js runtime is deleted by this migration. Phase 11 also keeps a live automatic Three.js fallback inside the Crystal route.

## Current vertical slice

The runnable Crystal slice generates a deterministic colony from:

1. immutable Artifact DNA;
2. a sorted append-only Evolution Event history;
3. species-neutral channels translated into bounded Crystal geological pressure;
4. deterministic primary, secondary and accent hierarchy assignment;
5. bounded parent capacity, generation depth and silhouette control;
6. compatible events accumulated as colony extension, thickening or refinement;
7. deterministic collision resolution for visible colony seeds;
8. a renderer projection that folds aggregate deposits into unified mineral bodies;
9. procedural ArrayMesh construction and integrated junction geometry;
10. runtime-only Life Engine cues for idle light, new seed growth and colony impacts;
11. browser `prefers-reduced-motion` support;
12. a deterministic Phase 10 visual profile for mineral families, cloudy bases, pale terminations and oblique framing;
13. a floor-free, dark-slate mobile Godot Compatibility renderer scene;
14. a strict same-origin production handshake validated against species, seed and event history;
15. automatic Three.js fallback for iframe, runtime, timeout or state-mismatch failure;
16. tap and keyboard activation routed from the Godot canvas back to the existing React Memory modal.

Every event remains present in canonical state and history. Aggregate events are not deleted or merged in storage; they are projected into an existing visible colony only at the renderer boundary. Life animation and presentation own only duplicated materials, vertex colours and local renderer transforms, never canonical geometry or history.

The current Web profile remains opaque for stable overlapping Crystal sorting. It does not claim physical transmission or refraction; real optical expansion remains later work.

Tree and Reef will reuse the same canonical event/state pipeline after the Crystal production cutover passes its remaining physical-device acceptance gates.

## Runtime mode

Set `VITE_EVOLUTION_GODOT` in the React environment:

```text
disabled   → Three.js
preview    → opt-in Godot preview
production → Godot production route with automatic Three.js fallback
```

## Run locally

Open `godot/evolution-engine/project.godot` in Godot 4.7.1 and run the main scene.

Headless acceptance tests:

```bash
godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/determinism_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/growth_hierarchy_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/semantic_pressure_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/colony_accumulation_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/life_engine_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/visual_polish_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/integrated_fusion_smoke.gd

godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/portal_cutover_smoke.gd
```

Production React verification requires an accepted Godot Web export staged under `public/godot/evolution-engine/`:

```bash
VITE_EVOLUTION_GODOT=production npm test
VITE_EVOLUTION_GODOT=production npm run build
```

## Architectural boundary

```text
React / Vite / Supabase
        |
        | serialized Artifact DNA + Evolution Events
        v
Godot Evolution Runtime
        |
        +-- Species semantic translation
        +-- Growth hierarchy
        +-- Colony accumulation
        +-- Collision competition
        +-- Renderer projection
        +-- Geometry builders
        +-- Deterministic visual profile
        +-- Runtime-only Life Engine
        +-- Materials / Camera / interaction bridge
        |
        v
Same-origin Web canvas embedded in Amore
        |
        +-- accepted state → keep Godot
        +-- fatal cutover failure → Three.js fallback
```

Godot must not invent relationship history, mutate Supabase data, or own portal navigation.
