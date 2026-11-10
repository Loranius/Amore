---
name: threejs-exposure-color-grading
description: Build a measured exposure and grading path in Three.js. Use for a 64x36 encoded luminance meter, asynchronous readback, weighted log-average exposure, asymmetric adaptation, single tone-map ownership, and a generated 32-cube post-tone-map LUT.
---

# Exposure and Color Grading

Treat exposure, tone mapping, grading, and output conversion as distinct stages. Tune them from measured HDR signal, not by stacking compensating color operations.

## Order

```text
HDR scene
  → luminance meter
  → adapted exposure
  → tone map
  → creative grade / 3D LUT
  → final output conversion
```

Read [references/scene-referred-color-pipeline.md](references/scene-referred-color-pipeline.md)
for the exact 64x36 meter, encoded readback, adaptation constants, 32-cube LUT,
and signal-ownership ambiguities.

## Failure conditions

- tone mapping occurs in both materials and post;
- exposure is used to repair physically inconsistent light ratios;
- meter weighting and scene framing are not inspected;
- adaptation speed is the same toward light and dark;
- LUT input/output spaces are undocumented;
- sRGB encoding happens twice;
- a display-domain LUT is moved before tone mapping without being rebuilt.

## Routing boundary

Use `$threejs-bloom` for HDR glow contribution and
`$threejs-image-pipeline` when this color path must share ownership with AO,
atmosphere, or effect-local render targets.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
