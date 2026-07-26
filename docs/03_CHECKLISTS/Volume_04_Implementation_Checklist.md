# Volume IV Implementation Checklist

## Preparation

- [ ] Target volume and all upstream contracts were read.
- [ ] Applicable `V4-REQ-*` IDs were copied into the task plan.
- [ ] Existing code and tests were audited before edits.
- [ ] Public package boundary and forbidden imports were confirmed.

## Required Capability

- [ ] semantic mapping
- [ ] components
- [ ] assemblies
- [ ] anchors
- [ ] attachments
- [ ] dependency graph
- [ ] layers
- [ ] procedural assemblies

## Crystal Attachment Integrity — When Enabled

- [ ] canonical AttachmentJunction contract.
- [ ] host/child and anchor ownership.
- [ ] contact frame, penetration, radius, clearance, and allowed-overlap bounds.
- [ ] trim, seam, and material-blend policies.
- [ ] exactly-one-host validation unless bridge/intergrowth is declared.

## State Contract

- [ ] `CompositionState` has a runtime schema.
- [ ] `CompositionState` is readonly after publication.
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
- [ ] Contract and serialization tests cover every AttachmentJunction field and ownership invariant.

## Architecture Audit

- [ ] No downstream package import.
- [ ] No direct UI, React, Three.js, database, or network dependency in deterministic core.
- [ ] No wall-clock or unseeded randomness in authoritative logic.
- [ ] No mutable published state or hidden global state.
- [ ] Diagnostics do not affect output.

## Exit Evidence

- [ ] All `V4-REQ-*` records are `VERIFIED`.
- [ ] Format, lint, typecheck, tests, and build pass.
- [ ] Implementation report is complete.
- [ ] Remaining risks are documented.
