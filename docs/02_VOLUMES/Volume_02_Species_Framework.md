# Evolution Engine — Volume II

# Species Framework Specification

## 1. Purpose

The Species Framework defines species identity, DNA, traits, morphology, adaptation, mutation, validation, and SpeciesProfile publication.

## 2. Responsibilities

Volume II owns:

- Species Definitions;
- DNA schemas;
- trait schemas;
- morphology descriptors;
- adaptation rules;
- mutation rules;
- compatibility rules;
- species validation;
- SpeciesProfile serialization.

Volume II SHALL NOT create growth nodes, meshes, or materials.

## 3. Species Definition

A Species Definition SHALL include:

- species identifier;
- human-readable name;
- definition version;
- DNA schema version;
- trait schema;
- morphology schema;
- adaptation policy;
- mutation policy;
- compatibility metadata;
- validation rules.

## 4. Species Identity

Species identifiers SHALL be globally unique and stable.

Renaming a species MUST NOT change its identifier.

## 5. DNA

DNA is a versioned, serializable, deterministic parameter set.

DNA SHALL contain only declarative biological or procedural parameters.

DNA MUST NOT contain:

- mutable runtime objects;
- mesh data;
- material objects;
- thread handles;
- nondeterministic functions.

## 6. DNA Schema

A DNA Schema SHALL define:

- field names;
- field types;
- valid ranges;
- defaults;
- units;
- dependencies;
- migration rules;
- validation rules.

## 7. Traits

Traits represent interpreted species capabilities or tendencies.

Traits MAY include:

- growth tendencies;
- structural tendencies;
- environmental preferences;
- resilience;
- branching bias;
- repair capacity;
- surface tendencies;
- reproductive or propagation behaviors.

Traits SHALL be derived deterministically from DNA and environment inputs.

## 8. Trait Resolution

Trait Resolution SHALL:

1. validate DNA;
2. resolve defaults;
3. apply deterministic derived values;
4. apply compatibility rules;
5. produce an immutable Trait Set.

## 9. Morphology

Morphology describes logical body organization.

Morphology MAY define:

- body regions;
- axis conventions;
- branch classes;
- symmetry;
- attachment categories;
- terminal structures;
- repetition rules;
- scale relationships.

Morphology SHALL remain independent of final mesh topology.

## 10. Adaptation Rules

Adaptation Rules define deterministic responses to environmental input.

An adaptation rule SHALL specify:

- trigger conditions;
- required inputs;
- affected traits or morphology parameters;
- limits;
- priority;
- conflict behavior;
- deterministic evaluation order.

## 11. Mutation Rules

Mutation Rules define controlled DNA variation.

Mutation SHALL:

- use deterministic random streams;
- respect schema ranges;
- preserve required fields;
- produce a new DNA version or instance;
- record mutation provenance;
- pass validation before publication.

## 12. Mutation Provenance

Mutation provenance SHALL include:

- parent DNA identifier;
- parent version;
- mutation seed;
- mutation rule identifiers;
- changed fields;
- resulting hash.

## 13. Environmental Input

Volume II MAY consume validated environmental summaries from Volume I.

It SHALL NOT access mutable internal World State.

## 14. SpeciesProfile

The SpeciesProfile is the authoritative published output of Volume II.

It SHALL include:

- species identifier;
- profile identifier;
- profile version;
- resolved DNA;
- resolved traits;
- resolved morphology;
- adaptation results;
- mutation provenance where applicable;
- compatibility metadata;
- validation report;
- deterministic hash.

## 15. Publication

Published SpeciesProfiles SHALL be immutable.

Any change SHALL produce a new version.

## 16. Compatibility

Compatibility rules SHALL define whether:

- DNA versions can migrate;
- traits can be interpreted by a growth engine version;
- morphology templates are supported;
- profiles can be combined or compared.

## 17. Validation

Validation SHALL verify:

- schema conformance;
- field ranges;
- required values;
- cross-field dependencies;
- trait consistency;
- morphology consistency;
- adaptation limits;
- mutation validity;
- version compatibility;
- deterministic hash consistency.

## 18. Serialization

Species Definition, DNA, Trait Set, Morphology, and SpeciesProfile SHALL be serializable.

Serialization MUST preserve version and provenance.

## 19. Public API

The Species Framework SHALL provide capabilities equivalent to:

- register species definition;
- unregister species definition;
- validate definition;
- create DNA instance;
- migrate DNA;
- resolve traits;
- resolve morphology;
- apply adaptation;
- apply mutation;
- create SpeciesProfile;
- retrieve SpeciesProfile;
- serialize;
- deserialize;
- retrieve diagnostics.

## 20. Diagnostics

Diagnostics MAY report:

- schema failures;
- range corrections;
- migration paths;
- adaptation decisions;
- mutation changes;
- compatibility issues;
- profile hashes.

## 21. Error Handling

Error categories SHALL include:

- unknown species;
- invalid DNA;
- unsupported schema;
- migration failure;
- trait conflict;
- morphology conflict;
- adaptation failure;
- mutation failure;
- incompatible profile.

## 22. Determinism

Identical Species Definition, DNA, environmental input, configuration, and seed MUST produce an identical SpeciesProfile.

## 23. Invariants

- Species identity is stable.
- DNA is versioned.
- Traits are deterministic.
- Morphology is logical, not geometric.
- Mutation is deterministic and traceable.
- Published SpeciesProfiles are immutable.
- Volume II does not create growth structures, meshes, or materials.

## 24. Completion Criteria

Volume II is complete when:

- definitions validate;
- DNA migration works;
- trait resolution is deterministic;
- morphology resolution is deterministic;
- mutation provenance is complete;
- SpeciesProfile serialization round trips;
- invalid profiles are rejected.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/species`.

The package owns SpeciesProfile behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

## B. Mandatory Implementation Sequence

1. Define runtime schemas and public readonly TypeScript contracts.
2. Define structured errors and validators.
3. Implement pure deterministic domain functions.
4. Implement transaction/application orchestration.
5. Implement canonical serialization and hashing integration.
6. Add fixtures, unit tests, property tests, contract tests, and replay/golden tests.
7. Run the corresponding checklist in `docs/03_CHECKLISTS/`.

## C. Required Artifacts

- public contract types;
- runtime schemas;
- validators;
- deterministic domain implementation;
- serializer/deserializer;
- canonical hash integration;
- structured errors;
- diagnostics adapter points;
- test fixtures;
- traceability records.

## D. Forbidden Shortcuts

- importing downstream volume internals;
- bypassing validation before publication;
- using mutable published objects;
- hiding nondeterminism with loose snapshot tests;
- performing database, network, UI, or wall-clock access inside pure domain evaluation;
- claiming completion without executing the exit gate.

## E. Normative Requirement Registry

| ID | Requirement |
|---|---|
| `V2-REQ-001` | Species identifiers are stable across renames. |
| `V2-REQ-002` | DNA conforms to a versioned runtime-validated schema. |
| `V2-REQ-003` | Trait resolution is deterministic. |
| `V2-REQ-004` | Morphology is logical and independent of mesh topology. |
| `V2-REQ-005` | Adaptation remains within declared species limits. |
| `V2-REQ-006` | Mutation uses deterministic streams and records provenance. |
| `V2-REQ-007` | Schema migration is explicit and deterministic. |
| `V2-REQ-008` | SpeciesProfile is the sole normative Volume II output term. |
| `V2-REQ-009` | Published SpeciesProfile is immutable and hashable. |
| `V2-REQ-010` | Compatibility with growth schema versions is validated. |
| `V2-REQ-011` | External/environmental inputs are immutable projections. |
| `V2-REQ-012` | Volume II creates no growth nodes, meshes, or materials. |

## F. Exit Gate

The volume is accepted only when all `II` requirement IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete.
