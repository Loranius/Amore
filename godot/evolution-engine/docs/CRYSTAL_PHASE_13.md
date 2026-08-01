# Crystal Phase 13 — Physical Device Acceptance & Progressive Rollout

Phase 13 converts the Phase 12 physical-device release gate into a repeatable in-portal workflow and adds a controlled production rollout.

It does not change:

- Artifact DNA;
- Evolution Events;
- append-only canonical history;
- Growth Instructions;
- hierarchy, collision or colony accumulation;
- Crystal geometry, materials or Phase 10 appearance;
- Supabase ownership or portal navigation.

## Diagnostic entry point

Append the query parameter to a deployed preview URL:

```text
?godotDiagnostics=1
```

The normal portal does not show the panel. The query-gated console displays:

- sample count;
- average and minimum FPS;
- p95 frame time;
- maximum static memory;
- selected quality tier;
- orbit evidence;
- background restore evidence;
- every acceptance criterion;
- copy and JSON export actions.

## Privacy boundary

The exported report intentionally excludes:

- Artifact DNA;
- Evolution Event IDs or content;
- relationship memories;
- Supabase rows, credentials or tokens;
- names, captions or module payloads.

It contains only runtime versions, the deterministic signature, anonymous browser/device characteristics, telemetry aggregates, lifecycle evidence and interaction counts.

## Interaction evidence

Godot now emits a separate validated message:

```ts
{
  type: 'amore:godot:interaction',
  kind: 'orbit' | 'zoom' | 'tap' | 'keyboard',
  sequence: 1,
}
```

Activation and interaction remain different contracts:

- tap and keyboard may activate the existing React action;
- orbit and zoom never activate it;
- all completed interactions can contribute evidence to the acceptance report;
- suspended runtime emits neither activation nor interaction evidence.

## Runtime health policy

Only active, non-suspended telemetry enters health evaluation.

### Windows

- warm-up: 8 samples;
- device acceptance: 30 samples;
- fatal critical streak: 8 consecutive samples;
- retained diagnostic history: 120 samples.

### Thresholds

| Signal | Degraded | Critical |
| --- | ---: | ---: |
| FPS | below 28 | below 18 |
| frame time | above 40 ms | above 70 ms |
| static memory | above 384 MiB | above 512 MiB |

Brief drops do not cause renderer fallback. Production switches to Three.js only after eight consecutive critical samples.

The health reducer exposes:

- `warming`;
- `healthy`;
- `degraded`;
- `critical`.

It also records average/minimum FPS, p95 frame time, maximum memory and maximum draw calls.

## Workflow proof versus physical acceptance

Phase 13 deliberately separates two outcomes.

### Automated workflow proof

`workflowPassed` requires:

1. accepted portal runtime;
2. at least 30 active telemetry samples;
3. a completed orbit gesture;
4. one background restore;
5. an unchanged deterministic signature;
6. a captured full/reduced motion profile.

CI may pass this workflow even when its software renderer is slow.

### Physical acceptance

`passed` additionally requires:

1. `healthyRuntime === true`;
2. a non-automated browser environment.

`navigator.webdriver === true` marks the report as `assessment: automation`. Such a report can never claim `PHYSICAL PASS`.

This distinction is required because GitHub Chromium uses a software renderer. In the Phase 13 investigation it produced approximately 7–9 FPS, correctly classified as critical. Lowering the physical thresholds merely to make CI green is forbidden.

## Physical Pixel 8 Pro procedure

1. Open the deployed Vercel preview on the actual Pixel 8 Pro.
2. Add `?godotDiagnostics=1` to the URL.
3. Keep the page active until at least 30 samples are collected.
4. Rotate the Crystal with one clear orbit gesture.
5. Send the browser/app to the background.
6. Return to the portal and confirm one restore.
7. Confirm the deterministic signature remains present and unchanged.
8. Review FPS, p95 frame time and memory.
9. Save or copy the JSON report.
10. Repeat once with Android reduced-motion enabled.

Only the real-phone report can show `PHYSICAL PASS`.

## Progressive rollout

Production rollout is controlled by:

```text
VITE_EVOLUTION_GODOT=production
VITE_EVOLUTION_GODOT_ROLLOUT=0..100
```

Each browser receives a persistent anonymous cohort key in local storage. A deterministic hash maps it to a bucket from `0` to `99`.

- `0` keeps all production users on Three.js;
- `5` enables Godot for approximately 5% of stable browser cohorts;
- `25`, `50` and `100` expand the rollout without changing code;
- preview mode ignores the percentage and remains explicitly enabled;
- disabled mode always uses Three.js.

A browser remains in the same cohort across sessions instead of randomly changing renderer on every load.

## Production fallback

The existing fallback reasons remain:

- frame load failure;
- Godot runtime error;
- startup timeout;
- canonical state mismatch.

Phase 13 adds:

- `performance-health` after eight consecutive critical active samples.

Health fallback is enabled only in the real production Crystal route. CI enables it only in its dedicated synthetic fallback test so software-renderer performance cannot invalidate the separate workflow proof.

## Acceptance gates

Phase 13 requires:

1. Godot 4.7.1 parser/import success;
2. all prior Crystal smoke tests;
3. tap/orbit/zoom/keyboard interaction smoke proof;
4. strict bridge validation for interaction messages;
5. deterministic health-policy tests;
6. deterministic rollout-cohort tests;
7. privacy-safe report tests;
8. production TypeScript and Vite build;
9. Web export with HTML, JavaScript, WASM and PCK;
10. automated 30-sample workflow proof;
11. automated orbit and background restore evidence;
12. unchanged signature after restore;
13. separate sustained-critical fallback proof;
14. tap activation and reduced-motion regression proof;
15. browser artifact upload;
16. no automated report claiming physical acceptance;
17. actual Pixel 8 Pro JSON report before rollout beyond the initial controlled cohort.
