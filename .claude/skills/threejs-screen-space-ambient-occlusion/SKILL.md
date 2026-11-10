---
name: threejs-screen-space-ambient-occlusion
description: Implement a production GTAO path in Three.js. Use for half-resolution horizon sampling, reversed-depth reconstruction, bent-normal encoding, full-resolution bilateral reconstruction, environment-light application, contact grounding, and halo diagnosis.
---

# Screen-Space Ambient Occlusion

AO estimates missing ambient visibility. It must modulate indirect lighting, not repaint all scene color with a dark multiply.

## Workflow

1. Verify linear depth and view-space normals.
2. Reconstruct view position consistently.
3. Sample horizon visibility in a controlled radius.
4. Estimate AO and optional bent normal.
5. Denoise with depth/normal-aware filters.
6. Apply to indirect diffuse and environment response.

Read [references/gtao-bent-normal-pipeline.md](references/gtao-bent-normal-pipeline.md).

## Failure conditions

- direct light and emission are darkened;
- radius is specified only in pixels;
- foreground silhouettes cast thick screen-space halos;
- depth discontinuities are blurred together;
- AO remains strong at distances where its world radius is subpixel;
- bent normals are treated as ordinary geometric normals;
- the implementation claims temporal accumulation even though this path has none.

## Routing boundary

This skill owns GTAO gathering, bent normals, denoising, and AO application.
Use `$threejs-image-pipeline` only when its depth/normal buffers or pass order
must be coordinated with other image-space systems.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
