# Crystal Geological Growth — Phase 1A Implementation Report

## Scope

Add a deterministic, renderer-independent Surface Atlas over the aggregate analytical crystal mass. This is the compatibility-safe foundation for replacing parent/child site selection with geological growth regions.

The slice does not yet change deposited body transforms, `hostBodyId`, geometry, materials, renderer code, Supabase integration, or production rollout.

## Requirement IDs

- `V3-REQ-001` — preserved: the atlas contains logical surface data only and creates no mesh.
- `V3-REQ-002` — advanced: body and region ordering use explicit deterministic tie-breaking.
- `V3-REQ-005` — groundwork: active regions provide a future reservation domain before node creation.
- `V3-REQ-010` — advanced: density, stress and potential are canonical current-field summaries rather than mutable logs.
- `V3-REQ-012` — preserved: no final mesh or material is generated.
- `V3-REQ-014` — groundwork only: seeded phase and golden-angle band offsets avoid rigid atlas symmetry; placement is not switched to the atlas in this slice.

No requirement is marked fully verified by this foundation slice alone.

## Files and Public Contracts Changed

- `src/engine/growth/surfaceAtlas.ts`
  - adds `GrowthSurfaceRegion`;
  - adds `GrowthSurfaceAtlas`;
  - adds `buildGrowthSurfaceAtlas()`.
- `src/engine/growth/surfaceAtlas.test.ts`
  - adds deterministic and append-only regression coverage.
- `src/engine/growth/index.ts`
  - exports the new public API.

## Design Notes

Each body publishes five longitudinal bands with eight seeded sectors per band. Region identity, source body, coordinates and normals depend only on the historical body. Exposure, occupancy, local density, surface stress and growth potential are derived from the full current aggregate mass.

Covered or occupied regions publish zero growth potential. `sourceBodyId` records provenance only; it is not a new parent/child growth rule.

## Tests Added or Changed

- body-array order does not affect atlas output;
- region IDs are unique;
- coordinates and normals are finite;
- stress, density and potential stay in `[0, 1]`;
- covered regions cannot remain active;
- later growth does not change historical region identity, coordinates or normals;
- occupied regions receive zero future growth potential.

## Commands Executed

| Command | Result | Notes |
|---|---|---|
| `tsc -p /tmp/amore-slice/tsconfig.json` | PASS | Isolated slice compiled with repository strict/no-unused/isolated-module flags. |
| `tsc -p /tmp/amore-slice/tsconfig.emit.json && node dist/run-test.js` | PASS | Deterministic manual harness: 80 regions, 72 exposed, 72 active. |
| GitHub combined status for `65fa1b8fd968b95155c4930af762e7a0965bfa08` | NO CHECKS | The repository returned no commit status checks. |

The full repository `npm test`, `npm run typecheck`, and `npm run build` could not be executed from the connector-only environment because the repository cannot be cloned there. They are not claimed as passed.

## Determinism and Fixture Evidence

The atlas sorts bodies by numeric sequence and code-point string comparison. Sector phase comes from the existing deterministic seeded hash utility. No wall clock, locale sorting, network data, or unseeded randomness is used.

Historical structural region fields remain byte-stable when a later body is appended. Current-field values such as density, exposure, stress and potential may legitimately change as the mineral mass grows.

## Serialization/Migration Evidence

`GrowthState` and its version are unchanged. The atlas is a derived public product, so existing serialized states and hashes require no migration in Phase 1A.

## Architecture Boundary Check

- no React or UI import;
- no Three.js or R3F import;
- no Supabase, database, network, or browser dependency;
- no mesh or material generation;
- no mutable global state;
- no change to current live module reactions.

## Remaining Risks

- Growth Engine still chooses a host body before sampling a site.
- `hostBodyId` still has spatial meaning in current placement.
- Atlas coverage uses analytical body envelopes, not the later fused external shell.
- Full repository gates remain unexecuted until a CI or complete checkout is available.

## Next Safe Task

Phase 1B: make `chooseCandidate()` rank active Surface Atlas regions across the complete aggregate mass, store the selected region identity in the attachment contract, and retain `hostBodyId` only as compatibility/provenance data.
