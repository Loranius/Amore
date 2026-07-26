# Definition of Done

A feature or volume is done only when all applicable conditions are true.

## Contract

- Requirement IDs are identified.
- Public inputs, outputs, errors, and version behavior are documented.
- No undocumented cross-volume dependency was introduced.
- Enabled species/profile contracts are identified and traced.

## Existing-Code Preservation

- Existing compliant code was audited before new modules were created.
- No parallel implementation duplicates an existing responsibility.
- No repository restructuring or migration occurred without an accepted ADR and owner approval.
- Deferred product reaction wiring remains unchanged unless the task explicitly authorizes it.

## Implementation

- Production implementation is complete.
- No fake fallback or placeholder is presented as final.
- State publication is immutable and atomic.
- Deterministic paths contain no forbidden source of nondeterminism.
- Failure of a mandatory geometry or material integrity check prevents publication.

## Verification

- Unit tests cover normal, boundary, and failure behavior.
- Property tests cover invariants.
- Contract tests cover public interfaces.
- Serialization round-trip tests pass.
- Replay or golden tests pass.
- Cross-volume integration tests pass where applicable.
- A regression test exists for every fixed defect.

## Crystal Attachment Integrity — When Profile Is Enabled

- Child placement reserves volumetric junction and clearance regions.
- Distribution around the host is deterministic, sector-balanced, non-clumping, and not rigidly symmetric.
- Intersections are confined to declared junction zones.
- Every physical attachment has a validated `AttachmentJunction`.
- Child base caps and hidden/internal faces are absent from the external shell.
- Junctions are sealed without cracks, coplanar duplicates, or z-fighting.
- No unrelated crystal bodies intersect.
- Strict underside and oblique underside probes reveal no internal surface.
- Child material does not break through unrelated host regions.
- Every published LOD preserves attachment integrity.
- Geometry/topology evidence accompanies visual fixtures; screenshots alone are insufficient.

## Quality Gates

- formatting passes;
- lint passes;
- typecheck passes;
- tests pass without flaky retries;
- build passes;
- documentation validator passes;
- no unexpected generated files or secrets are present.

## Evidence

- Traceability is updated.
- Implementation report is complete.
- Performance impact is measured for algorithmic hot paths.
- Before/after fixtures and canonical hashes are recorded where output changes.
- Remaining risks are explicit.
