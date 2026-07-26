# Evolution Engine — Volume V

# Geometry Engine Specification

## 1. Purpose

The Geometry Engine converts Composition State and Growth State into deterministic renderable Geometry State.

## 2. Responsibilities

Volume V owns:

- mesh generation;
- adaptive meshing;
- remeshing;
- topology validation;
- mesh repair;
- self-intersection detection;
- welding;
- UV generation;
- optimization;
- streaming geometry;
- level of detail;
- geometry serialization;
- diagnostics;
- deterministic publication.

## 3. Inputs

Geometry generation SHALL consume:

- immutable Composition State;
- immutable Growth State;
- immutable SpeciesProfile where required;
- Geometry Configuration;
- deterministic random streams.

## 4. Geometry Representation

Geometry State MAY contain:

- vertex buffers;
- index buffers;
- normals;
- tangents;
- UV sets;
- topology metadata;
- bounds;
- adjacency data;
- LODs;
- streaming partitions;
- geometry provenance.

## 5. Mesh Generator

The Mesh Generator SHALL convert semantic components into geometry using registered generators.

A generator SHALL define:

- supported component types;
- required inputs;
- parameter schema;
- topology strategy;
- UV strategy;
- deterministic output contract.

## 6. Generator Registry

The Generator Registry SHALL:

- map component types to generators;
- reject ambiguous mappings;
- version generator implementations;
- expose compatibility metadata;
- preserve deterministic resolution order.

## 7. Adaptive Meshing

Adaptive Meshing SHALL allocate geometric detail according to validated criteria.

Criteria MAY include:

- curvature;
- component importance;
- scale;
- deformation expectation;
- camera-independent quality settings;
- LOD target.

Authoritative base geometry MUST NOT depend on current camera state unless explicitly operating in a non-authoritative rendering mode.

## 8. Remeshing

Remeshing SHALL preserve:

- semantic boundaries;
- topology constraints;
- anchors;
- required UV seams;
- deterministic output.

## 9. Topology

Topology metadata SHALL include:

- manifold status;
- boundary loops;
- connected components;
- winding;
- adjacency;
- semantic region mapping.

## 10. Topology Validation

Validation SHALL detect:

- non-manifold edges;
- invalid indices;
- degenerate faces;
- inconsistent winding;
- isolated elements;
- invalid boundaries;
- disconnected required regions.

## 11. Mesh Repair

Mesh Repair MAY correct validated classes of defects.

Every repair SHALL:

- be deterministic;
- record provenance;
- preserve semantic ownership;
- re-run validation;
- fail safely when repair is ambiguous.

## 12. Self-Intersection Detection

Self-intersection detection SHALL identify invalid triangle or surface intersections according to configured tolerances.

## 13. Welding

Welding SHALL merge compatible vertices deterministically.

Welding MUST preserve:

- semantic seams;
- UV seams;
- hard-normal boundaries;
- material boundaries;
- anchor references where represented.

## 13A. Attachment Junction Processing

When the Crystal Attachment Integrity Profile is enabled, the Geometry Engine SHALL process every `AttachmentJunction` as a bounded external-shell operation.

For each host/child pair it SHALL:

1. generate provisional geometry;
2. classify external, junction, and internal regions;
3. clip or remove the child base cap;
4. remove child faces hidden inside the host;
5. remove or suppress host faces that become permanently internal where required;
6. reject uncontrolled intersections outside the junction bounds;
7. seal the junction using deterministic local welding, a transition mesh, analytic clipping, or a bounded local Boolean operation;
8. re-run topology and region validation.

Simple burial of independently closed meshes is not a valid final implementation.

## 13B. External-Shell and Hidden-Surface Validation

Published geometry SHALL expose only the intended external shell plus explicitly permitted open boundaries.

Validation SHALL detect:

- visible child base caps;
- internally classified faces visible from outside;
- opposite-side host breakthrough;
- coplanar duplicate faces;
- near-coplanar z-fighting risk;
- cracks or invalid boundary loops at a junction;
- triangle intersections outside junction zones;
- invalid junction ownership in semantic region metadata.

The same validation policy SHALL apply to every published LOD.

## 14. Normals and Tangents

Normals and tangents SHALL be generated deterministically.

The implementation SHALL define:

- smoothing policy;
- hard-edge policy;
- tangent basis convention;
- degenerate handling.

## 15. UV Generation

UV generation SHALL support:

- procedural projection;
- chart generation;
- seam constraints;
- packing;
- density targets;
- multiple UV channels.

UV output SHALL be deterministic.

## 16. Optimization

Geometry optimization MAY include:

- vertex cache optimization;
- index reordering;
- vertex deduplication;
- meshlet generation;
- quantization;
- compression.

Optimization MUST preserve geometry semantics and deterministic hashes.

## 17. Level of Detail

LOD generation SHALL define:

- LOD count;
- reduction targets;
- preservation constraints;
- transition metadata;
- validation policy.

LOD generation SHALL be deterministic.

## 18. Streaming Geometry

Streaming geometry SHALL divide Geometry State into stable partitions.

Partitions SHALL include:

- partition identifier;
- bounds;
- dependency metadata;
- LOD availability;
- load priority;
- serialization offsets or references.

## 19. Geometry Transaction

A geometry transaction SHALL:

1. resolve generators;
2. generate base geometry;
3. adapt mesh density;
4. remesh where required;
5. validate topology;
6. repair allowed defects;
7. detect self-intersections;
8. process attachment junctions and remove hidden/internal faces where enabled;
9. weld or seal junctions;
10. generate normals and tangents;
11. generate UVs and semantic region mappings;
12. optimize;
13. generate LODs;
14. validate every LOD for attachment integrity;
15. create streaming partitions;
16. validate;
17. publish atomically.

## 20. Geometry State

Published Geometry State SHALL include:

- geometry buffers;
- topology metadata;
- UV data;
- LODs;
- streaming partitions;
- bounds;
- provenance;
- version;
- validation report;
- deterministic hash.

## 21. Immutability

Published Geometry State SHALL be immutable.

## 22. Serialization

Geometry serialization SHALL:

- preserve all authoritative geometry;
- support versioning;
- support streaming;
- preserve deterministic data order;
- reject unsupported versions.

## 23. Public API

The Geometry Engine SHALL provide capabilities equivalent to:

- generate geometry;
- regenerate affected components;
- retrieve geometry;
- retrieve LOD;
- retrieve streaming partition;
- validate;
- serialize;
- deserialize;
- retrieve diagnostics.

## 24. Diagnostics

Diagnostics MAY report:

- polygon counts;
- vertex counts;
- generation time;
- topology defects;
- repairs;
- UV utilization;
- LOD reduction;
- streaming partition sizes;
- generator selection;
- junction classification and trim counts;
- removed caps/internal faces;
- intersections outside junction zones;
- underside visibility probe failures;
- per-LOD junction integrity.

## 25. Error Handling

Error categories SHALL include:

- unsupported component;
- generator failure;
- invalid topology;
- repair failure;
- self-intersection;
- UV failure;
- optimization failure;
- LOD failure;
- serialization failure;
- invalid attachment junction;
- visible internal surface;
- external-shell breach;
- intersection outside junction zone;
- junction sealing failure.

## 26. Thread Safety

Parallel generation MAY be used per independent component or partition.

Final output ordering MUST remain deterministic.

## 27. Invariants

- Geometry derives from immutable semantic inputs.
- Mesh generators are versioned.
- Topology is validated.
- Repairs are traceable.
- UV generation is deterministic.
- Published Geometry State is immutable.
- Camera state does not alter authoritative base geometry.
- Enabled child base caps and hidden/internal faces are excluded from the external shell.
- Controlled crystal overlap exists only inside declared junction zones.
- Every enabled junction is sealed without cracks, coplanar duplicates, or z-fighting.
- Attachment integrity holds for every published LOD.

## 28. Completion Criteria

Volume V is complete when:

- supported components generate valid meshes;
- topology validation works;
- deterministic repair works;
- UVs are stable;
- LODs validate;
- streaming partitions restore;
- serialization round trips;
- geometry hashes are reproducible;
- enabled 360-degree, strict underside, oblique underside, stress-case, and LOD integrity probes pass.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/geometry`.

The package owns GeometryState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V5-REQ-001` | Generators are registered, versioned, and selected deterministically. |
| `V5-REQ-002` | Authoritative geometry does not depend on camera state. |
| `V5-REQ-003` | Topology validation precedes publication. |
| `V5-REQ-004` | Repair is deterministic, bounded, and provenance-recorded. |
| `V5-REQ-005` | Self-intersection policy is explicit and tolerance-versioned. |
| `V5-REQ-006` | Welding preserves semantic, UV, normal, and material boundaries. |
| `V5-REQ-007` | Normal, tangent, and UV generation are deterministic. |
| `V5-REQ-008` | Optimization preserves canonical semantics and defined tolerances. |
| `V5-REQ-009` | LOD generation is deterministic and validated. |
| `V5-REQ-010` | Streaming partitions have stable IDs and dependencies. |
| `V5-REQ-011` | GeometryState uses engine-owned data; Three.js conversion is an adapter. |
| `V5-REQ-012` | Published GeometryState is immutable and serializable. |
| `V5-REQ-013` | Enabled crystal junction processing removes child base caps and hidden/internal faces from the external shell. |
| `V5-REQ-014` | Enabled crystal junctions are locally sealed without cracks, coplanar duplicates, or z-fighting. |
| `V5-REQ-015` | Published geometry contains no crystal-body intersection outside declared junction zones and passes underside visibility probes. |
| `V5-REQ-016` | Attachment integrity and semantic-region ownership remain valid for every published LOD. |

## F. Exit Gate

The volume is accepted only when all applicable `V5-REQ-*` IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete. When the Crystal Attachment Integrity Profile is enabled, `V5-REQ-013..016` and `CAI-REQ-005..008`, `CAI-REQ-011..012` are mandatory.
