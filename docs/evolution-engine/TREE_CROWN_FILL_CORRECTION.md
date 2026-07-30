# Tree Crown Fill Correction

## Problem

The accepted Tree pipeline could still publish a visually hollow crown even when all structural contracts passed.

The root cause was upstream:

- Foliage Architecture placed every cluster only in the final 42% of a branch;
- primary branches received one cluster, secondary branches two and twigs three;
- medium LOD rendered only 58% of each cluster's logical leaves;
- later Canopy Depth, Orientation and Silhouette phases could only enlarge or move those existing cards;
- production acceptance verified identity, budgets and readable orientation, but did not prove that the interior branch span contained foliage.

## Correction

The default foliage grammar now:

- starts accepted placement at 30% of each eligible branch;
- emits 2 primary, 3 secondary and 3 twig clusters;
- uses 12–20 logical leaves per cluster;
- expands the bounded cluster radius to 0.14–0.30;
- keeps the existing 64-cluster and 900-logical-leaf ceilings.

Medium Leaf Geometry now represents 76% of logical leaves with a 720-instance ceiling and slightly broader leaf cards.

This changes the source architecture of the crown instead of stretching a terminal-only shell.

## Acceptance

The regression suite now requires:

- at least 20% of accepted clusters to originate before the old 58% terminal boundary;
- a real interior sample before the halfway point of a branch;
- at least four occupied crown cells;
- no medium cluster without a rendered leaf instance;
- at least 68% of logical foliage represented in medium LOD.

All accepted leaf IDs remain deterministic for the new versioned rules. Rendering remains one shared leaf geometry, one foliage material, one `InstancedMesh` and one leaf draw call.

## Runtime build metric

`buildMs` is a cold synchronous build measured before browser and JavaScript JIT warmup. The previous 80 ms hard production gate produced false red failures on real Android browsers even when geometry, draw calls and runtime rendering were valid.

The hard cold-build ceiling is now 220 ms. Geometry, triangle, material and draw-call limits are unchanged:

```text
12,000 shared/static vertices
16,000 rendered triangles
220 ms cold deterministic build
4 runtime draw calls
3 materials
```

This correction does not add Supabase reads or writes and does not affect Crystal or Reef pipelines.
