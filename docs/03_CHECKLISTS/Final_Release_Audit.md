# Final Release Audit

## Documentation and Traceability

- [ ] All normative documents pass `scripts/validate_documentation.py`.
- [ ] Every requirement ID has implementation and test evidence.
- [ ] All accepted ADRs are reflected in current docs.
- [ ] No conflicting terminology remains.
- [ ] Existing Amore responsibilities were reused; no unjustified duplicate engine implementation exists.
- [ ] Deferred live product-module reaction wiring remains unchanged unless explicitly approved.

## Architecture

- [ ] Package dependency graph follows volume boundaries.
- [ ] Core packages have no UI, database, network, or framework leaks.
- [ ] All adapters use public ports.
- [ ] Published states are immutable and atomic.

## Determinism

- [ ] PRNG test vectors pass.
- [ ] Canonical serializer fixtures pass.
- [ ] Repeated fresh-process runs match.
- [ ] Worker-count permutations match.
- [ ] Input insertion-order permutations match.
- [ ] Checkpoint and save/load continuation match.
- [ ] Supported CI platforms produce expected hashes.

## Functional Pipeline

- [ ] Volume I–VII integration scenario passes.
- [ ] Failure in every mandatory stage prevents new EngineState publication.
- [ ] Last valid state remains recoverable.
- [ ] Version incompatibilities and bad checksums are rejected.

## Crystal Attachment Integrity — When Enabled

- [ ] All `CAI-REQ-*` records are `VERIFIED`.
- [ ] Child placement is volumetric, deterministic, sector-balanced, non-clumping, and not rigidly symmetric.
- [ ] Every physical child has a valid AttachmentJunction.
- [ ] Child base caps and hidden/internal faces are absent from the external shell.
- [ ] No crystal-body intersection exists outside declared junction zones.
- [ ] Junctions are sealed without cracks, coplanar duplicates, or z-fighting.
- [ ] Strict and oblique underside probes expose no internal geometry.
- [ ] Child material does not appear through unrelated host regions.
- [ ] All published LODs pass geometry and material integrity checks.
- [ ] Geometry/topology evidence accompanies visual fixtures.

## Quality

- [ ] Format, lint, typecheck, full test suite, and build pass.
- [ ] No production placeholders or unresolved final-state markers remain.
- [ ] Dependency/security audit is reviewed.
- [ ] Performance baselines are recorded and output hashes match.

## Release Artifacts

- [ ] Changelog is updated.
- [ ] Specification, implementation, and schema versions are pinned.
- [ ] Golden fixture update is explained.
- [ ] Clean checkout can install, build, test, save, load, and replay.
