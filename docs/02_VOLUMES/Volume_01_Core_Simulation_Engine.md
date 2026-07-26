# Evolution Engine — Volume I

# Core Simulation Engine Specification

## 1. Purpose

The Core Simulation Engine defines the deterministic temporal and state-management foundation of Evolution Engine.

It is responsible for:

- simulation time;
- timeline progression;
- event processing;
- world state;
- deterministic replay;
- core constraints;
- resource scheduling primitives;
- DNA version references;
- immutable state publication.

It SHALL NOT generate geometry, materials, or rendering data.

## 2. Scope

Volume I owns all engine-level simulation behavior that must remain independent of species, growth, composition, geometry, and materials.

## 3. Core Principles

The Core Simulation Engine SHALL be:

- deterministic;
- replayable;
- versioned;
- serializable;
- validation-driven;
- independent of rendering;
- independent of implementation-specific thread behavior.

## 4. Simulation Context

A Simulation Context SHALL include:

- context identifier;
- simulation seed;
- timeline configuration;
- active world identifier;
- configuration version;
- DNA version registry reference;
- execution metadata;
- deterministic random stream registry.

Contexts MUST be isolated from one another.

## 5. Simulation Time

Simulation time SHALL use an explicit representation.

The implementation SHALL define:

- tick index;
- logical time;
- step duration;
- substep index;
- epoch identifier.

Wall-clock time MUST NOT directly affect deterministic simulation output.

## 6. Timeline

The Timeline SHALL:

- maintain ordered simulation ticks;
- support pause, resume, and deterministic stepping;
- preserve event ordering;
- expose current logical time;
- support checkpoints;
- support replay from checkpoints.

## 7. Event Model

Every simulation event SHALL include:

- event identifier;
- event type;
- source;
- target;
- logical timestamp;
- priority;
- sequence number;
- payload version;
- deterministic ordering key.

Events with identical timestamps SHALL be ordered deterministically.

## 8. Event Queue

The Event Queue SHALL:

- reject invalid events;
- maintain stable ordering;
- support deterministic insertion;
- support cancellation before execution;
- support replay;
- prevent duplicate authoritative execution.

## 9. World State

World State is the authoritative representation of simulation-level reality.

World State MAY include:

- environment variables;
- resource fields;
- zones;
- global constraints;
- active entities;
- environmental signals;
- species instance references;
- simulation metadata.

World State SHALL NOT contain mesh or material implementation objects.

## 10. State Mutation

World State mutation SHALL occur only inside controlled simulation transactions.

A transaction SHALL:

1. read an immutable input snapshot;
2. apply deterministic operations;
3. validate the resulting state;
4. publish atomically;
5. emit deterministic events.

Failed transactions MUST NOT partially publish.

## 11. State Publication

Published World State SHALL be:

- immutable;
- versioned;
- serializable;
- hashable;
- replayable;
- externally readable through a public API.

## 12. Deterministic Randomness

All random behavior SHALL derive from deterministic random streams.

A random stream SHALL be identified by:

- simulation seed;
- stream namespace;
- entity or subsystem key;
- tick;
- sequence index.

Use of unseeded randomness is prohibited.

## 13. Constraints

Volume I SHALL provide generic constraint abstractions.

Constraints MAY represent:

- temporal limits;
- resource limits;
- world boundaries;
- execution limits;
- global rules.

Species-specific and growth-specific constraints belong to later volumes.

## 14. Resource Scheduling Primitives

Volume I SHALL expose deterministic primitives for:

- resource claims;
- resource release;
- priority resolution;
- scheduling windows;
- conflict detection;
- capacity enforcement.

## 15. DNA Version Registry

Volume I SHALL maintain references to known DNA schema versions.

It SHALL NOT interpret species DNA.

The registry SHALL provide:

- version lookup;
- compatibility metadata;
- migration availability;
- deprecation status.

## 16. Replay

Replay SHALL reconstruct authoritative World State from:

- initial checkpoint;
- configuration;
- seeds;
- event stream;
- specification versions.

Replay output MUST match the original published state hash.

## 17. Checkpoints

A checkpoint SHALL include:

- World State;
- timeline position;
- random stream positions;
- pending event queue;
- configuration version;
- DNA version registry state;
- validation metadata.

## 18. Serialization

Serialization SHALL preserve all information necessary for deterministic restoration.

Runtime-specific resources MUST NOT be serialized.

## 19. Validation

Volume I validation SHALL verify:

- timeline consistency;
- event ordering;
- unique identifiers;
- state version monotonicity;
- random stream validity;
- checkpoint completeness;
- constraint consistency;
- absence of forbidden runtime references.

## 20. Diagnostics

Diagnostics MAY include:

- tick duration;
- event counts;
- replay hashes;
- queue depth;
- transaction failures;
- constraint conflicts;
- resource contention.

Diagnostics MUST NOT influence simulation behavior.

## 21. Public API

The Core Simulation Engine SHALL provide capabilities equivalent to:

- create context;
- destroy context;
- initialize world;
- advance simulation;
- pause simulation;
- resume simulation;
- enqueue event;
- cancel event;
- retrieve World State;
- create checkpoint;
- restore checkpoint;
- replay;
- validate;
- serialize;
- deserialize;
- retrieve diagnostics.

## 22. Error Handling

Errors SHALL be structured and versioned.

Error categories SHALL include:

- invalid configuration;
- invalid event;
- constraint violation;
- replay mismatch;
- serialization failure;
- state validation failure;
- incompatible version.

## 23. Thread Safety

Parallel execution MAY be used internally.

Observable ordering and published output MUST remain deterministic.

## 24. Invariants

- Published World State is immutable.
- Wall-clock time does not affect authoritative output.
- Event order is deterministic.
- Randomness is seeded and namespaced.
- Failed transactions do not publish.
- Replay reproduces identical state.
- Volume I does not generate geometry or materials.

## 25. Completion Criteria

Volume I is complete when:

- deterministic stepping works;
- replay hash equality is verified;
- checkpoints restore correctly;
- events execute in stable order;
- World State publication is atomic;
- serialization round trips successfully;
- validation detects invalid states.

---

# Claude Code Implementation Appendix

## A. Package Ownership

Reference package: `packages/core-simulation`.

The package owns WorldState behavior and exposes only its documented public API through the package root. Private modules are not cross-volume integration points.

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
| `V1-REQ-001` | Logical time is explicit and independent of wall-clock time. |
| `V1-REQ-002` | Event ordering is total, stable, and deterministic. |
| `V1-REQ-003` | WorldState publication is immutable and atomic. |
| `V1-REQ-004` | All authoritative randomness uses versioned deterministic streams. |
| `V1-REQ-005` | Failed transactions publish no partial state. |
| `V1-REQ-006` | Checkpoints include every value required for exact continuation. |
| `V1-REQ-007` | Replay reproduces intermediate and final canonical hashes. |
| `V1-REQ-008` | Resource conflicts use stable deterministic resolution. |
| `V1-REQ-009` | DNA registry stores versions and compatibility but does not interpret DNA. |
| `V1-REQ-010` | Serialization rejects runtime-specific resources. |
| `V1-REQ-011` | Diagnostics do not affect execution. |
| `V1-REQ-012` | Volume I contains no geometry or material generation. |

## F. Exit Gate

The volume is accepted only when all `I` requirement IDs are `VERIFIED`, public API and serialization contract tests pass, deterministic fixtures match, no forbidden dependency exists, and the implementation report is complete.
