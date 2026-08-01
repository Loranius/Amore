# Godot Web runtime bridge

## Status

Phase 11 promotes the bridge from an isolated vertical slice to a production-capable Crystal cutover with automatic Three.js fallback. Phase 12 adds mobile capability detection, page lifecycle handling and runtime telemetry without expanding Godot's data authority.

Activation is controlled through:

```bash
VITE_EVOLUTION_GODOT=disabled
VITE_EVOLUTION_GODOT=preview
VITE_EVOLUTION_GODOT=production
```

`disabled` keeps Three.js. `preview` enables the Godot path without declaring a production cutover. `production` selects Godot only after a valid accepted state; fatal failures immediately render the existing Three.js Evolution scene.

## Build output

The `Web` export preset produces:

```text
index.html
index.js
index.wasm
index.pck
```

CI stages these files at `public/godot/evolution-engine/` before the Vite production build. The build is rejected unless all four files are present and non-empty under `dist/godot/evolution-engine/`.

The `.wasm` and `.pck` files are excluded from Workbox precache and use a separate CacheFirst runtime cache.

## Security boundary

The React host and Godot iframe must be same-origin.

- React accepts messages only when `event.origin === window.location.origin` and `event.source` is the expected iframe window;
- the custom shell accepts payloads only from `window.parent` with the current origin;
- payloads contain canonical data only, never Supabase credentials or access tokens;
- capability data contains browser runtime characteristics only;
- Godot cannot write relationship history, call Supabase or own portal navigation.

## Message flow

```text
React host
  └─ amore:godot:payload
       └─ custom HTML payload queue
            └─ JavaScriptBridge polling
                 └─ deterministic Godot rebuild
                      └─ amore:godot:state source=portal
                           ├─ valid identity/events/history → accepted
                           └─ mismatch/error/timeout → Three.js fallback

Browser lifecycle
  └─ custom HTML lifecycle queue
       └─ JavaScriptBridge polling
            └─ suspend/resume presentation only
                 ├─ amore:godot:lifecycle
                 └─ amore:godot:telemetry
```

## Host → Godot

```ts
{
  type: 'amore:godot:payload',
  payload: {
    dna: {
      seed: 582013,
      species: 'crystal',
      engine_version: 'godot-0.1.0',
      traits: {
        runtime_quality: 'auto',
      },
    },
    events: [],
  },
}
```

The optional `runtime_quality` trait accepts `auto`, `high`, `balanced` or `economy`. It controls presentation cost only.

## Custom shell API

The same-origin shell exposes a frozen `window.AmoreGodotBridge` object:

```text
takePayload()
takeLifecycle()
capabilitiesJson()
postBase64(encodedMessage)
```

`capabilitiesJson()` reports:

- device memory when the browser exposes it;
- hardware concurrency;
- device pixel ratio;
- iframe viewport dimensions;
- visibility state;
- reduced-motion preference.

The lifecycle queue is capped to prevent unbounded growth while Godot is starting.

## Godot → host messages

The runtime emits:

- `amore:godot:booting`;
- `amore:godot:progress`;
- `amore:godot:engine-started`;
- `amore:godot:ready`;
- `amore:godot:state`;
- `amore:godot:telemetry`;
- `amore:godot:lifecycle`;
- `amore:godot:activate`;
- `amore:godot:error`.

### Accepted state

Only `source: portal` may enter production acceptance. A temporary local demo state is ignored.

The accepted state includes:

- species and seed;
- canonical and rendered instruction counts;
- portal input-event count;
- complete canonical history count;
- motion mode;
- quality governor version and selected tier;
- render scale and Life Engine update rate;
- phase and deterministic signature.

`input_events` counts only portal Evolution Events. `history` may also contain genesis records, so it must be greater than or equal to `input_events`.

### Telemetry

```ts
{
  type: 'amore:godot:telemetry',
  version: '4.7.1',
  quality: 'balanced',
  fps: 58.4,
  frame_ms: 17.12,
  draw_calls: 11,
  primitives: 920,
  static_memory_mb: 84.2,
  render_scale: 0.86,
  life_hz: 30,
  suspended: false,
  restores: 1,
}
```

Telemetry is emitted only after a portal payload is active. React validates every number and range before exposing it to diagnostics.

### Lifecycle acknowledgement

```ts
{
  type: 'amore:godot:lifecycle',
  state: 'pageshow',
  sequence: 4,
  suspended: false,
  restores: 1,
}
```

Supported states are:

```text
hidden, visible, pagehide, pageshow,
freeze, resume, context-lost, context-restored
```

Suspension pauses Life Engine, disables orbit input and blocks activation while preserving canonical state and generated meshes. Restore reapplies the active quality tier and increments the restore counter.

### Activation

A short tap or Enter/Space emits `amore:godot:activate`. Orbit drags and zoom gestures emit none. Activation is blocked while the runtime is suspended.

## React validation

React does not trust a message solely because its `type` is known.

State validation requires:

- `source === 'portal'`;
- species and seed equal the payload;
- input-event count equal the payload event count;
- history count no smaller than input-event count;
- positive canonical instruction count;
- rendered instruction count no greater than canonical count;
- bounded optional quality settings;
- deterministic signature.

Telemetry validation requires:

- a known quality tier;
- finite non-negative FPS, frame time and memory;
- integer non-negative draw calls, primitives and restore count;
- render scale between `0.5` and `1.0`;
- Life Engine rate between `10` and `60 Hz`;
- a boolean suspended state.

Lifecycle validation requires a known state, non-negative integer sequence/restore counts and a boolean suspended state.

Lifecycle status remains monotonic: late boot messages cannot downgrade an accepted or failed runtime.

## Controlled fallback

The host resolves to `three-fallback` after:

1. iframe load failure;
2. explicit Godot runtime error;
3. startup timeout before accepted state;
4. portal-state identity, input-event or history-bound mismatch.

Background suspension is not a fatal error. A WebGL context loss enters suspension and waits for `context-restored`; a separate runtime error still triggers the established fallback.

## Phase 12 verification

The bridge is accepted only after:

1. Godot parser and all Phase 1–12 smoke tests;
2. release Web export containing capability and lifecycle shell methods;
3. strict TypeScript tests for state, telemetry and lifecycle;
4. production Vite build containing HTML, JavaScript, WASM and PCK;
5. Pixel 8 Pro viewport telemetry proof;
6. pagehide/pageshow suspend and restore proof;
7. unchanged canonical signature after restore;
8. full-motion and reduced-motion screenshots;
9. before/after visual comparison report;
10. canvas activation proof;
11. live Three.js fallback and archive branch preserved.

CI device emulation is not a substitute for physical GPU, thermal and battery measurements. The actual Pixel 8 Pro telemetry capture remains the external release gate described in `CRYSTAL_PHASE_12.md`.
