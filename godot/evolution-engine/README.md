# Amore Evolution Engine — Godot 4.7.1

This directory is the new 3D runtime for Amore artifacts. React/Vite remains the portal shell; Godot owns only procedural 3D generation, presentation and interaction for Crystal, Tree and Reef.

## Migration safety

The accepted Three.js implementation is preserved at:

- branch: `archive/threejs-evolution-engine-2026-07-31`
- source commit: `0b9fda4187aa2d1e9bf80f4b0c56c296ea0e5480`

Nothing in the existing React, Supabase or Three.js runtime is deleted by this bootstrap.

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
12. a mobile-friendly Godot Compatibility renderer scene.

Every event remains present in canonical state and history. Aggregate events are not deleted or merged in storage; they are projected into an existing visible colony only at the renderer boundary. Life animation owns only duplicated materials and local node transforms, never canonical geometry or history.

Tree and Reef will reuse the same canonical event/state pipeline after the Crystal slice passes its remaining visual and physical-device acceptance gates.

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
  --script res://scripts/tests/integrated_fusion_smoke.gd
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
        +-- Runtime-only Life Engine
        +-- Materials / Camera
        |
        v
Web canvas embedded in Amore
```

Godot must not invent relationship history, mutate Supabase data, or own portal navigation.
