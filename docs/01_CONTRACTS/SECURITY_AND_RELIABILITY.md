# Security and Reliability Contract

## Trust Boundaries

Treat as untrusted:

- user configuration;
- uploaded species definitions;
- serialized states;
- extension manifests;
- database rows;
- network responses;
- generated resource references.

Validate before domain conversion.

## Extension Safety

Extensions SHALL declare capabilities and compatible versions. Unknown or excessive capabilities are rejected. Extensions MUST NOT gain direct access to private mutable state.

## Resource Limits

Validators SHALL enforce configurable limits for:

- event queue size;
- graph nodes and edges;
- recursion/dependency depth;
- geometry vertices and indices;
- material graph nodes;
- serialized payload size;
- solver iterations;
- extension count.

Limit failures are structured and non-corrupting.

## Persistence Safety

- Use checksums and atomic writes.
- Keep the last valid snapshot.
- Apply database migrations transactionally where supported.
- RLS and authentication belong to application/persistence adapters.
- Never place privileged credentials in client-side engine packages.

## Recovery

Recovery SHALL prefer the last validated published state or checkpoint. Partial output is never promoted as authoritative.

## Supply Chain

Pin dependency versions, review lockfile changes, minimize dependency surface, and scan for known vulnerabilities. Deterministic behavior depending on a third-party algorithm requires test vectors and version pinning.
