# Evolution Engine — Volume IV

# Composition Framework Specification

## 1. Purpose

The Composition Framework transforms Growth State into a deterministic semantic Composition State.

It defines how logical structures become organized components and assemblies without generating final geometry.

## 2. Responsibilities

Volume IV owns:

- component system;
- semantic components;
- assemblies;
- anchors;
- dependency graph;
- layer system;
- procedural assemblies;
- composition validation;
- serialization;
- public API;
- diagnostics;
- deterministic publication.

## 3. Composition Input

Composition SHALL consume:

- immutable Growth State;
- immutable SpeciesProfile;
- Composition Configuration;
- optional prior Composition State.

## 4. Component

A Component is a semantic unit.

A Component SHALL include:

- component identifier;
- component type;
- source growth references;
- semantic role;
- transform or logical frame;
- parameters;
- layer membership;
- anchor definitions;
- dependency references;
- version metadata.

## 5. Component Types

Component types MAY represent:

- trunk;
- branch;
- root;
- leaf cluster;
- flower;
- fruit;
- shell;
- membrane;
- organ;
- attachment;
- support;
- decorative biological structure.

Types SHALL remain implementation-independent.

## 6. Semantic Mapping

Semantic Mapping SHALL transform growth structures into components deterministically.

Mapping rules SHALL define:

- source node classes;
- source edge classes;
- required traits;
- output component type;
- parameter derivation;
- anchor creation;
- layer assignment.

## 7. Assembly

An Assembly is a deterministic collection of related components.

An Assembly SHALL include:

- assembly identifier;
- root component;
- member components;
- local dependency graph;
- assembly type;
- assembly parameters;
- publication metadata.

## 8. Anchors

Anchors define validated attachment interfaces.

An Anchor SHALL include:

- anchor identifier;
- owner component;
- anchor type;
- logical frame;
- compatibility rules;
- capacity;
- occupancy state;
- version.

## 9. Attachment

An attachment SHALL:

- reference compatible anchors;
- preserve deterministic ordering;
- satisfy capacity;
- satisfy dependency rules;
- be validated before publication.

## 9A. Crystal Attachment Junction

When the Crystal Attachment Integrity Profile is enabled, every physical host/child attachment SHALL publish a versioned `AttachmentJunction`.

The junction SHALL include semantic equivalents of:

- junction identifier;
- host and child component identifiers;
- host and child anchor identifiers;
- host-local contact frame;
- contact radius;
- penetration depth;
- surrounding clearance radius;
- allowed intersection bounds;
- geometry trim policy;
- seam policy;
- material blend width;
- version and provenance.

The full canonical contract is defined in [Crystal Attachment Integrity Profile](../01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md).

A physical child SHALL have exactly one host junction unless a validated bridge/intergrowth assembly explicitly declares multiple hosts.

## 10. Dependency Graph

The Composition Dependency Graph SHALL define evaluation and construction order.

It SHALL support:

- deterministic traversal;
- cycle validation;
- dependency categories;
- optional dependencies;
- failure propagation.

## 11. Layer System

Layers SHALL organize components by semantic purpose.

Layers MAY represent:

- structural;
- biological;
- decorative;
- protective;
- internal;
- external;
- generated attachments;
- simulation-only metadata.

## 12. Procedural Assemblies

Procedural Assemblies SHALL be generated from declarative rules.

A procedural assembly rule SHALL define:

- source components;
- placement policy;
- count policy;
- orientation policy;
- variation policy;
- anchor policy;
- conflict policy;
- deterministic seed namespace.

## 13. Composition Transaction

A composition transaction SHALL:

1. read immutable inputs;
2. map growth structures;
3. create components;
4. create anchors;
5. resolve dependencies;
6. build assemblies;
7. publish attachment junctions where enabled;
8. assign layers;
9. validate;
10. publish atomically.

## 14. Composition State

Published Composition State SHALL include:

- components;
- assemblies;
- anchors;
- attachments;
- dependency graph;
- layers;
- provenance;
- version;
- validation report;
- deterministic hash.

## 15. Immutability

Published Composition State SHALL be immutable.

## 16. Validation

Validation SHALL verify:

- unique identifiers;
- source reference validity;
- dependency integrity;
- cycle policy;
- anchor compatibility;
- anchor capacity;
- junction host/child ownership, frame, overlap bounds, clearance, and policy completeness where enabled;
- exactly-one-host policy unless a bridge/intergrowth is declared;
- assembly completeness;
- layer validity;
- deterministic ordering;
- absence of geometry implementation objects.

## 17. Serialization

All components, assemblies, anchors, dependencies, and layers SHALL be serializable.

## 18. Public API

The Composition Framework SHALL provide capabilities equivalent to:

- build composition;
- update composition from new Growth State;
- retrieve component;
- retrieve assembly;
- query anchors;
- validate Composition State;
- serialize;
- deserialize;
- retrieve diagnostics.

## 19. Diagnostics

Diagnostics MAY report:

- component counts;
- assembly counts;
- unresolved dependencies;
- anchor conflicts;
- mapping decisions;
- layer assignments;
- rejected procedural elements.

## 20. Error Handling

Error categories SHALL include:

- invalid Growth State;
- mapping failure;
- missing dependency;
- dependency cycle;
- incompatible anchor;
- capacity violation;
- invalid assembly;
- serialization failure.

## 21. Determinism

Identical inputs and configuration MUST produce identical Composition State.

## 22. Invariants

- Components are semantic.
- Assemblies are deterministic.
- Anchors are explicit.
- Dependencies are validated.
- Published Composition State is immutable.
- Volume IV does not create final meshes or materials.
- Every enabled physical crystal attachment has an explicit versioned junction.
- Junction policies are semantic and renderer-independent.

## 23. Completion Criteria

Volume IV is complete when:

- growth mapping is deterministic;
- anchors validate;
- dependency ordering is stable;
- procedural assemblies are reproducible;
- serialization round trips;
- invalid compositions are rejected;
- enabled attachment junctions serialize and validate with stable ownership and ordering.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/composition`.

The package owns CompositionState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V4-REQ-001` | Components are semantic units derived from published growth. |
| `V4-REQ-002` | Mapping rules are versioned and deterministic. |
| `V4-REQ-003` | Assemblies expose stable membership and roots. |
| `V4-REQ-004` | Anchors are explicit, typed, capacity-limited interfaces. |
| `V4-REQ-005` | Attachments validate both endpoints before publication. |
| `V4-REQ-006` | Dependency traversal is deterministic and cycles follow explicit policy. |
| `V4-REQ-007` | Layer membership is semantic, not renderer-specific. |
| `V4-REQ-008` | Procedural assemblies use deterministic stream namespaces. |
| `V4-REQ-009` | Dangling source references are rejected. |
| `V4-REQ-010` | Published CompositionState is immutable. |
| `V4-REQ-011` | Serialization preserves graph and anchor integrity. |
| `V4-REQ-012` | Volume IV creates no final meshes or materials. |
| `V4-REQ-013` | Every enabled physical crystal attachment publishes one versioned AttachmentJunction. |
| `V4-REQ-014` | AttachmentJunction records host/child ownership, contact frame, penetration, clearance, allowed overlap, trim, seam, and material blend policy. |
| `V4-REQ-015` | A child has exactly one physical host unless a validated bridge/intergrowth explicitly declares otherwise. |

## F. Exit Gate

The volume is accepted only when all applicable `V4-REQ-*` IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete. When the Crystal Attachment Integrity Profile is enabled, `V4-REQ-013..015` and `CAI-REQ-004` are mandatory.
