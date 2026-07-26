# Determinism Standard

## 1. Deterministic Input Envelope

An authoritative operation is determined by:

- canonical input states;
- canonical configuration;
- logical timeline position;
- deterministic seed and stream namespace;
- schema/specification/implementation versions;
- registered extension versions;
- deterministic task plan.

## 2. Forbidden Inputs

Authoritative decisions SHALL NOT depend on:

- wall-clock time or timezone;
- process ID, thread ID, memory address, or object identity;
- `Math.random()` or platform randomness;
- network timing;
- database row return order without explicit ordering;
- filesystem enumeration order;
- locale-sensitive comparison;
- GPU execution order;
- diagnostics timing;
- current camera state;
- React render order.

## 3. PRNG

All random values SHALL come from `DeterministicRng`.

Each stream is derived from:

```text
masterSeed | volume | contextId | entityId | logicalTick | operation | streamIndex
```

The algorithm name, algorithm version, and restorable internal state SHALL be serialized. Test vectors SHALL lock expected outputs.

## 4. Ordering

Canonical ordering uses an explicit comparator over normalized strings and numeric keys. Do not use `localeCompare`.

Every unordered logical collection SHALL define a tie-breaker ending in a stable ID.

## 5. Numbers

Canonical numeric values SHALL:

- be finite;
- normalize negative zero to zero;
- reject `NaN` and infinities;
- use documented units;
- apply module-specific tolerance only at explicit boundaries;
- be serialized canonically.

Where accumulation order can change results, use a fixed traversal order and a documented stable summation strategy.

## 6. Canonical Serialization

Canonical serialization SHALL:

- sort object keys deterministically;
- preserve array order;
- omit no required field;
- reject unsupported values;
- encode text as UTF-8;
- produce identical bytes for identical canonical data;
- include serializer algorithm and version in manifests.

## 7. Hashing

Use SHA-256 for canonical content hashes unless an accepted ADR changes it.

Hash scope excludes:

- wall-clock timestamps;
- performance timings;
- log formatting;
- machine paths;
- non-authoritative diagnostics.

Hash scope includes all behaviorally authoritative data and versions.

## 8. Concurrency

Parallel tasks MAY run only when their inputs are immutable and their result merge order is explicitly defined. Completion timing SHALL NOT determine merge order.

## 9. Replay

Replay SHALL restore PRNG state, pending events, timeline position, configuration, versions, and extension manifests. Final and intermediate checkpoint hashes SHALL match expected values.

## 10. Determinism Test Matrix

Required tests:

- same process repeated runs;
- fresh process repeated runs;
- different worker counts;
- different insertion orders for logically equivalent inputs;
- save/load continuation;
- checkpoint replay;
- supported operating systems and runtimes in CI;
- extension registration order permutations;
- diagnostics enabled versus disabled.

Any hash mismatch is a release blocker.
