# Evolution Engine — Volume VII

# Integration Framework Specification

## 1. Purpose

The Integration Framework is the authoritative orchestration layer of Evolution Engine.

It coordinates Volumes I through VI while preserving:

- module isolation;
- deterministic execution;
- immutable publication;
- explicit contracts;
- global validation;
- stable lifecycle;
- engine serialization;
- public API behavior.

## 2. Scope

Volume VII owns:

- engine lifecycle;
- execution scheduler;
- task graph;
- context management;
- synchronization;
- configuration;
- event system;
- message bus;
- diagnostics;
- error recovery;
- extension architecture;
- global validation;
- engine serialization;
- public API;
- compliance.

It SHALL NOT absorb the internal responsibilities of other volumes.

## 3. Engine Pipeline

The normative pipeline is:

1. Initialize Core Simulation
2. Resolve SpeciesProfile
3. Execute Unified Growth
4. Build Composition
5. Generate Geometry
6. Generate Materials
7. Validate Global State
8. Publish Engine State

## 4. Lifecycle

The engine lifecycle SHALL include:

- uninitialized;
- initializing;
- ready;
- executing;
- validating;
- publishing;
- suspended;
- shutting down;
- terminated;
- failed.

State transitions SHALL be explicit and validated.

## 5. Engine Context

An Engine Context SHALL include:

- context identifier;
- configuration;
- volume instances or service references;
- active versions;
- execution scheduler;
- event system;
- message bus;
- diagnostics collector;
- extension registry;
- current published states;
- validation state.

Contexts MUST remain isolated.

## 6. Initialization

Initialization SHALL:

1. validate configuration;
2. resolve versions;
3. initialize Volume I;
4. initialize Volumes II through VI in dependency order;
5. register extensions;
6. validate contracts;
7. create initial Engine Context;
8. enter ready state.

Partial initialization failure SHALL trigger controlled cleanup.

## 7. Shutdown

Shutdown SHALL:

- stop accepting new execution requests;
- finish or cancel work according to policy;
- flush diagnostics;
- release resources;
- preserve published state;
- terminate volumes in reverse dependency order.

## 8. Execution Scheduler

The Execution Scheduler SHALL coordinate deterministic work across all volumes.

It SHALL support:

- task registration;
- dependency resolution;
- stable priority;
- synchronization barriers;
- resource claims;
- cancellation;
- failure propagation;
- deterministic completion ordering.

## 9. Task Graph

Every scheduled task SHALL define:

- task identifier;
- owning volume;
- inputs;
- outputs;
- dependencies;
- priority;
- resource requirements;
- retry policy;
- deterministic ordering key.

## 10. Execution Phases

The scheduler SHALL support explicit phases:

- preparation;
- simulation;
- species resolution;
- growth;
- composition;
- geometry;
- material;
- validation;
- publication;
- diagnostics.

## 11. Dependency Resolution

Dependency resolution SHALL:

- detect cycles;
- reject missing dependencies;
- preserve stable order;
- respect volume boundaries;
- produce a deterministic execution plan.

## 12. Synchronization

Synchronization barriers SHALL be used where downstream work requires complete immutable upstream state.

## 13. Parallel Execution

Parallel execution MAY be used for independent tasks.

Parallel execution MUST NOT change:

- task result;
- publication order;
- hashes;
- diagnostics ordering where diagnostics are authoritative;
- failure semantics.

## 14. Resource Scheduling

The scheduler SHALL integrate deterministic resource claims.

Resource conflicts SHALL be resolved by stable priority and ordering rules.

## 15. Configuration Management

Configuration SHALL be:

- versioned;
- validated;
- immutable during an execution transaction;
- serializable;
- attributable to a published Engine State.

Configuration changes SHALL produce a new execution version.

## 16. Event System

The Integration Event System SHALL route typed events between volumes.

Every event SHALL define:

- event identifier;
- type;
- source volume;
- target volume or broadcast scope;
- logical timestamp;
- sequence;
- payload version;
- correlation identifier.

## 17. Event Principles

Events SHALL:

- be immutable;
- be versioned;
- preserve deterministic order;
- avoid direct mutable state sharing;
- be validated before delivery.

## 18. Message Bus

The Message Bus SHALL:

- register typed channels;
- validate producers and consumers;
- preserve delivery order;
- isolate failures;
- support diagnostics;
- reject unsupported payload versions.

## 19. Cross-Volume Communication

Volumes SHALL communicate only through:

- immutable published states;
- documented public APIs;
- typed events;
- message bus messages;
- validated configuration.

## 20. Diagnostics

Global diagnostics SHALL aggregate:

- lifecycle transitions;
- scheduler plans;
- task execution;
- volume validation;
- event delivery;
- serialization;
- extension status;
- publication;
- performance metadata.

Diagnostics MUST NOT affect authoritative execution.

## 21. Error Recovery

Error recovery MAY include:

- task retry;
- volume restart where safe;
- rollback to last published state;
- checkpoint restoration;
- degraded optional extension mode;
- controlled engine failure.

Recovery behavior SHALL be deterministic for equivalent failure conditions.

## 22. Failure Propagation

Failures SHALL propagate through explicit dependency relationships.

A failed upstream task SHALL prevent invalid downstream publication.

## 23. Extension Architecture

Extensions MAY add:

- new species resolvers;
- growth rules;
- component mappings;
- geometry generators;
- material nodes;
- diagnostics providers.

Extensions MUST NOT bypass volume contracts.

## 24. Extension Manifest

Every extension SHALL provide:

- extension identifier;
- version;
- target volume;
- supported specification versions;
- declared capabilities;
- dependencies;
- permissions;
- deterministic behavior declaration;
- validation entry point.

## 25. Extension Validation

Extension validation SHALL verify:

- compatibility;
- unique identifier;
- dependency availability;
- contract compliance;
- deterministic behavior;
- serialization support;
- security policy where applicable.

## 26. Global Validation

Global Validation SHALL verify:

- all required published states exist;
- version compatibility;
- state reference integrity;
- configuration consistency;
- deterministic hashes;
- extension compliance;
- serialization readiness;
- publication readiness.

## 27. Engine State

Engine State is the authoritative integrated output.

It SHALL reference:

- World State;
- SpeciesProfile;
- Growth State;
- Composition State;
- Geometry State;
- Material State;
- configuration;
- versions;
- validation reports;
- diagnostics metadata;
- deterministic hash.

## 28. Atomic Publication

Engine State SHALL be published atomically.

A failure in any mandatory volume SHALL prevent publication of a new complete Engine State.

## 29. Engine Serialization

Engine Serialization provides a deterministic representation of the complete Engine State.

Serialization SHALL preserve references to:

- Volume I Published State;
- Volume II Published State;
- Volume III Published State;
- Volume IV Published State;
- Volume V Published State;
- Volume VI Published State;
- Engine metadata;
- configuration metadata;
- version metadata;
- validation metadata;
- execution metadata.

Serialization MUST NOT include:

- renderer resources;
- GPU objects;
- operating system handles;
- runtime thread identifiers;
- implementation-specific memory addresses.

## 30. Engine Deserialization

Deserialization reconstructs a previously published Engine State.

The reconstructed state SHALL be observationally identical to the original.

Deserialization SHALL NOT regenerate growth, geometry, or materials unless explicitly requested as a separate operation.

## 31. Save and Load

Save SHALL:

- validate state;
- serialize deterministically;
- write atomically;
- include checksums;
- include version manifests.

Load SHALL:

- verify checksums;
- validate versions;
- migrate only through registered deterministic migrations;
- reject incompatible states;
- publish only after global validation.

## 32. Engine Versioning

Every serialized Engine State SHALL contain:

- Engine Specification Version;
- each Volume Specification Version;
- implementation version;
- extension versions;
- compatibility metadata.

Breaking architectural changes MUST increment the major specification version.

## 33. Public API Contract

External systems SHALL communicate through documented public interfaces.

Required capabilities include:

- initialize engine;
- shutdown engine;
- load configuration;
- create context;
- destroy context;
- execute pipeline;
- execute selected validated stages;
- validate Engine State;
- publish Engine State;
- serialize Engine State;
- deserialize Engine State;
- retrieve Engine State;
- retrieve volume states;
- retrieve validation reports;
- retrieve diagnostics;
- manage compatible extensions.

## 34. Thread Safety

The Integration Framework SHALL define thread-safe access to:

- contexts;
- published states;
- scheduler;
- event system;
- diagnostics;
- extension registry.

Published immutable states MAY be shared safely.

## 35. Determinism Guarantees

The Evolution Engine guarantees deterministic execution when:

- configuration is identical;
- input states are identical;
- SpeciesProfiles are identical;
- seeds are identical;
- specification and implementation versions are compatible;
- extension versions are identical;
- deterministic execution order is preserved.

Under these conditions, identical Engine State hashes MUST be produced.

## 36. Validation Report

Every engine execution SHALL produce a Global Validation Report including:

- engine validation status;
- participating volumes;
- validation summaries;
- violations;
- rule identifiers;
- specification versions;
- execution metadata.

Published reports are immutable.

## 37. Compliance Requirements

An implementation is compliant only if all mandatory statements in Volumes I through VII are satisfied.

## 38. Architectural Guarantees

Evolution Engine guarantees:

- deterministic execution;
- immutable published states;
- isolated module ownership;
- explicit inter-module contracts;
- deterministic scheduling;
- deterministic validation;
- deterministic serialization;
- atomic publication;
- strict separation between simulation, species, growth, composition, geometry, materials, and orchestration.

## 39. Global Output Contract

The engine publishes:

- World State;
- SpeciesProfile;
- Growth State;
- Composition State;
- Geometry State;
- Material State;
- Engine State;
- Validation Reports;
- Diagnostic Reports.

## 40. Completion Criteria

Volume VII is complete when:

- lifecycle transitions validate;
- scheduler output is deterministic;
- all volume dependencies resolve;
- cross-volume communication uses contracts;
- extensions validate;
- global validation prevents invalid publication;
- save/load round trips;
- Engine State hashes reproduce;
- public API tests pass.

## 41. Normative Authority

This specification is the normative architectural definition of Evolution Engine.

Implementation details MAY differ.

Observable behavior SHALL conform.

## 42. Future Evolution

Future revisions SHALL:

- preserve architectural consistency;
- preserve deterministic behavior;
- preserve contracts where possible;
- document incompatible changes;
- provide migration guidance.

# End of Volume VII

Together, Volumes I through VII define the complete Software Architecture Specification of Evolution Engine.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/integration`.

The package owns EngineState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V7-REQ-001` | Lifecycle transitions are explicit and validated. |
| `V7-REQ-002` | Scheduler creates a deterministic dependency plan. |
| `V7-REQ-003` | Parallel completion order never defines merge/publication order. |
| `V7-REQ-004` | Contexts are isolated. |
| `V7-REQ-005` | Cross-volume communication uses public contracts and immutable states. |
| `V7-REQ-006` | Configuration is immutable for an execution transaction. |
| `V7-REQ-007` | Extensions declare capabilities, versions, and deterministic behavior. |
| `V7-REQ-008` | Global validation runs before EngineState publication. |
| `V7-REQ-009` | EngineState publication is atomic. |
| `V7-REQ-010` | Save/load verifies checksums, versions, migrations, schemas, and hashes. |
| `V7-REQ-011` | Adapter failures cannot mutate authoritative state. |
| `V7-REQ-012` | Complete pipeline replay reproduces the EngineState hash. |

## F. Exit Gate

The volume is accepted only when all `VII` requirement IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete.
