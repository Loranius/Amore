---
name: threejs-shadow-systems
description: Implement stable, scalable directional-shadow systems for Three.js. Use for large procedural worlds, city scenes, terrain, moving cameras, WebGPU/TSL shadow nodes, cascades, cached clipmaps, texel stabilization, update budgets, and targeted invalidation.
---

# Shadow Systems

Use a single shadow map only when its receiver region is genuinely bounded. For large moving views, make shadow coverage an explicit spatial hierarchy.

## Cached clipmap workflow

1. Define concentric light-space square levels.
2. Snap each level center to its own texel grid.
3. Cross-fade adjacent levels in shader space.
4. Refresh near levels continuously.
5. Cache coarse levels and update them under a frame budget.
6. Invalidate intersecting levels when important casters or streamed terrain change.
7. Scale normal bias by world-space texel width.

Read [references/cached-clipmap-shadows.md](references/cached-clipmap-shadows.md) before implementing a large-world directional light.

Read the
[cached shadow clipmaps](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills/blob/53eb5a2/skills/threejs-procedural-architecture/examples/procedural-financial-tower/shadow-clipmaps.js)
for three light-space square levels, per-level texel snapping, containment
cross-fades, cached coarse updates, scaled bias, and unshadowed outside weight.

## Failure conditions

- projection centers move by fractions of a texel;
- shader containment does not match the map's committed center;
- all cascades refresh every frame without evidence;
- coarse levels freeze moving casters indefinitely;
- depth texture samples occur in divergent fragment control flow;
- the same normal bias is used across radically different texel sizes;
- level boundaries become visible under camera motion.

## Routing boundary

Use this skill for light-space directional shadow maps. Use
`$threejs-screen-space-ambient-occlusion` for view-dependent ambient
visibility; AO is not a replacement for cast shadows.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
