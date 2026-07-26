# Reference Implementation Profile — TypeScript

## 1. Platform

The reference implementation uses TypeScript with ECMAScript modules.

The existing repository package manager and lockfile are authoritative. A new standalone repository SHOULD use a workspace-capable package manager and pin its exact version.

## 2. Compiler Requirements

Enable at minimum:

- `strict`;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- `noImplicitOverride`;
- `useUnknownInCatchVariables`;
- `noFallthroughCasesInSwitch`.

Public state types SHALL use readonly fields and readonly collections.

## 3. Runtime Schemas

Use Zod or the repository's existing equivalent at all untrusted boundaries:

- file load;
- network input;
- database input;
- extension manifests;
- configuration;
- serialized states.

Static TypeScript types do not replace runtime validation.

## 4. Deterministic Utilities

Provide project-owned abstractions for:

- `DeterministicRng`;
- `CanonicalSerializer`;
- `ContentHasher`;
- `StableComparator`;
- `IdFactory`;
- `Clock` for non-authoritative metadata only.

The default PRNG algorithm and serializer version SHALL be pinned and encoded in saved state.

## 5. Data Structures

- Do not rely on insertion order unless it is established by canonical construction and tested.
- Convert maps and sets to deterministically sorted arrays before hashing or serialization.
- Do not use `localeCompare` for canonical ordering.
- Reject sparse arrays in canonical state.
- Reject `undefined`, functions, symbols, `NaN`, positive/negative infinity, and negative zero in canonical state.

## 6. Three.js and React

`three`, `@react-three/fiber`, `@react-three/drei`, and post-processing packages are presentation adapters.

Core GeometryState SHALL use engine-owned plain data and typed arrays. Conversion to `THREE.BufferGeometry` occurs in `adapters-three` after publication.

React components SHALL subscribe to immutable snapshots and never own authoritative simulation state.

## 7. Supabase and PostgreSQL

Supabase MAY store:

- serialized published states;
- manifests;
- hashes;
- versions;
- project/user metadata;
- generated asset references.

Supabase MUST NOT be queried from pure deterministic functions. Persistence is an Integration Framework port.

## 8. Recommended Quality Tooling

Preserve existing compatible tools. For a new codebase, provide equivalents for:

- formatting;
- linting;
- TypeScript typecheck;
- unit and integration tests;
- property-based testing;
- mutation or test-quality analysis;
- dependency and vulnerability audit;
- benchmark execution.

Vitest integrates naturally with Vite-based TypeScript projects; property tests MAY use `fast-check`. Exact dependencies must be pinned in the lockfile.

## 9. Required Scripts

The root package scripts SHALL expose semantic commands equivalent to:

- `format:check`;
- `lint`;
- `typecheck`;
- `test`;
- `test:contract`;
- `test:determinism`;
- `test:integration`;
- `test:serialization`;
- `build`;
- `quality`.

## 10. Application Stack Compatibility

Evolution Engine may integrate with the existing React, Vite, Tailwind, shadcn/ui, Framer Motion, Lucide, React Three Fiber, Supabase, PostgreSQL, Edge Functions, Realtime, and Storage stack. Those technologies do not alter the core architecture.
