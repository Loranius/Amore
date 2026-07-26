# Error and Diagnostics Contract

## Error Envelope

```ts
interface EngineError {
  readonly code: string;
  readonly volume: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'SHARED';
  readonly operation: string;
  readonly severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  readonly message: string;
  readonly correlationId: string;
  readonly requirementIds: readonly string[];
  readonly details: Readonly<Record<string, unknown>>;
  readonly causeCode?: string;
}
```

## Stable Codes

Error codes are public compatibility contracts. Changing meaning requires versioning.

Recommended namespace:

```text
EE-<VOLUME>-<CATEGORY>-<NUMBER>
```

## Result Semantics

Expected domain failures SHALL use a typed result. Exceptions are reserved for programmer errors, invariant breaches, or unrecoverable infrastructure failures at adapter boundaries.

## Diagnostics

Diagnostics are separate from canonical state unless a specification explicitly promotes a diagnostic finding into a validation result.

Diagnostics MAY contain:

- counts;
- durations;
- solver iterations;
- selected rule IDs;
- rejected candidates;
- resource usage;
- adapter failures.

Performance timing and log order SHALL NOT enter authoritative hashes.

## Redaction

Credentials, tokens, raw secrets, and unnecessary personal data SHALL never appear in errors, diagnostics, snapshots, or fixtures.
