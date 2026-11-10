---
name: threejs-visual-validation
description: Validate advanced Three.js graphics as authored systems rather than subjective screenshots. Use for fixed-view visual contracts, field and pass diagnostics, no-post baselines, seed sweeps, camera-scale tests, temporal stability checks, GPU budgets, and regression evidence for procedural scenes.
---

# Visual Validation

Evaluate the mechanism that creates the image. A beautiful hero screenshot can hide unstable fields, broken depth, seed failures, or post-processing dependence.

## Validation sequence

1. Freeze deterministic inputs.
2. Capture the no-post baseline.
3. Capture system-specific diagnostic views.
4. Test the intended camera-distance envelope.
5. Sweep representative seeds and parameter extremes.
6. Test motion and temporal stability.
7. Record image, geometry, memory, and timing budgets.
8. Keep a small regression set tied to visual invariants.

Read [references/graphics-validation-protocol.md](references/graphics-validation-protocol.md)
for visual contracts, required inspection controls, mechanism-specific
evidence, temporal checks, budgets, and explicit rejection criteria.

## Required evidence

- fixed camera and seed manifest;
- final and no-post captures;
- field/pass diagnostic mosaic;
- near, design, and far camera views;
- at least one stress seed;
- frame-time and render-target inventory;
- written invariants and known compromises.

## Failure conditions

- approval relies on a single frame;
- post-processing cannot be disabled per pass;
- random seeds are not reproducible;
- GPU time is inferred only from CPU frame time;
- temporal artifacts are judged from still images;
- comparison thresholds ignore intentional stochastic pixels without stabilizing them.

## Routing boundary

This skill evaluates an implementation; it does not supply the implementation
mechanism. Load the subject or image-effect skill first, then use this protocol
to decide whether the result is acceptable.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
