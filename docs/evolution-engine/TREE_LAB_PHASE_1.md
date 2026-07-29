# Tree Lab — Phase 1: Organic Skeleton

## Purpose

This phase teaches Amore to build a deterministic organic branch skeleton before
we add tree geometry, leaves, materials or a renderer.

The lab is isolated from production Home and the current Crystal pipeline.

```text
Seed + ordered attractors
  -> append-only organic growth
  -> branch graph
  -> later: curve frames
  -> later: sweep mesh
  -> later: junction blending
  -> later: Tree Species
```

## Research references

### EZ-Tree

Reference: https://github.com/dgreenheck/ez-tree

Useful architectural lessons:

- keep the generated skeleton separate from meshing;
- consume randomness only while constructing the skeleton;
- build multiple LOD meshes from the same stable skeleton;
- model trunk, branch generations, taper and leaves as separate concerns.

EZ-Tree is MIT licensed. The current Tree Lab does not copy its generator; it
implements Amore-specific contracts in TypeScript around the existing Evolution
and Growth architecture.

### Space-colonization experiments

Reference: https://github.com/jasonwebb/2d-space-colonization-experiments

The repository is CC BY-NC-SA, so its implementation is not copied into Amore.
Tree Lab uses only the general, published idea of attractor-guided organic growth
and provides an original 3D incremental algorithm.

## Contracts

### Attractor

An attractor is a stable desired growth location:

- stable ID;
- append sequence;
- 3D position;
- normalized weight.

Later Tree Species will derive attractors from relationship history. Coral can
reuse the same contract with different field shapes and growth constraints.

### Skeleton node

Every node records:

- stable ID and branch ID;
- parent ID;
- source attractor;
- generation;
- position and direction;
- radius;
- terminal state.

No Three.js type appears in the contract.

## Append-only rule

Attractors are processed by stable sequence and ID. A later attractor may append
a branch path, but it cannot mutate an existing node.

This is intentionally different from a global relaxation solver. It protects the
Evolution Engine guarantee that a new relationship event cannot move historical
growth.

## Mobile compactness

The current lab clamps the skeleton to a configurable crown cylinder:

- horizontal crown radius;
- total height;
- maximum three branch generations;
- fixed node budget;
- fixed maximum segments per attractor.

These are laboratory constraints, not final Tree Species aesthetics.

## Phase 1 acceptance

- deterministic output for the same seed;
- independent of attractor input order;
- one rooted trunk;
- no orphan nodes;
- maximum generation respected;
- compact crown bounds respected;
- later attractors leave historical nodes byte-stable;
- node budget truncates only later growth.

## Explicitly not included

- Tree Species adapter;
- relationship-event mapping;
- spline interpolation;
- branch surface geometry;
- organic junction blending;
- leaves, flowers or fruit;
- materials, wind or Life Engine;
- Home preview or production renderer changes;
- Coral Species.

## Next phase

Phase 2 will convert the branch graph into smooth curve frames and generate a
low-poly sweep mesh with stable LOD tiers. It must reuse the same skeleton rather
than regenerate growth per LOD.
