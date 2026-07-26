# Repository Structure

## Required Logical Layout

Preserve an existing compatible monorepo layout. For a new implementation, use:

```text
packages/
  contracts/              # Shared value types and public wire contracts
  deterministic-kernel/   # Canonicalization, hashing, PRNG, ordering, immutability
  core-simulation/        # Volume I
  species/                # Volume II
  growth/                 # Volume III
  composition/            # Volume IV
  geometry/               # Volume V domain and algorithms
  materials/              # Volume VI
  integration/            # Volume VII
  testkit/                # Golden fixtures, generators, assertions, replay helpers
  adapters-three/         # Three.js conversion only
  adapters-r3f/           # React Three Fiber visualization only
  adapters-supabase/      # Persistence only
  inspector/              # Optional developer UI
apps/
  demo/                   # Optional product/demo shell
docs/
tests/
  contract/
  determinism/
  integration/
  performance/
```

## Dependency Rules

- `contracts` depends on no engine package.
- `deterministic-kernel` depends only on `contracts` and audited utility dependencies.
- Volume packages depend only on shared contracts, deterministic kernel, and explicitly permitted upstream public contracts.
- No volume imports a downstream package.
- Adapters may import engine public contracts; engine packages never import adapters.
- UI packages never become dependencies of core packages.

## Package Public Surface

Each package SHALL expose public symbols only through its root export file. Deep imports into another package are prohibited.

## Internal Layout

Recommended package layout:

```text
src/
  domain/          # Pure domain types and functions
  application/     # Use cases and transactions
  ports/           # External interfaces
  infrastructure/  # Package-local adapter implementations only
  validation/
  serialization/
  index.ts
```

## Test Placement

- Unit tests next to source or under package `test/` according to repository convention.
- Cross-package contract tests under `tests/contract/`.
- Golden replay fixtures under `tests/fixtures/` and versioned in Git.
- Performance benchmarks under `tests/performance/`; they do not run inside authoritative logic.
