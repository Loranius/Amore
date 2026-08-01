# Godot Web runtime bridge

## Status

Phase 11 establishes the guarded production cutover. Phase 12 adds capability detection, lifecycle suspension and telemetry. Phase 13 adds validated interaction evidence, runtime-health fallback, device reports and progressive rollout without expanding Godot's data authority.

## Runtime selection

```text
VITE_EVOLUTION_GODOT=disabled
VITE_EVOLUTION_GODOT=preview
VITE_EVOLUTION_GODOT=production
VITE_EVOLUTION_GODOT_ROLLOUT=0..100
```

- disabled always selects Three.js;
- preview explicitly selects Godot;
- production selects Godot only for an eligible persistent browser cohort;
- any fatal cutover failure selects the existing Three.js fallback.

## Build output

The Web export contains:

```text
index.html
index.js
index.wasm
index.pck
```

CI stages the files under `public/godot/evolution-engine/` and rejects a production build when any required output is missing.

## Security and ownership boundary

The React host and Godot iframe are same-origin.

- React accepts messages only from the expected iframe window and current origin;
- the shell accepts payloads only from `window.parent` and current origin;
- Godot receives canonical serialized input, never Supabase credentials or access tokens;
- Godot cannot write history or own portal navigation;
- device reports exclude DNA, events and relationship content.

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

## Custom shell API

```text
takePayload()
takeLifecycle()
capabilitiesJson()
postBase64(encodedMessage)
```

Capabilities include available memory, CPU concurrency, device-pixel ratio, viewport, visibility and reduced-motion preference.

Lifecycle states are queued with a bounded queue:

```text
hidden, visible, pagehide, pageshow,
freeze, resume, context-lost, context-restored
```

## Godot → host messages

The runtime emits:

- `amore:godot:booting`;
- `amore:godot:progress`;
- `amore:godot:engine-started`;
- `amore:godot:ready`;
- `amore:godot:state`;
- `amore:godot:telemetry`;
- `amore:godot:lifecycle`;
- `amore:godot:interaction`;
- `amore:godot:activate`;
- `amore:godot:error`.

### Accepted state

Only `source: portal` can be accepted. React verifies species, seed, input-event count, canonical history bounds, instruction counts and deterministic signature.

The Phase 13 state additionally reports the quality tier, render scale, Life Engine rate and phase number. Quality remains presentation-only.

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

Suspended telemetry is excluded from health evaluation.

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

Suspension pauses Life Engine, disables orbit input and blocks activation. Restore reapplies the active tier without rebuilding canonical state.

### Interaction evidence

```ts
{
  type: 'amore:godot:interaction',
  kind: 'orbit',
  sequence: 1,
}
```

Valid kinds are `orbit`, `zoom`, `tap` and `keyboard`.

The interaction message is distinct from activation:

- tap/keyboard can activate the portal action;
- orbit/zoom never activate it;
- completed interactions are counted in the device report;
- malformed kinds or non-positive sequence values are rejected.

## Runtime health

React classifies active telemetry as warming, healthy, degraded or critical.

Production fallback requires eight consecutive critical samples. A single slow frame or short startup drop does not trigger fallback.

Health thresholds and the complete acceptance procedure are defined in `CRYSTAL_PHASE_13.md`.

## Device acceptance report

The query-gated panel is enabled through:

```text
?godotDiagnostics=1
```

The report contains runtime versions, deterministic signature, anonymous environment data, health aggregates, latest telemetry, lifecycle evidence and interaction counts.

It exposes two separate results:

- `workflowPassed` — bridge, telemetry window, orbit, restore, signature and motion proof;
- `passed` — workflow proof plus healthy telemetry from a non-automated browser.

`navigator.webdriver === true` marks the assessment as automation. Automated CI can never claim physical acceptance.

## Controlled fallback

The host resolves to `three-fallback` after:

1. iframe load failure;
2. explicit runtime error;
3. startup timeout;
4. canonical state mismatch;
5. sustained critical performance health.

Background suspension alone is not fatal.

## Phase 13 verification

The bridge requires:

1. Godot parser and all prior smoke tests;
2. interaction smoke proof;
3. strict state, telemetry, lifecycle and interaction validation;
4. deterministic health, rollout and report tests;
5. release Web export;
6. production Vite build;
7. automated 30-sample workflow proof;
8. orbit and background restore proof;
9. unchanged signature after restore;
10. dedicated critical-health fallback proof;
11. tap and reduced-motion regressions;
12. browser artifact upload;
13. a real Pixel 8 Pro report before broad production rollout.
