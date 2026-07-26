# Change Control and ADR Policy

## Changes Requiring an ADR

An ADR is mandatory for:

- changing a volume boundary;
- adding a cross-volume dependency;
- changing canonical serialization or hash scope;
- changing the deterministic PRNG algorithm;
- changing published state shape incompatibly;
- adding a new persistence or execution model;
- changing error compatibility or migration policy;
- replacing a foundational library or language profile.

## ADR Process

1. Copy `docs/05_ADR/ADR_TEMPLATE.md`.
2. Describe context and constraints.
3. List alternatives and consequences.
4. Identify affected requirement IDs and migrations.
5. Mark status Proposed.
6. Obtain explicit project-owner acceptance.
7. Only then implement and mark Accepted.

## Compatibility

Breaking changes require:

- major version increment;
- migration path or explicit non-migratable declaration;
- updated golden fixtures;
- updated compatibility tests;
- changelog entry.
