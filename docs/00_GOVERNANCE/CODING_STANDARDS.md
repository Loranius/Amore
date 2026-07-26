# Coding Standards

## Pure Core

A pure deterministic function:

- receives every authoritative input explicitly;
- performs no I/O;
- reads no wall clock;
- reads no global mutable state;
- uses only supplied deterministic randomness;
- returns a value or structured error;
- is independently testable.

## Types

- Prefer branded identifiers over raw strings.
- Use discriminated unions for lifecycle states, events, commands, and errors.
- Make invalid states unrepresentable where practical.
- Validate every external value before conversion to a domain type.
- Avoid `any`; justify and isolate unavoidable `unknown` narrowing.

## Mutability

Mutable builders MAY exist inside a transaction. They SHALL NOT escape. Publication converts results to immutable state.

## Errors

- No empty catch blocks.
- No string-only domain errors.
- Errors include stable code, message, severity, volume, operation, correlation ID, and structured details.
- Expected domain failures use typed results rather than uncontrolled exceptions.

## Logging

Logs may contain operational metadata but SHALL NOT change behavior. Do not log secrets, raw credentials, or unnecessary personal data.

## Dependencies

Add a dependency only when it:

- has a clear owner and purpose;
- does not violate deterministic boundaries;
- is version-pinned through the lockfile;
- has acceptable license and maintenance posture;
- is covered by contract tests where output stability matters.

## Comments and Documentation

Document invariants, rationale, and non-obvious algorithms. Do not narrate obvious syntax. Public APIs require concise contract documentation.

## Forbidden Final-State Markers

Final production code SHALL NOT contain unresolved `TODO`, `FIXME`, `HACK`, `TEMP`, placeholder throws, or dummy return values unless linked to a tracked issue and explicitly excluded from the release scope.
