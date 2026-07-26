# Testing and Validation Strategy

## Test Pyramid

### Unit Tests

Verify pure functions, value objects, comparators, validators, state transitions, placement scoring, junction classification, and algorithms.

### Property-Based Tests

Generate broad input ranges for invariants such as:

- serialization round trip;
- immutable publication;
- stable sorting;
- no duplicate IDs;
- conservation and capacity rules;
- graph integrity;
- reservation-before-growth;
- topology validity;
- no body intersection outside declared junction zones;
- no externally visible internal face;
- no material binding on internal/removed regions.

### Contract Tests

Verify package public APIs, cross-volume state compatibility, `AttachmentJunction` fields, stable region IDs, and rejection of dangling junction references.

### Golden Tests

Version canonical fixtures and expected hashes for representative states, event streams, species profiles, growth graphs, meshes, junctions, materials, and complete EngineState.

Golden updates require explanation and requirement/ADR references.

### Replay Tests

Execute from initial state and checkpoints, then compare intermediate and final hashes.

### Metamorphic Tests

Verify logically irrelevant changes do not change output, including input insertion order, diagnostics enablement, worker count, non-authoritative metadata, and camera position for authoritative geometry.

### Fuzz and Robustness Tests

Exercise untrusted configuration, serialized files, extension manifests, malformed graphs, geometry indices, extreme attachment proportions, near-coincident junctions, and tolerance boundaries.

### Geometry Integrity Tests

When fused geometry is generated, tests SHALL inspect authoritative geometry rather than relying only on screenshots.

Required probes include:

- child base-cap absence from the external shell;
- internal-face visibility from strict and oblique underside rays;
- triangle intersections outside junction bounds;
- manifold/boundary policy at the sealed junction;
- duplicate/coplanar face and z-fighting risk detection;
- stable semantic-region and junction ownership;
- correctness at every published LOD.

### Material Integrity Tests

Required probes include:

- no material assignment to removed/internal faces;
- no child texture, normal, emissive, or procedural mask contribution on unrelated host regions;
- blend masks restricted to the declared external seam band;
- consistent region ownership across LODs.

### Visual Fixtures

Use fixed camera, lighting, viewport, DPR, seed, and renderer settings for:

- full 360-degree orbit;
- top and side views;
- strict underside view;
- oblique underside views;
- junction close-ups;
- maximum child count;
- thin-host/thick-child stress case;
- minimum-spacing neighboring children;
- representative mobile LODs.

Visual fixtures supplement geometry and material assertions; they do not replace them.

### Integration Tests

Run the approved cross-volume slice with real package contracts and controlled adapters. Full Volume I–VII integration is required only when that scope is explicitly active.

## Coverage

Coverage is evidence, not the goal. Deterministic kernel and public contract branches SHOULD achieve at least 95% branch coverage; other engine packages SHOULD achieve at least 90% branch coverage. Lower coverage requires a documented reason and stronger alternate evidence.

## Test Quality

- A test must fail when the targeted behavior is broken.
- Avoid snapshots for large opaque structures unless canonical and reviewable.
- Never rely on random unrecorded seeds.
- Record the failing seed for property tests.
- No flaky retries are permitted as a substitute for root-cause correction.
- A screenshot-only test cannot verify hidden geometry or material ownership.

## CI Gates

Required on protected branches for the active scope:

- format check;
- lint;
- typecheck;
- unit and property tests;
- contract tests;
- determinism and replay tests;
- serialization fixtures;
- geometry and material integrity tests when applicable;
- integration tests for the approved slice;
- build;
- documentation validation;
- dependency/security audit according to repository policy.
