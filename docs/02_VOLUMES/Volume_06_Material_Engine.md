# Evolution Engine — Volume VI

# Material Engine Specification

## 1. Purpose

The Material Engine converts species, composition, geometry, and environmental information into deterministic Material State.

## 2. Responsibilities

Volume VI owns:

- material layers;
- procedural masks;
- procedural patterns;
- blend system;
- surface properties;
- material graph;
- optimization;
- validation;
- serialization;
- public API;
- diagnostics;
- deterministic publication.

## 3. Inputs

Material generation SHALL consume:

- immutable SpeciesProfile;
- immutable Composition State;
- immutable Geometry State;
- optional validated environmental projections;
- Material Configuration;
- deterministic random streams.

## 4. Material Definition

A Material Definition SHALL include:

- material identifier;
- version;
- supported component types;
- layer schema;
- graph reference;
- parameter schema;
- texture or procedural resource references;
- compatibility metadata.

## 5. Material Layer

A Material Layer SHALL include:

- layer identifier;
- semantic purpose;
- parameter set;
- mask references;
- blend mode;
- priority;
- affected surface regions;
- version.

## 6. Procedural Masks

Procedural Masks SHALL be deterministic.

Masks MAY derive from:

- geometry position;
- normals;
- curvature;
- semantic regions;
- growth age;
- stress;
- environmental exposure;
- species traits;
- noise using deterministic seeds.

## 7. Procedural Patterns

Patterns MAY define:

- veins;
- spots;
- stripes;
- pores;
- gradients;
- damage;
- weathering;
- age;
- biological variation.

Pattern generation SHALL be versioned and deterministic.

## 8. Blend System

The Blend System SHALL:

- define stable layer order;
- support validated blend operations;
- reject incompatible parameter domains;
- preserve masks;
- expose final channel composition.

## 9. Surface Properties

Surface properties MAY include:

- base color;
- opacity;
- roughness;
- metallic response;
- specular response;
- normal variation;
- displacement;
- subsurface behavior;
- transmission;
- emission;
- anisotropy.

The exact rendering model is implementation-defined, but the semantic contract SHALL remain stable.

## 10. Material Graph

The Material Graph SHALL be:

- declarative;
- versioned;
- serializable;
- acyclic unless explicit feedback nodes are supported and validated;
- deterministic;
- implementation-independent at the specification level.

## 11. Graph Nodes

A graph node SHALL define:

- node identifier;
- node type;
- inputs;
- outputs;
- parameters;
- version;
- deterministic evaluation behavior.

## 12. Graph Validation

Validation SHALL detect:

- missing inputs;
- incompatible types;
- unsupported nodes;
- invalid cycles;
- unreachable required outputs;
- invalid resource references;
- version mismatch;
- binding to internal or removed geometry;
- blend mask outside the declared junction seam;
- child material contribution on unrelated host regions.

## 13. Material Binding

Material Binding SHALL associate material outputs with Geometry State regions.

Bindings SHALL be based on:

- component identifiers;
- semantic regions;
- geometry groups;
- UV channels;
- masks;
- layer policies.

## 13A. Junction Material Continuity

When the Crystal Attachment Integrity Profile is enabled, material binding SHALL use Geometry State semantic regions and attachment-junction provenance.

The Material Engine SHALL:

- bind visible materials only to external regions and declared external seam bands;
- omit bindings for removed or internal faces;
- restrict host/child blending to the junction's `materialBlendWidth`;
- prevent child color, texture, normal detail, roughness, emissive contribution, and procedural masks from appearing on unrelated host regions;
- preserve material-region ownership across every published LOD;
- reject a binding when geometry region metadata cannot prove ownership.

Opacity, depth bias, polygon offset, or nondeterministic draw ordering MUST NOT be used to hide invalid attachment geometry.

## 13B. Texture Breakthrough Validation

Validation SHALL include strict underside and oblique underside probes plus semantic-region assertions. A host underside or opposite face SHALL contain no child material contribution unless that region is an explicitly declared external junction seam.

## 14. Optimization

Material optimization MAY include:

- constant folding;
- dead-node removal;
- graph simplification;
- mask reuse;
- texture baking;
- channel packing;
- resource deduplication.

Optimization MUST preserve observable output within defined tolerances.

## 15. Baking

Baking MAY create texture outputs from procedural graphs.

Baking SHALL record:

- source graph version;
- resolution;
- UV channel;
- color space;
- deterministic seed;
- output hash.

## 16. Material Transaction

A material transaction SHALL:

1. resolve material definitions;
2. build layers;
3. generate masks;
4. generate patterns;
5. build or load material graphs;
6. validate graphs;
7. bind materials to geometry;
8. optimize;
9. bake where required;
10. validate final state;
11. publish atomically.

## 17. Material State

Published Material State SHALL include:

- material instances;
- layers;
- masks;
- patterns;
- graphs;
- bindings;
- baked resources or references;
- provenance;
- version;
- validation report;
- deterministic hash.

## 18. Immutability

Published Material State SHALL be immutable.

## 19. Serialization

Serialization SHALL preserve:

- graph structure;
- parameters;
- bindings;
- resource references;
- baking metadata;
- versions;
- deterministic ordering.

## 20. Public API

The Material Engine SHALL provide capabilities equivalent to:

- generate materials;
- regenerate affected materials;
- retrieve material;
- retrieve graph;
- retrieve binding;
- validate;
- serialize;
- deserialize;
- retrieve diagnostics.

## 21. Diagnostics

Diagnostics MAY report:

- graph complexity;
- layer counts;
- mask generation;
- pattern generation;
- optimization changes;
- bake outputs;
- binding failures;
- resource reuse.

## 22. Error Handling

Error categories SHALL include:

- unknown material definition;
- graph validation failure;
- unsupported node;
- mask failure;
- pattern failure;
- binding failure;
- bake failure;
- optimization failure;
- serialization failure.

## 23. Determinism

Identical inputs, configuration, resources, versions, and seeds MUST produce identical Material State.

## 24. Invariants

- Materials are derived from immutable inputs.
- Graphs are declarative and versioned.
- Masks and patterns are deterministic.
- Bindings are explicit.
- Enabled internal/removed crystal faces have no visible material binding.
- Enabled child material cannot break through unrelated host regions.
- Junction blending is confined to the declared external seam band.
- Material-region ownership remains valid for every published LOD.
- Optimization preserves output.
- Published Material State is immutable.

## 25. Completion Criteria

Volume VI is complete when:

- material graphs validate;
- masks and patterns reproduce;
- bindings resolve;
- optimization is stable;
- baked outputs hash consistently;
- serialization round trips;
- invalid material states are rejected;
- enabled underside, seam-band, region-ownership, and LOD material integrity probes pass.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/materials`.

The package owns MaterialState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V6-REQ-001` | Material definitions and graph nodes are versioned. |
| `V6-REQ-002` | Procedural masks and patterns use deterministic inputs and seeds. |
| `V6-REQ-003` | Layer blend order is total and stable. |
| `V6-REQ-004` | Material graphs validate types, required outputs, resources, and cycles. |
| `V6-REQ-005` | Bindings reference semantic/geometry regions explicitly. |
| `V6-REQ-006` | Optimization preserves observable output within declared tolerances. |
| `V6-REQ-007` | Baking records source graph, UV, resolution, color space, seed, and hash. |
| `V6-REQ-008` | GPU timing/order is not an authoritative input. |
| `V6-REQ-009` | External resources are content-addressed or integrity-checked. |
| `V6-REQ-010` | Published MaterialState is immutable. |
| `V6-REQ-011` | Serialization preserves graph and binding order. |
| `V6-REQ-012` | Volume VI does not own engine orchestration. |
| `V6-REQ-013` | Enabled crystal materials bind only to external regions and declared junction seam bands. |
| `V6-REQ-014` | Child material contributions cannot appear on unrelated host regions, including the underside. |
| `V6-REQ-015` | Junction material ownership and blend bounds remain valid for every published LOD. |

## F. Exit Gate

The volume is accepted only when all applicable `V6-REQ-*` IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete. When the Crystal Attachment Integrity Profile is enabled, `V6-REQ-013..015` and `CAI-REQ-009..012` are mandatory.
