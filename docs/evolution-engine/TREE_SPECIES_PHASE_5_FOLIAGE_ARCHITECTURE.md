# Tree Species — Phase 5: Foliage Architecture

## Purpose

This phase defines where foliage may exist before any leaf mesh, texture,
material, season or wind system is introduced.

```text
Tree Species
  → Organic Skeleton
  → Curve Frames
  → Tree Composition
  → Foliage Architecture
  → later: leaf geometry and material projection
```

## Stable cluster contract

Each foliage cluster contains:

- stable ID derived from branch ID and local slot;
- source branch and curve-frame sample;
- generation and branch role;
- renderer-independent position, direction and normal;
- cluster radius and density;
- deterministic leaf budget;
- azimuth sector, vertical layer and crown-cell ID;
- stable seed for a later leaf renderer.

The state contains no Three.js, React, Supabase, DOM or material types.

## Placement rules

- foliage is never attached to the trunk;
- primary, secondary and twig branches receive separate local cluster counts;
- clusters are sampled only from the terminal part of a branch;
- placement is offset beyond the branch surface along a deterministic radial frame;
- branch-local composition descriptors determine crown-sector and layer ownership;
- cluster identity and placement do not depend on later branches.

## Append-only budget

The default mobile ceiling is:

- 64 foliage clusters;
- 900 logical leaves;
- 8–18 logical leaves per cluster.

Candidates are processed in stable curve order. A global ceiling can only truncate
later candidates. It never redistributes, resizes or renumbers an emitted older
cluster. Tests rebuild a historical prefix and require every retained cluster to
remain byte-identical.

## Current renderer boundary

This phase intentionally does not draw foliage. Tree Lab still renders only the
accepted branch surface while exposing cluster, leaf, occupied-cell and truncation
metrics. That keeps visual styling decisions separate from the structural canopy
contract.

## Pixel 8 Pro acceptance

Both fixture and real portal modes verify:

- candidate count is not below emitted count;
- emitted clusters stay within 64;
- logical leaves stay within 900;
- occupied crown cells and truncation diagnostics are finite;
- existing branch geometry, composition and runtime budgets still pass.

## Explicitly deferred

- leaf-card or instanced-leaf geometry;
- leaf shape families;
- green, autumn or winter materials;
- wind, flutter and Life Engine;
- flowers and fruit;
- production Home rollout.
