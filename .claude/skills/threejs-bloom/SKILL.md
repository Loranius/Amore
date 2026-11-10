---
name: threejs-bloom
description: Implement production bloom in advanced Three.js scenes. Use for HDR signal ordering, bloom-node controls, dual selective bloom with guaranteed material restoration, scene-relative emissive hierarchy, and effect-isolation diagnostics.
---

# Bloom

Bloom is a camera/display response to bright HDR signal. Establish scene exposure and emissive luminance before tuning blur.

## Workflow

1. Inspect pre-tone-map luminance.
2. Choose which scene values should bloom.
3. Choose a single-node or dual selective-render ownership model.
4. Calibrate threshold, radius, smooth width, and strength in HDR.
5. Restore all substituted materials transactionally for selective passes.
6. Composite before exposure/tone mapping.
7. Validate base, contribution, and final views.

Read [references/hdr-bloom-system.md](references/hdr-bloom-system.md) for the
HDR ordering, dual selective-bloom transaction, compact emissive hierarchy,
and the costs and limits of each ownership model.

Apply the material substitution/restoration ownership pattern in the
reference before adding selective bloom to a composed scene.

## Failure conditions

- bloom creates the only visible form of an effect;
- all bright materials share one arbitrary emission multiplier;
- threshold is tuned after tone mapping;
- selective bloom requires mutating scene materials every frame without restoration guarantees;
- transparent particles disappear from extraction because pass ownership is unclear;
- bloom radius changes wildly with resolution;
- highlights become gray because energy is clamped too early.

## Routing boundary

Use `$threejs-exposure-color-grading` for metering, adaptation, tone mapping,
and LUTs. Load `$threejs-image-pipeline` only when bloom must be composed with
several shared image-space systems. A per-pixel ray integrator that owns its own
reduced-resolution target and accumulation history keeps its bloom internal;
route that to `$threejs-raymarched-space-effects`.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
