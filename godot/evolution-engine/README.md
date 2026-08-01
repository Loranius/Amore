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
16. stable percentage-based production cohorts.

Every event remains present in canonical state and history. Renderer quality and health policies never alter growth instructions, colony membership or the deterministic snapshot signature.

## Runtime and rollout mode

```text
VITE_EVOLUTION_GODOT=disabled   → Three.js
VITE_EVOLUTION_GODOT=preview    → explicit Godot preview
VITE_EVOLUTION_GODOT=production → Godot production route with fallback

VITE_EVOLUTION_GODOT_ROLLOUT=0..100
```

Production browsers receive a persistent anonymous cohort bucket, so a user does not randomly switch renderer between sessions.

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

## Device diagnostics

Open a deployed preview with:

```text
?godotDiagnostics=1
```

The panel collects 30 active samples, orbit evidence and background restore evidence, then creates a privacy-safe JSON report.

The report distinguishes:

- `WORKFLOW PASS` — automated bridge/lifecycle/interaction proof;
- `PHYSICAL PASS` — healthy telemetry from a non-automated real device.

CI software rendering can never claim physical acceptance.

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
VITE_EVOLUTION_GODOT=production VITE_EVOLUTION_GODOT_ROLLOUT=100 npm test
VITE_EVOLUTION_GODOT=production VITE_EVOLUTION_GODOT_ROLLOUT=100 npm run build
npx playwright test --config=playwright.godot.config.ts
```

## Architectural boundary

```text
React / Vite / Supabase
        |
        | serialized Artifact DNA + Evolution Events
        v
Godot Evolution Runtime
        |
        +-- deterministic growth and geometry
        +-- visual profile and Life Engine
        +-- quality governor
        +-- lifecycle / telemetry / interaction bridge
        v
Same-origin Web canvas
        |
        +-- accepted and healthy → keep Godot
        +-- non-rollout cohort → Three.js
        +-- sustained critical health → Three.js fallback
        +-- fatal bridge failure → Three.js fallback
```

See:

- `docs/CRYSTAL_PHASE_11.md` — production portal cutover;
- `docs/CRYSTAL_PHASE_12.md` — mobile runtime hardening;
- `docs/CRYSTAL_PHASE_13.md` — physical acceptance and progressive rollout;
- `docs/WEB_RUNTIME_BRIDGE.md` — same-origin bridge contract.
