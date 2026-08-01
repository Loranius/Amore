# Crystal Phase 12 — Mobile Runtime Hardening & Device Telemetry

Phase 12 hardens the accepted Godot 4.7.1 Crystal runtime for mobile browser constraints. It is a runtime and delivery phase, not a morphology, growth, material or history phase.

The phase must not change:

- Artifact DNA;
- Evolution Events;
- append-only canonical history;
- Growth Instructions;
- hierarchy, collision or colony accumulation;
- renderer projection and visible body identity;
- deterministic snapshot signature;
- Phase 10 mineral appearance.

## Runtime quality governor

The runtime owns three bounded presentation tiers:

| Tier | 3D scale | Life Engine | Key shadow | Glow |
| --- | ---: | ---: | --- | --- |
| `high` | `1.00` | `60 Hz` | enabled | enabled |
| `balanced` | `0.86` | `30 Hz` | enabled | enabled |
| `economy` | `0.72` | `20 Hz` | disabled | disabled |

These values affect only presentation cost. Geometry, instruction count, visible colony membership, materials assigned by the deterministic visual profile and canonical state remain unchanged.

### Initial selection

The custom Web shell reports runtime capabilities through the same-origin JavaScript bridge:

- `navigator.deviceMemory` when available;
- `navigator.hardwareConcurrency`;
- device pixel ratio;
- iframe viewport width and height;
- current visibility state;
- reduced-motion preference.

The governor selects:

- `economy` for constrained memory/CPU or extreme physical-pixel load;
- `high` only for a clearly capable profile with bounded pixel load;
- `balanced` for all uncertain or intermediate profiles.

A canonical DNA trait may request `high`, `balanced` or `economy`, but the selected tier remains runtime-only and never enters growth decisions.

### Adaptive FPS policy

The governor samples FPS once per second.

- four consecutive samples below `24 FPS` downgrade one tier;
- `high` may downgrade to `balanced`;
- `balanced` may downgrade to `economy`;
- `economy` may recover to `balanced` only after twelve consecutive samples at or above `48 FPS`;
- automatic recovery never promotes `balanced` to `high` because thermal and battery stability take priority on mobile.

The adaptive policy is deliberately slow enough to avoid per-frame oscillation.

## Life Engine throttling

Crystal Life Engine v2 supports a bounded update rate between `10` and `60 Hz`.

A lower tier does not slow canonical time or rebuild geometry. It accumulates frame delta and updates duplicated runtime materials and local presentation transforms at the selected interval.

When suspended, Life Engine processing stops completely. Resume restores processing with the same entries, canonical geometry and snapshot signature.

## Page and WebGL lifecycle

The custom Web shell queues these lifecycle states:

- `hidden` / `visible`;
- `pagehide` / `pageshow`;
- `freeze` / `resume`;
- `context-lost` / `context-restored`.

Godot treats `hidden`, `pagehide`, `freeze` and `context-lost` as suspended states. Suspension:

1. pauses Life Engine processing;
2. disables orbit input;
3. blocks portal activation;
4. keeps canonical state and generated meshes resident;
5. keeps the bridge alive so a restore event can be received.

A corresponding resume state:

1. resumes Life Engine processing;
2. restores orbit input;
3. reapplies the current quality tier;
4. increments the restore counter;
5. sends a lifecycle acknowledgement and fresh telemetry.

A background/restore cycle must not trigger a canonical rebuild and must not change the snapshot signature.

## Runtime telemetry

Godot sends `amore:godot:telemetry` only after the portal payload is active.

The message contains:

- Godot version;
- selected quality tier;
- FPS and frame time;
- draw calls and rendered primitives;
- static memory in MiB;
- 3D render scale;
- Life Engine update rate;
- suspended state;
- restore count.

React validates every field and exposes the accepted values as DOM data attributes:

```text
data-godot-quality
data-godot-fps
data-godot-frame-ms
data-godot-draw-calls
data-godot-primitives
data-godot-static-memory-mb
data-godot-render-scale
data-godot-life-hz
data-godot-suspended
data-godot-restores
data-godot-lifecycle
```

These attributes are the physical-device measurement surface. They do not grant Godot access to Supabase, navigation or portal writes.

## Visual verification

Every Phase 12 CI run produces:

- a Pixel 8 Pro telemetry screenshot;
- a screenshot immediately before background suspension;
- a screenshot after restore;
- a reduced-motion screenshot;
- an HTML side-by-side before/after comparison.

The browser test additionally verifies that the deterministic state signature is identical before and after restore. This code-level invariant prevents an apparently similar screenshot from hiding a state rebuild or mutation.

## Acceptance gates

Phase 12 requires:

1. Godot 4.7.1 parser/import success;
2. every Phase 1–11 smoke test still passing;
3. deterministic quality selection for high, balanced and economy capability profiles;
4. explicit tier override support;
5. bounded render scale and Life Engine rate;
6. sustained low-FPS downgrade without immediate oscillation;
7. conservative economy-to-balanced recovery;
8. complete Life Engine suspension and resume;
9. Web export containing capability and lifecycle bridge methods;
10. strict React validation for state, telemetry and lifecycle messages;
11. production Vite build with HTML, JavaScript, WASM and PCK;
12. Pixel 8 Pro viewport telemetry proof;
13. successful pagehide/pageshow suspension and restore;
14. unchanged accepted status and canonical signature after restore;
15. canvas-tap activation still reaching React;
16. reduced-motion acceptance still passing;
17. before/after screenshots and visual comparison report uploaded;
18. live Three.js fallback preserved;
19. no canonical or Supabase mutation path introduced.

## Physical Pixel 8 Pro gate

Playwright uses the Pixel 8 Pro viewport, touch and device-scale profile, but it remains browser emulation on a CI runner. Before this phase is considered physically accepted for release to `main`, the Vercel preview must be opened on the actual Pixel 8 Pro and the DOM telemetry captured after:

1. cold load;
2. thirty seconds of idle runtime;
3. several orbit gestures;
4. app backgrounding and restore;
5. reduced-motion mode.

The implementation and automated acceptance are complete in this phase; physical thermal, battery and GPU-driver measurements are an external release gate rather than something CI can truthfully simulate.
