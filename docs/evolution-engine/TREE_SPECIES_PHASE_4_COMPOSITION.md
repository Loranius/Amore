# Tree Species — Phase 4: Composition

## Purpose

Tree Composition is a pure analysis stage between organic curve frames and the
existing sweep mesh. It measures whether the generated tree reads as a coherent
organic composition without changing the skeleton, curves, junctions or mesh.

```text
Tree Species
  → Organic Skeleton
  → Curve Frames
  → Tree Composition analysis
  → existing shared-LOD Sweep Mesh
```

## Composition contract

The state records:

- silhouette: `columnar`, `oval`, `umbrella` or `windswept`;
- one stable descriptor per branch;
- trunk, primary, secondary and twig hierarchy;
- branch length, mean radius and estimated frustum volume;
- radial reach, height interval, azimuth sector and occupied crown layers;
- fixed composition bounds;
- normalized quality scores and diagnostics.

## Scores

Tree Composition reports values from 0 to 1 for:

- hierarchy;
- directional flow;
- silhouette coherence;
- crown density;
- balance;
- branch rhythm;
- negative space;
- junction realism;
- weighted total composition quality.

These values are diagnostics only. They do not trigger global relaxation or
rewrite historical growth.

## Append-only boundary

Branch-local descriptors use:

- the stable branch curve;
- the stable trunk axis and base;
- fixed Tree Species crown dimensions;
- fixed sector and vertical-layer grids.

Therefore adding later branches can change global composition scores and crown
occupancy, but it cannot change the descriptor of an already existing branch.
The test suite explicitly removes later branches and verifies that every retained
branch descriptor remains byte-stable.

## Renderer boundary

Composition has no React, Three.js, Supabase or browser imports. The existing
sweep mesh still consumes the original curve frames directly. This phase does not
move, rotate, resize, trim, delete or regenerate geometry.

## Preview acceptance

The isolated Tree Lab exposes:

- silhouette;
- total composition score;
- negative-space score;
- crown-density score;
- empty crown-cell count.

Pixel 8 Pro tests validate these metrics for both the fixed fixture and the
read-only real portal history while retaining the existing topology, draw-call
and build-time budget gates.

## Explicitly deferred

- foliage placement;
- bark and branch materials;
- roots;
- wind and Life Engine;
- automatic composition correction;
- production Home rollout.
