# Godot Web runtime bridge

## Status

Phase 11 establishes the guarded production cutover. Phase 12 adds capability detection, lifecycle suspension and telemetry. Phase 13 adds validated interaction evidence, runtime-health fallback and honest device reports. Phase 14 adds an auditable release-control boundary before the bridge can enter production.

## Runtime selection

```text
VITE_EVOLUTION_GODOT=disabled
VITE_EVOLUTION_GODOT=preview
VITE_EVOLUTION_GODOT=production
VITE_EVOLUTION_GODOT_ROLLOUT=0..100
```

- disabled always selects Three.js;
- preview explicitly selects Godot without production approval;
- production requires an open Phase 14 release gate and an eligible persistent browser cohort;
- any fatal or sustained-critical cutover failure selects the existing Three.js fallback.

## Phase 14 release boundary

Production additionally reads:

```text
VITE_EVOLUTION_GODOT_RELEASE_STAGE
VITE_EVOLUTION_GODOT_RELEASE_ID
VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256
VITE_EVOLUTION_GODOT_KILL_SWITCH
```

The gate opens only when:

- stage is one of `canary-5`, `ramp-25`, `ramp-50`, `released-100`;
- release ID matches the bounded identifier format;
- acceptance digest is exactly 64 hexadecimal SHA-256 characters;
- kill switch is inactive.

Stage ceilings are fixed at 5%, 25%, 50% and 100%. The requested rollout cannot exceed the current stage. `blocked` or an active kill switch produces an effective rollout of 0%.

This control runs before iframe creation. A closed gate is a normal Three.js selection, not a runtime failure. The physical report digest is public audit metadata, not a secret or credential.

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
- device reports exclude DNA, events and relationship content;
- release approval changes renderer selection only and cannot mutate canonical data.

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

The accepted Phase 13 runtime additionally reports the quality tier, render scale, Life Engine rate and phase number. Phase 14 does not modify this runtime state or signature.

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

## Device acceptance and frozen candidate

The query-gated panel is enabled through:

```text
?godotDiagnostics=1
```

The report contains runtime versions, deterministic signature, anonymous environment data, health aggregates, latest telemetry, lifecycle evidence and interaction counts.

It exposes two separate results:

- `workflowPassed` — bridge, telemetry window, orbit, restore, signature and motion proof;
- `passed` — workflow proof plus healthy telemetry from a non-automated browser.

`navigator.webdriver === true` marks the assessment as automation. Automated CI can never claim physical acceptance.

After `PHYSICAL PASS`, Phase 14 validates the report again and freezes exact JSON bytes. SHA-256 is calculated from those bytes, so editing or reformatting the saved report invalidates its digest.

## Controlled fallback

The host resolves to `three-fallback` after:

1. iframe load failure;
2. explicit runtime error;
3. startup timeout;
4. canonical state mismatch;
5. sustained critical performance health.

Background suspension alone is not fatal. Closed release gates and non-selected cohorts use ordinary `three`, not `three-fallback`.

## Phase 14 verification

The release path requires:

1. all Phase 1–13 runtime and browser checks;
2. production blocked by default;
3. strict physical-report import validation;
4. exact SHA-256 generation tests;
5. fixed stage-ceiling tests;
6. emergency kill-switch precedence;
7. production bundle with an explicitly synthetic CI approval fixture;
8. browser workflow, restore, signature and fallback regression proof;
9. a real frozen Pixel 8 Pro report before any actual canary deployment.
