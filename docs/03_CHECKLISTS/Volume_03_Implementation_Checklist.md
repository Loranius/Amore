# Volume III Implementation Checklist

## Preparation

- [ ] Target volume and all upstream contracts were read.
- [ ] Applicable `V3-REQ-*` IDs were copied into the task plan.
- [ ] Existing code and tests were audited before edits.
- [ ] Public package boundary and forbidden imports were confirmed.

## Required Capability

- [ ] skeleton and graph
- [ ] node state machine
- [ ] energy distribution
- [ ] space reservation
- [ ] collision prediction
- [ ] direction solver
- [ ] constraints and stress
- [ ] repair and memory

## Crystal Attachment Integrity — When Enabled

- [ ] volumetric junction reservation includes child radius, direction, and projected length.
- [ ] deterministic sector-balanced/non-clumping placement.
- [ ] minimum angular, surface, and volumetric clearance.
- [ ] collision rejection outside junction zones.
- [ ] outward organic direction flow without rigid radial symmetry.

## State Contract

- [ ] `GrowthState` has a runtime schema.
- [ ] `GrowthState` is readonly after publication.
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
- [ ] Property tests cover sector balance, minimum spacing, thin-host limits, and outside-junction collision rejection.

## Architecture Audit

- [ ] No downstream package import.
- [ ] No direct UI, React, Three.js, database, or network dependency in deterministic core.
- [ ] No wall-clock or unseeded randomness in authoritative logic.
- [ ] No mutable published state or hidden global state.
- [ ] Diagnostics do not affect output.

## Exit Evidence

- [ ] All `V3-REQ-*` records are `VERIFIED`.
- [ ] Format, lint, typecheck, tests, and build pass.
- [ ] Implementation report is complete.
- [ ] Remaining risks are documented.
