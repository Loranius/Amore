# Volume V Implementation Checklist

## Preparation

- [ ] Target volume and all upstream contracts were read.
- [ ] Applicable `V5-REQ-*` IDs were copied into the task plan.
- [ ] Existing code and tests were audited before edits.
- [ ] Public package boundary and forbidden imports were confirmed.

## Required Capability

- [ ] generator registry
- [ ] base generation
- [ ] adaptive meshing/remeshing
- [ ] topology validation
- [ ] repair and intersections
- [ ] welding
- [ ] normals/tangents/UV
- [ ] optimization/LOD/streaming

## Crystal Attachment Integrity — When Enabled

- [ ] junction region classification.
- [ ] child base-cap removal.
- [ ] hidden/internal face removal.
- [ ] local trim/Boolean/transition sealing.
- [ ] outside-junction intersection rejection.
- [ ] underside and oblique-underside visibility probes.
- [ ] LOD attachment integrity.

## State Contract

- [ ] `GeometryState` has a runtime schema.
- [ ] `GeometryState` is readonly after publication.
- [ ] Canonical serialization is stable.
- [ ] Canonical hash is recomputed and verified on load.
- [ ] Invalid state cannot publish.

## Tests

- [ ] Unit tests cover success, boundaries, and failures.
- [ ] Property tests cover core invariants.
- [ ] Public contract tests pass.
- [ ] Serialization round-trip tests pass.
- [ ] Determinism/golden tests pass.
- [ ] Relevant integration tests pass.
- [ ] Regression tests cover fixed defects.
- [ ] Geometry tests cover base-cap absence, hidden-face visibility, 360-degree/underside probes, sealing, and every LOD.

## Architecture Audit

- [ ] No downstream package import.
- [ ] No direct UI, React, Three.js, database, or network dependency in deterministic core.
- [ ] No wall-clock or unseeded randomness in authoritative logic.
- [ ] No mutable published state or hidden global state.
- [ ] Diagnostics do not affect output.

## Exit Evidence

- [ ] All `V5-REQ-*` records are `VERIFIED`.
- [ ] Format, lint, typecheck, tests, and build pass.
- [ ] Implementation report is complete.
- [ ] Remaining risks are documented.
