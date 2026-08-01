# Amore Evolution Engine — Godot 4.7.1

This directory is the 3D runtime for Amore artifacts. React/Vite remains the portal shell; Godot owns only procedural 3D generation, presentation and interaction for Crystal, Tree and Reef.

## Migration safety

The accepted Three.js implementation is preserved at:

- branch: `archive/threejs-evolution-engine-2026-07-31`;
- source commit: `0b9fda4187aa2d1e9bf80f4b0c56c296ea0e5480`.

The live Crystal route still contains automatic Three.js fallback. Godot has no Supabase credentials, write path or portal-navigation authority.

## Current Crystal vertical slice

The runtime provides:

1. immutable Artifact DNA and sorted append-only Evolution Events;
2. deterministic semantic pressure, hierarchy and collision resolution;
3. aggregate colony projection without deleting canonical evidence;
4. procedural integrated Crystal geometry;
5. deterministic Phase 10 mineral presentation;
6. runtime-only Life Engine animation and reduced-motion support;
7. strict same-origin React ↔ Godot bridge validation;
8. production fallback for load, runtime, timeout and state mismatch failures;
9. tap/keyboard activation without orbit-drag activation;
10. `high`, `balanced` and `economy` mobile presentation tiers;
11. background suspension and restore without canonical rebuild;
12. FPS, frame-time, draw-call, primitive and memory telemetry;
13. Phase 13 orbit/zoom/tap/keyboard interaction evidence;
14. 30-sample device acceptance reports;
15. sustained-performance Three.js fallback;
16. stable percentage-based production cohorts;
17. Phase 14 blocked-by-default production release approval;
18. SHA-256 binding to an exact frozen physical PASS report;
19. fixed 5/25/50/100 rollout ceilings and an emergency kill switch.

Every event remains present in canonical state and history. Renderer quality, health and release policies never alter growth instructions, colony membership or the deterministic snapshot signature.

## Runtime and release mode

```text
VITE_EVOLUTION_GODOT=disabled   → Three.js
VITE_EVOLUTION_GODOT=preview    → explicit Godot preview
VITE_EVOLUTION_GODOT=production → Phase 14 release gate + cohort + fallback
```

Production requires:

```bash
VITE_EVOLUTION_GODOT_RELEASE_STAGE=canary-5
VITE_EVOLUTION_GODOT_RELEASE_ID=crystal-phase14-20260801
VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256=<SHA-256 of exact frozen PHYSICAL PASS JSON>
VITE_EVOLUTION_GODOT_KILL_SWITCH=off
VITE_EVOLUTION_GODOT_ROLLOUT=5
```

Allowed stage ceilings:

| Stage | Maximum effective rollout |
| --- | ---: |
| `blocked` | 0% |
| `canary-5` | 5% |
| `ramp-25` | 25% |
| `ramp-50` | 50% |
| `released-100` | 100% |

The lower value between the requested rollout and the stage ceiling wins. A persistent anonymous cohort bucket prevents random renderer switching between sessions. `VITE_EVOLUTION_GODOT_KILL_SWITCH=on` always forces Three.js.

An optional runtime-only DNA trait may request a presentation tier:

```json
{
  "runtime_quality": "auto | high | balanced | economy"
}
```

## Mobile quality bounds

| Tier | 3D scale | Life Engine | Shadow | Glow |
| --- | ---: | ---: | --- | --- |
| high | 1.00 | 60 Hz | on | on |
| balanced | 0.86 | 30 Hz | on | on |
| economy | 0.72 | 20 Hz | off | off |

## Device diagnostics and release candidate

Open a deployed preview with:

```text
?godotDiagnostics=1
```

The panel collects 30 active samples, orbit evidence and background restore evidence, then creates a privacy-safe JSON report.

The report distinguishes:

- `WORKFLOW PASS` — automated bridge/lifecycle/interaction proof;
- `PHYSICAL PASS` — healthy telemetry from a non-automated real device.

CI software rendering can never claim physical acceptance. After a real `PHYSICAL PASS`, the `Зафіксувати release candidate` action freezes the exact report bytes, calculates SHA-256 and generates the initial 5% canary environment block.

## Run locally

Open `godot/evolution-engine/project.godot` in Godot 4.7.1.

Headless tests:

```bash
godot --headless --path godot/evolution-engine --script res://scripts/tests/determinism_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/growth_hierarchy_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/semantic_pressure_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/colony_accumulation_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/life_engine_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/visual_polish_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/integrated_fusion_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/portal_cutover_smoke.gd
godot --headless --path godot/evolution-engine --script res://scripts/tests/mobile_runtime_smoke.gd
```

React/Web verification:

```bash
npm test
npm run build
npx playwright test --config=playwright.godot.config.ts
```

A production build without a valid Phase 14 release environment intentionally renders Three.js.

## Architectural boundary

```text
React / Vite / Supabase
        |
        | physical report digest + release stage + stable cohort
        v
Phase 14 release control
        |
        | accepted Artifact DNA + Evolution Events
        v
Godot Evolution Runtime (accepted Phase 13 runtime)
        |
        +-- deterministic growth and geometry
        +-- visual profile and Life Engine
        +-- quality governor
        +-- lifecycle / telemetry / interaction bridge
        v
Same-origin Web canvas
        |
        +-- approved, accepted and healthy → keep Godot
        +-- closed gate / non-cohort → Three.js
        +-- sustained critical health → Three.js fallback
        +-- fatal bridge failure → Three.js fallback
```

See:

- `docs/CRYSTAL_PHASE_11.md` — production portal cutover;
- `docs/CRYSTAL_PHASE_12.md` — mobile runtime hardening;
- `docs/CRYSTAL_PHASE_13.md` — physical acceptance and workflow proof;
- `docs/CRYSTAL_PHASE_14.md` — auditable release control and staged promotion;
- `docs/WEB_RUNTIME_BRIDGE.md` — same-origin bridge contract.
