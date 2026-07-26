# Volume I Implementation Checklist

## Preparation

- [ ] Target volume and all upstream contracts were read.
- [ ] Applicable `V1-REQ-*` IDs were copied into the task plan.
- [ ] Existing code and tests were audited before edits.
- [ ] Public package boundary and forbidden imports were confirmed.

## Required Capability

- [ ] timeline and logical tick
- [ ] stable event queue ordering
- [ ] transaction rollback and atomic publication
- [ ] deterministic RNG streams
- [ ] resource claims
- [ ] checkpoints
- [ ] replay
- [ ] DNA version registry references

## State Contract

- [ ] `WorldState` has a runtime schema.
- [ ] `WorldState` is readonly after publication.
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

## Architecture Audit

- [ ] No downstream package import.
- [ ] No direct UI, React, Three.js, database, or network dependency in deterministic core.
- [ ] No wall-clock or unseeded randomness in authoritative logic.
- [ ] No mutable published state or hidden global state.
- [ ] Diagnostics do not affect output.

## Exit Evidence

- [ ] All `V1-REQ-*` records are `VERIFIED`.
- [ ] Format, lint, typecheck, tests, and build pass.
- [ ] Implementation report is complete.
- [ ] Remaining risks are documented.
