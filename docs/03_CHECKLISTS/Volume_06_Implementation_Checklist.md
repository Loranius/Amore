# Volume VI Implementation Checklist

## Preparation

- [ ] Target volume and all upstream contracts were read.
- [ ] Applicable `V6-REQ-*` IDs were copied into the task plan.
- [ ] Existing code and tests were audited before edits.
- [ ] Public package boundary and forbidden imports were confirmed.

## Required Capability

- [ ] definitions and layers
- [ ] masks
- [ ] patterns
- [ ] blend system
- [ ] graphs and validation
- [ ] bindings
- [ ] optimization
- [ ] baking metadata

## Crystal Attachment Integrity — When Enabled

- [ ] external-region-only material binding.
- [ ] no binding on removed/internal faces.
- [ ] junction seam-band blend masks.
- [ ] no child texture/normal/emissive breakthrough through the host.
- [ ] LOD material-region ownership.

## State Contract

- [ ] `MaterialState` has a runtime schema.
- [ ] `MaterialState` is readonly after publication.
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
- [ ] Material tests cover internal-region exclusion, seam-band bounds, underside breakthrough, and every LOD.

## Architecture Audit

- [ ] No downstream package import.
- [ ] No direct UI, React, Three.js, database, or network dependency in deterministic core.
- [ ] No wall-clock or unseeded randomness in authoritative logic.
- [ ] No mutable published state or hidden global state.
- [ ] Diagnostics do not affect output.

## Exit Evidence

- [ ] All `V6-REQ-*` records are `VERIFIED`.
- [ ] Format, lint, typecheck, tests, and build pass.
- [ ] Implementation report is complete.
- [ ] Remaining risks are documented.
