# Amore Evolution Engine — Godot 4.7.1

This directory is the new 3D runtime for Amore artifacts. React/Vite remains the portal shell; Godot owns only procedural 3D generation, presentation and interaction for Crystal, Tree and Reef.

## Migration safety

The accepted Three.js implementation is preserved at:

- branch: `archive/threejs-evolution-engine-2026-07-31`
- source commit: `0b9fda4187aa2d1e9bf80f4b0c56c296ea0e5480`

Nothing in the existing React, Supabase or Three.js runtime is deleted by this bootstrap.

## Current vertical slice

The first runnable slice generates a deterministic crystal colony from:

1. immutable Artifact DNA;
2. a sorted append-only Evolution Event history;
3. species translation into Growth Instructions;
4. deterministic collision resolution;
5. procedural ArrayMesh construction;
6. a mobile-friendly Godot Compatibility renderer scene.

Tree and Reef will reuse the same canonical event/state pipeline after the crystal slice passes web and Pixel 8 Pro validation.

## Run locally

Open `godot/evolution-engine/project.godot` in Godot 4.7.1 and run the main scene.

Headless determinism smoke test:

```bash
godot --headless \
  --path godot/evolution-engine \
  --script res://scripts/tests/determinism_smoke.gd
```

## Architectural boundary

```text
React / Vite / Supabase
        |
        | serialized Artifact DNA + Evolution Events
        v
Godot Evolution Runtime
        |
        +-- Species translation
        +-- Growth Engine
        +-- Geometry builders
        +-- Materials / Life / Camera
        |
        v
Web canvas embedded in Amore
```

Godot must not invent relationship history, mutate Supabase data, or own portal navigation.
