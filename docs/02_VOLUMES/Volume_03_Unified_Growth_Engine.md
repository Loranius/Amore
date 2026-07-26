# Evolution Engine — Volume III

# Unified Growth Engine Specification

## 1. Purpose

The Unified Growth Engine converts a SpeciesProfile and validated environmental context into a deterministic logical Growth State.

It combines:

- Growth Skeleton;
- skeleton templates;
- growth nodes;
- growth graph;
- growth rules;
- growth state machine;
- energy distribution;
- space reservation;
- collision prediction;
- self avoidance;
- direction solving;
- constraint solving;
- stress solving;
- adaptive growth;
- repair;
- growth memory;
- serialization;
- deterministic publication.

## 2. Boundary

Volume III owns logical growth structure.

It SHALL NOT generate final meshes or materials.

## 3. Growth Input

Growth execution SHALL consume:

- immutable SpeciesProfile;
- immutable World State or validated environmental projection;
- Growth Configuration;
- deterministic random streams;
- optional previous Growth State.

## 4. Growth Skeleton

The Growth Skeleton is a logical structural representation.

It SHALL contain:

- nodes;
- edges;
- hierarchy or graph relationships;
- structural classes;
- local frames;
- logical radii or scales;
- state metadata.

It SHALL NOT contain final render mesh data.

## 5. Skeleton Templates

Skeleton Templates SHALL define valid initial logical structures.

A template MAY define:

- root nodes;
- axis systems;
- node classes;
- allowed child relationships;
- initial constraints;
- growth entry points.

## 6. Growth Node

A Growth Node SHALL include:

- node identifier;
- parent references;
- child references;
- node class;
- logical position;
- logical orientation;
- scale parameters;
- age;
- state;
- energy;
- stress;
- reservation reference;
- creation provenance.

## 7. Growth Graph

The Growth Graph SHALL support:

- deterministic traversal;
- parent-child relations;
- optional non-tree structural links;
- dependency validation;
- cycle rules;
- stable identifiers;
- topology hashing.

## 8. Growth State Machine

Every growth-capable node SHALL have an explicit state.

States MAY include:

- dormant;
- active;
- extending;
- branching;
- constrained;
- damaged;
- repairing;
- mature;
- terminated.

Transitions SHALL be deterministic and validated.

## 9. Growth Rules

A Growth Rule SHALL define:

- applicable node classes;
- required state;
- environmental predicates;
- energy cost;
- spatial requirements;
- direction policy;
- transition result;
- priority;
- conflict resolution.

## 10. Energy Distribution

Energy Distribution SHALL allocate finite growth energy deterministically.

It SHALL account for:

- node demand;
- node priority;
- transport path;
- species traits;
- environmental conditions;
- repair demand;
- reserve policy.

Energy allocation MUST be resolved before executing dependent growth actions.

## 11. Space Reservation

Space Reservation SHALL occur before node creation.

A reservation SHALL define:

- reservation identifier;
- owner node;
- spatial bounds;
- intended action;
- priority;
- validity interval;
- conflict policy.

Growth MUST NOT create a node without a valid reservation.

## 12. Collision Prediction

Collision Prediction SHALL evaluate intended growth before publication.

It SHALL detect potential conflicts with:

- existing skeleton;
- reserved space;
- world boundaries;
- environmental obstacles;
- composition anchors where applicable.

## 12A. Attachment-Safe Crystal Placement

When the Crystal Attachment Integrity Profile is enabled, every planned child crystal SHALL reserve a volumetric junction and clearance region before creation.

Placement SHALL account for:

- child radius and projected length;
- host-local surface frame;
- contact radius and penetration depth;
- minimum angular separation around the host axis;
- minimum geodesic/surface spacing between child bases;
- minimum volumetric clearance between child bodies;
- occupied host sectors;
- expected outward growth direction;
- allowed junction overlap bounds.

Candidate selection SHALL be deterministic and SHALL produce a non-clumping, sector-balanced distribution without rigid radial symmetry. Stratified, Poisson-like, blue-noise-like, or equivalently validated scoring is acceptable.

A child SHALL be rejected, redirected, reduced, or deferred when its projected body intersects another body outside the involved junction zones.

## 12B. Junction-Zone Collision Policy

Controlled host/child overlap is valid only inside a reserved junction zone. It SHALL NOT be treated as a global collision exemption.

Collision prediction SHALL distinguish:

- intended host/child junction overlap;
- unrelated body intersection;
- neighboring junction overlap;
- opposite-side host breakthrough risk;
- insufficient host thickness for the requested penetration.

## 13. Self Avoidance

Self Avoidance SHALL modify or reject growth that would create invalid self-conflict.

It SHALL be deterministic.

## 14. Direction Solver

The Direction Solver SHALL combine:

- morphology bias;
- environmental influence;
- local orientation;
- tropism;
- self avoidance;
- obstacle avoidance;
- stress response;
- growth memory.

The resulting direction SHALL be validated before use.

## 15. Constraint Solver

The Constraint Solver SHALL enforce:

- structural limits;
- spatial limits;
- species limits;
- environmental limits;
- graph limits;
- state-machine limits.

Constraint resolution order SHALL be stable.

## 16. Stress Solver

The Stress Solver SHALL compute logical structural stress.

It MAY consider:

- load;
- branching;
- unsupported span;
- environmental force summaries;
- damage;
- resource scarcity.

Stress is logical and SHALL NOT require final finite-element geometry.

## 17. Adaptive Growth

Adaptive Growth SHALL alter future growth decisions in response to validated conditions.

Adaptation SHALL remain within SpeciesProfile limits.

## 18. Repair System

The Repair System SHALL:

- detect repairable damage;
- prioritize repair;
- allocate energy;
- reserve space;
- create deterministic repair actions;
- record repair provenance.

## 19. Growth Memory

Growth Memory SHALL record relevant historical decisions without depending on mutable logs.

It MAY include:

- previous direction tendencies;
- blocked regions;
- repaired regions;
- stress history summaries;
- resource history summaries;
- branch success statistics.

## 20. Growth Transaction

A growth transaction SHALL:

1. read immutable inputs;
2. evaluate state transitions;
3. allocate energy;
4. create reservations;
5. predict collisions;
6. solve direction;
7. solve constraints;
8. solve stress;
9. apply growth or repair;
10. validate;
11. publish atomically.

## 21. Growth State

Published Growth State SHALL include:

- skeleton;
- growth graph;
- node states;
- energy state;
- stress state;
- reservations;
- growth memory;
- provenance;
- version;
- validation report;
- deterministic hash.

## 22. Immutability

Published Growth States are immutable.

Subsequent growth SHALL create a new Growth State version.

## 23. Serialization

Serialization SHALL preserve all logical growth information required for deterministic continuation.

## 24. Validation

Validation SHALL verify:

- node identifier uniqueness;
- graph integrity;
- valid state transitions;
- valid reservations;
- collision policy compliance;
- volumetric junction reservation and clearance compliance where enabled;
- deterministic sector balance and minimum separation where enabled;
- absence of predicted intersection outside junction zones where enabled;
- energy conservation policy;
- morphology compliance;
- constraint compliance;
- stress bounds;
- repair consistency;
- deterministic hash.

## 25. Public API

The Unified Growth Engine SHALL provide capabilities equivalent to:

- initialize growth;
- continue growth;
- evaluate growth step;
- apply repair;
- retrieve Growth State;
- validate Growth State;
- serialize;
- deserialize;
- retrieve diagnostics.

## 26. Diagnostics

Diagnostics MAY report:

- active nodes;
- blocked actions;
- reservation conflicts;
- collision predictions;
- energy allocation;
- stress distribution;
- repair activity;
- solver iterations;
- state transitions.

## 27. Error Handling

Error categories SHALL include:

- invalid SpeciesProfile;
- invalid previous Growth State;
- reservation failure;
- collision rejection;
- direction failure;
- constraint failure;
- stress failure;
- energy failure;
- invalid state transition;
- serialization failure.

## 28. Determinism

Identical inputs, configuration, seeds, and prior Growth State MUST produce identical output.

## 29. Invariants

- Skeleton is logical only.
- Space reservation occurs before growth.
- Collision prediction occurs before node creation.
- Published Growth State is immutable.
- Energy allocation is deterministic.
- Growth rules do not generate meshes.
- Repair is traceable and validated.
- Enabled crystal child placement reserves a complete body and junction zone, not only a point.
- Controlled overlap is confined to declared junction zones.
- Distribution around a host is deterministic, non-clumping, and sector-balanced without rigid symmetry.

## 30. Completion Criteria

Volume III is complete when:

- deterministic growth works;
- reservations prevent invalid growth;
- collision prediction is stable;
- state transitions validate;
- repair works;
- serialization resumes growth exactly;
- published Growth State is immutable;
- enabled crystal attachment placement passes minimum-spacing, sector-balance, thin-host, and outside-junction collision properties.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/growth`.

The package owns GrowthState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V3-REQ-001` | Growth skeleton is logical, not a render mesh. |
| `V3-REQ-002` | Growth graph traversal and tie-breaking are deterministic. |
| `V3-REQ-003` | Node state transitions are explicit and validated. |
| `V3-REQ-004` | Energy is allocated before dependent actions. |
| `V3-REQ-005` | Space is reserved before node creation. |
| `V3-REQ-006` | Collision is predicted before node creation. |
| `V3-REQ-007` | Direction solving combines influences in a fixed order. |
| `V3-REQ-008` | Constraint and stress solving use stable iteration/order. |
| `V3-REQ-009` | Repair records provenance and obeys reservation rules. |
| `V3-REQ-010` | Growth memory contains canonical summaries, not mutable logs. |
| `V3-REQ-011` | Published GrowthState is immutable and resumable. |
| `V3-REQ-012` | Volume III creates no final mesh or material. |
| `V3-REQ-013` | Enabled crystal children reserve volumetric junction and clearance regions before creation. |
| `V3-REQ-014` | Enabled crystal child placement is deterministic, non-clumping, sector-balanced, and not rigidly symmetric. |
| `V3-REQ-015` | Crystal body intersections are rejected outside declared junction zones. |

## F. Exit Gate

The volume is accepted only when all applicable `V3-REQ-*` IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete. When the Crystal Attachment Integrity Profile is enabled, `V3-REQ-013..015` and `CAI-REQ-001..003` are mandatory.
