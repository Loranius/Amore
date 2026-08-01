# Crystal Phase 15 — Release Candidate Deployment & Rollback Drill

## Goal

Phase 15 turns the Phase 14 approved release metadata into one auditable, deployable build. It does not change Crystal growth, geometry, materials, Life Engine behavior, Artifact DNA, Evolution Events or deterministic signatures.

## Release candidate manifest

After the Vite production build, CI runs:

```bash
node scripts/generate-godot-release-candidate.mjs
```

The script reads the exact deployed Godot files:

- `index.html`;
- `index.js`;
- `index.wasm`;
- `index.pck`.

It writes `godot/evolution-engine/release-manifest.json` inside the deployment bundle with:

- release candidate schema and Phase 15 marker;
- Godot runtime version `4.7.1`;
- approved release ID;
- SHA-256 of the exact frozen physical acceptance JSON;
- Git build SHA;
- generation timestamp;
- byte size and SHA-256 for every required Godot asset;
- exact aggregate byte count.

The manifest contains no Artifact DNA, events, Supabase data or relationship content.

## Browser preflight

Production mode performs a no-store fetch of `release-manifest.json` before creating the Godot iframe.

The iframe is mounted only when all checks pass:

1. manifest schema is `godot-release-candidate-v1`;
2. phase is exactly `15`;
3. runtime is exactly Godot `4.7.1`;
4. release ID matches the Phase 14 release gate;
5. physical-report digest matches the Phase 14 release gate;
6. build SHA is valid;
7. all four required assets exist exactly once;
8. every asset has a positive byte size and valid SHA-256;
9. aggregate bytes equal the sum of the asset entries.

Failure produces `release-preflight` and selects the existing Three.js fallback. Godot is not partially mounted.

## Cache integrity

Godot files are excluded from the PWA precache. Runtime caching is now:

- `NetworkFirst`;
- isolated by release ID;
- bounded to 12 files;
- allowed to use its matching offline cache only after the network timeout.

This prevents a new release candidate from reusing the previous candidate's fixed-name `.wasm`, `.pck` or shell files.

`vercel.json` additionally requires revalidation for the Godot shell and binaries and disables caching for the release manifest.

## Operator URLs

### Release operations panel

```text
?godotReleaseOps=1
```

Shows only release metadata:

- preflight state and reason;
- release ID;
- build SHA;
- runtime version;
- asset count and total size;
- truncated asset hashes.

### Local rollback drill

```text
?godotRollbackDrill=1
```

The current browser selects Three.js before the Godot iframe is mounted.

This drill:

- does not change Vercel environment variables;
- does not report a runtime failure;
- does not write Supabase;
- does not mutate canonical state;
- uses the same deterministic React pipeline that would be used by normal Three.js fallback.

The global emergency rollback remains `VITE_EVOLUTION_GODOT_KILL_SWITCH=on`, which requires a deployment/environment update.

## CI acceptance

Phase 15 must pass:

1. all Godot parser and runtime smoke tests;
2. all React/Vitest tests;
3. strict manifest validation tests;
4. production Vite build;
5. manifest generation inside both the browser-test staging directory and final `dist`;
6. successful manifest preflight before iframe mount;
7. fail-closed browser proof with a mismatched manifest;
8. rollback drill proof with no iframe and no fatal runtime error;
9. all Phase 13 lifecycle, interaction, reduced-motion and health-fallback browser regressions;
10. upload of a complete `dist + vercel.json` release-candidate artifact.

## Physical handoff

CI uses a synthetic acceptance digest and cannot authorize a real deployment.

A real Pixel 8 Pro release candidate requires:

1. deployed preview opened with `?godotDiagnostics=1&godotReleaseOps=1`;
2. `PHYSICAL PASS` from the real device;
3. frozen JSON saved locally;
4. generated release ID and SHA-256 applied to the preview environment;
5. a new Phase 15 manifest generated from that exact build;
6. successful preflight and device workflow on the deployed preview;
7. rollback drill screenshot on the same preview URL;
8. only then promotion to `canary-5`.
