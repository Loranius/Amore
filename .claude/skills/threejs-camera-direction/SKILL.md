---
name: threejs-camera-direction
description: Direct advanced Three.js camera systems. Use for scale-aware chase rigs, thrust lag, side/orbit cameras, body-relative up vectors, quaternion handoffs, authored cinematic framing, floating origins, pointer-look controls, camera collision constraints, projection ownership, and lifecycle restoration.
---

# Camera Direction

Treat the camera as an authored visual system, not a passive viewport. Compose
the subject, establish scale, choose a stable up frame, and make every mode
handoff explicit.

## Build order

1. Define the design frame: subject size, screen occupancy, lens, near/far,
   motion, and horizon/up convention.
2. Build camera targets in semantic frames: ship, body surface, docking axis,
   or scene-authored shot.
3. Derive position and orientation independently, then combine them once.
4. Add input orbit/look only inside declared yaw/pitch and spatial constraints.
5. Add frame-rate-independent follow or a bounded spring where the reference
   uses inertia.
6. Snapshot and restore camera projection/state when a scene owns it.
7. Test mode transitions, cuts, pointer-lock reacquisition, resize, and large
   coordinates.

Read [references/camera-rig-and-cinematic-systems.md](references/camera-rig-and-cinematic-systems.md)
for exact chase/side/orbit rigs, projection values, transition
rules, floating-origin shot, pointer controls, and implementation limits.

## Non-negotiable rules

- Use subject dimensions to derive offsets; do not tune one fixed distance for
  differently scaled assets.
- For planetary motion, derive up from the dominant body rather than global Y.
- Interpolate position with `lerp` and orientation with `slerp`.
- During an explicit handoff, use one interpolation stage. Do not stack a
  transition blend and a second follow smoother over the same interval.
- Re-sync yaw/pitch from the camera when pointer lock is acquired.
- Update the projection matrix whenever FOV, near, far, or aspect changes.
- Keep stars or infinite backgrounds camera-relative when large translation
  would create false parallax or precision loss.
- Restore camera and input ownership on scene disposal.

## Routing boundary

Use `$threejs-procedural-animation` for object motion timelines, springs,
docking, staging, and debris. This skill owns how the scene is viewed and how
camera modes hand off.

## In Amore

Installed from scottstts/Threejs-Awesome-Graphics-Agent-Skills (MIT, commit `53eb5a2`, 2026-11-10). Text and
example code only: textures, renders, `.glb`, `.exr`, `.bin` and `.wasm` were left out to keep the repository
small, so a referenced image may be missing — the upstream repository has them. Many examples use WebGPU/TSL;
the Amore renderer is WebGL with three 0.170 and React Three Fiber, so port the technique, not the code.
Engine rules in `CLAUDE.md` win: no `Math.random()` in `src/engine/**`, geometry and material only in the
volumes that own them, and verify a visual change with the headless workflow in `amore-3d-visual-polish`.
