# Canonical Data Contracts

## 1. Common State Header

Every published state SHALL contain semantic equivalents of:

```ts
interface PublishedStateHeader {
  readonly stateId: string;
  readonly stateType: string;
  readonly stateVersion: string;
  readonly schemaVersion: string;
  readonly engineSpecificationVersion: string;
  readonly parentStateIds: readonly string[];
  readonly canonicalHash: string;
  readonly createdAtLogicalTick: string;
  readonly provenanceId: string;
}
```

Operational wall-clock metadata may exist outside the canonical hash.

## 2. Provenance

Provenance SHALL identify:

- canonical input state IDs and hashes;
- configuration ID and hash;
- seed namespace and PRNG algorithm version;
- implementation and specification versions;
- extension versions;
- migration chain;
- operation identifier.

## 3. Identifiers

Identifiers SHALL be stable strings with a type-specific prefix. Authoritative deterministic objects use IDs derived from canonical namespace and content or from a deterministic sequence inside the owning transaction.

Random UUID generation is prohibited in deterministic paths.

## 4. Version Fields

Use semantic version strings for schemas, specifications, implementations, generators, and algorithms. Store exact versions in published state.

## 5. References

Cross-volume references SHALL contain the target stable ID and, where integrity matters, expected canonical hash or version.

Dangling references are validation failures.

## 6. Collections

Canonical collections SHALL be arrays with defined ordering. Map-like data SHALL serialize as sorted key/value entries. Sets SHALL serialize as sorted unique arrays.

## 7. Commands and Events

A canonical command or event SHALL include:

- ID;
- type;
- schema version;
- source;
- target or scope;
- logical tick;
- deterministic sequence;
- correlation ID;
- causation ID where applicable;
- payload.

## 8. Validation Report

A validation report SHALL include:

- report ID;
- subject ID and hash;
- validator version;
- status;
- ordered findings;
- requirement IDs;
- canonical report hash if published.

## 9. Volume Outputs

Normative names:

- Volume I: `WorldState`
- Volume II: `SpeciesProfile`
- Volume III: `GrowthState`
- Volume IV: `CompositionState`
- Volume V: `GeometryState`
- Volume VI: `MaterialState`
- Volume VII: `EngineState`

## 10. Attachment Junction References

When the Crystal Attachment Integrity Profile is enabled, `CompositionState` SHALL publish versioned attachment junctions and `GeometryState`/`MaterialState` SHALL preserve stable references to their junction-derived regions. The normative fields and invariants are defined in [Crystal Attachment Integrity Profile](CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md).

A geometry or material region derived from a junction SHALL retain the junction ID in provenance or semantic-region metadata.

## 11. Immutability

Published objects SHALL expose no mutating API. Binary buffers SHALL be copied, transferred under exclusive ownership, or wrapped by an immutable access contract before publication.
