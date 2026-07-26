# Serialization and Versioning Contract

## Format

Published states SHALL have a canonical logical representation and MAY have optimized binary storage representations. Binary formats SHALL round-trip to the same canonical logical state and hash.

## Manifest

Every save artifact SHALL include:

- format identifier;
- format version;
- state type;
- state schema version;
- specification versions for Volumes I–VII;
- implementation version;
- serializer version;
- PRNG algorithm/version;
- extension versions;
- canonical state hash;
- payload checksums;
- dependency state IDs and hashes.

## Atomic Save

Save SHALL write to a temporary destination, validate bytes and checksums, then atomically promote the artifact. Interrupted saves MUST NOT replace the last valid artifact.

## Load

Load SHALL:

1. parse the manifest;
2. verify checksums;
3. validate versions;
4. execute registered migrations in order;
5. validate runtime schemas;
6. recompute canonical hash;
7. reject mismatches;
8. publish only after global validation.

## Migrations

Migrations SHALL be:

- explicit;
- version-to-version;
- deterministic;
- tested with fixtures;
- idempotent when declared so;
- provenance-recorded.

A migration must never silently discard authoritative information.

## Compatibility

- Patch versions preserve behavior and wire compatibility.
- Minor versions may add backward-compatible fields or capabilities.
- Major versions may break compatibility and require migration or rejection.

Unknown required fields, unsupported major versions, or missing migrations are hard failures.
