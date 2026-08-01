# Crystal Phase 14 — Release Control & Auditable Promotion

## Purpose

Phase 14 converts the Phase 13 physical-device result into a controlled production release. It does not change the Crystal runtime, Artifact DNA, Evolution Events, canonical history, geometry, materials, Life Engine behavior or deterministic signature.

The Godot runtime remains the accepted Phase 13 runtime. Phase 14 is a React/Vite release-control layer around it.

## Safety invariant

`VITE_EVOLUTION_GODOT=production` is no longer sufficient to enable Godot.

Production requires all of the following:

1. a non-blocked release stage;
2. a valid release ID;
3. a 64-character SHA-256 digest of the exact frozen physical PASS JSON;
4. an inactive emergency kill switch;
5. membership in the effective rollout cohort.

Failure of any requirement keeps Three.js active. Preview mode remains available without physical production approval.

## Physical release candidate

Open the deployed preview on the physical device with:

```text
?godotDiagnostics=1
```

Complete the Phase 13 procedure:

1. wait for at least 30 active telemetry samples;
2. complete an orbit gesture;
3. send the page to background and restore it;
4. confirm the deterministic signature is unchanged;
5. confirm the console shows `PHYSICAL PASS`.

Then press `Зафіксувати release candidate`.

The console:

- validates the report again;
- freezes the exact formatted JSON bytes;
- calculates SHA-256 in the browser;
- creates a release ID;
- generates the initial 5% canary environment block;
- allows the frozen report to be saved.

The digest must correspond to the exact saved frozen report. Reformatting or editing the JSON changes its digest.

## Release stages

| Stage | Maximum effective rollout |
| --- | ---: |
| `blocked` | 0% |
| `canary-5` | 5% |
| `ramp-25` | 25% |
| `ramp-50` | 50% |
| `released-100` | 100% |

`VITE_EVOLUTION_GODOT_ROLLOUT` is only the requested percentage. Phase 14 always applies the lower value between the requested percentage and the stage ceiling.

Example: `VITE_EVOLUTION_GODOT_ROLLOUT=100` with `canary-5` still exposes Godot to only 5% of stable browser cohorts.

## Environment contract

```bash
VITE_EVOLUTION_GODOT=production
VITE_EVOLUTION_GODOT_RELEASE_STAGE=canary-5
VITE_EVOLUTION_GODOT_RELEASE_ID=crystal-phase14-20260801
VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256=<64 hex characters>
VITE_EVOLUTION_GODOT_KILL_SWITCH=off
VITE_EVOLUTION_GODOT_ROLLOUT=5
```

Release IDs accept 3–64 ASCII letters, digits, `.`, `_` and `-`.

The acceptance digest is intentionally exposed to the client. It contains no credentials and acts as an auditable link to the approved privacy-safe report. It is not a Supabase secret or an authentication token.

## Emergency rollback

Set:

```bash
VITE_EVOLUTION_GODOT_KILL_SWITCH=on
```

The effective rollout becomes 0% regardless of stage, requested rollout or cohort. The portal renders the existing Three.js implementation. No canonical state or Supabase data is changed.

Runtime `performance-health`, startup, state mismatch and iframe failures continue to use the existing per-session automatic Three.js fallback.

## Promotion procedure

Promotion must be monotonic and deliberate:

```text
blocked → canary-5 → ramp-25 → ramp-50 → released-100
```

At every step:

1. keep the same release ID and acceptance digest;
2. deploy only the new stage and requested rollout;
3. confirm no sustained `performance-health` fallback regression;
4. keep Three.js available;
5. use the kill switch or return the stage to `blocked` if the release is unhealthy.

Changing the Godot runtime, Crystal geometry or visual behavior invalidates the prior physical acceptance and requires a new report, digest and release ID.

## Validation

Phase 14 automated tests prove:

- production is blocked by default;
- malformed release IDs and digests are rejected;
- preview remains independent from production approval;
- stage ceilings cannot be bypassed by a larger requested rollout;
- the kill switch overrides all release settings;
- automation reports cannot be promoted as physical reports;
- incomplete, unhealthy or missing-orbit reports are rejected;
- SHA-256 is generated from exact report bytes;
- the Phase 13 runtime, bridge, restore, signature and fallback suite remains green.

CI uses an explicitly synthetic approved fixture only to exercise the production code path. It is not a Pixel 8 Pro approval and must never be copied into a real deployment.

## Non-goals

Phase 14 does not:

- merge the stacked PR chain;
- enable Godot on `main`;
- delete Three.js;
- claim a physical pass without the exported device report;
- upload the physical report to Supabase;
- change Crystal growth or visuals;
- start Tree or Reef migration.
