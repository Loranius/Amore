---
name: amore-3d-geometry
description: Procedural 3D mesh generation for Amore's Evolution Engine (crystal, tree, coral reef species). Use this whenever changing how a species' shape/mesh/branching/faceting is generated, adding a new archetype or formation, fixing a "looks too regular / plastic / machined" complaint, working on trim/junction/attachment between host and child bodies, or touching anything under src/engine/geometry/, src/engine/growth/, src/engine/species/*/, or src/engine/foliage/. Also use when a visual QA pass finds hidden faces, visible base caps, texture breakthrough, or self-intersecting geometry — this skill has the determinism and attachment-integrity rules that govern how those get fixed safely.
---

# Amore 3D Geometry

## Why this skill exists

Amore's three species (crystal, tree, reef) all share one architecture: a
deterministic **growth engine** decides *which* bodies exist and where
(driven by the couple's real events — memories, plans, wishlist items), and
a separate **geometry layer** decides *how each body is shaped as a mesh*.
Get this boundary wrong and you either break the "your relationship shapes
this object" semantics, or you break determinism (same data must always
render the same mesh, forever — snapshots aren't stored, they're rebuilt).

Read `docs/01_CONTRACTS/DETERMINISM_STANDARD.md` and
`docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md` before making
non-trivial geometry changes. This skill summarizes the parts you'll hit
most often; those docs are the normative source when in doubt.

## The three geometry pipelines

| Species | Growth/placement | Shape/mesh | Attachment |
|---|---|---|---|
| Crystal | `src/engine/growth/` | `src/engine/geometry/profile.ts` (lathe profile) + `mesh.ts` (revolve to triangles) | `src/engine/geometry/trim.ts`, `junction.ts` |
| Tree | `src/engine/species/tree/` | `src/engine/foliage/treeFoliage.ts` | via growth hierarchy, no host/child mesh trim yet |
| Reef | `src/engine/species/reef/skeletons/`, `layout/` | `src/engine/species/reef/meshes/reefColonyMeshes.ts` | `src/engine/species/reef/foundation/` |

All three feed a Three.js/R3F renderer directly — there is **no** separate
runtime engine involved (a parallel Godot port existed briefly and was
reverted; see `docs/05_ADR/ADR-0002-godot-crystal-engine-reverted.md` for
why duplicating this layer in another engine failed).

## How the crystal is actually built (read this before touching it)

`buildCrystalProfile` (`profile.ts`) generates a list of **rows** — each row
is a `{y, radiusX, radiusZ, centerOffsetX/Z, rotation, facetPhase}` — walking
up the body's local axis. `buildCrystalMesh` (`mesh.ts`) then **revolves**
each row into a ring of `segments` vertices and stitches rings into
triangles. This is a lathe, not a general mesh — every cross-section is
still fundamentally an ellipse, just decorated.

Three independent knobs control how "organic" a ring looks, and it's easy
to reach for the wrong one:

- **Per-row radius** (`radiusX`/`radiusZ` in `profile.ts`) — controls the
  overall silhouette bulge/taper as you go up the body. This is where twist,
  lean, and archetype shape live.
- **Per-vertex radius jitter** (`facetJitter`/`rowJitter` in `mesh.ts`) —
  small multiplicative noise on how far each facet vertex sits from the
  ring center. This adds surface bumpiness. Real gem facets are flat, so
  keep this subtle — it's for "not a perfect lathe," not for roughness.
- **Per-vertex angular jitter** (`facetAngleJitter`/`rowAngleJitter` in
  `mesh.ts`) — offsets *where around the ring* each vertex sits, so facets
  end up different widths instead of a perfectly even n-gon. This is the
  lever that actually reads as "hand-cut crystal" vs. "machined prism" —
  regular angular spacing is what makes a lathe look like a lathe. If a
  crystal looks too "plastic" or "regular," this is usually the fix, not
  radius jitter. It must stay bounded well under half the angular step
  (`(2π/segments)`) or adjacent facets invert/cross — see the existing
  jitter magnitudes (0.28 / 0.07 of the step) for a safe reference point,
  and add a test like `profile.test.ts`'s "gives ring facets irregular
  widths" that checks gaps stay positive and sum to 2π.

## Determinism rules that actually get violated in practice

- Every random-seeming value must come from `seededUnit(seed, label)` or
  `stableHash32` (see `src/engine/growth/math.ts`), never `Math.random()`.
  The `label` string is part of the seed — reusing a label elsewhere in the
  same body silently correlates two things that should vary independently.
- Never use `Array.sort()` with `localeCompare` on canonical output —
  locale-dependent, forbidden by `DETERMINISM_STANDARD.md`. Use a plain
  `a < b ? -1 : a > b ? 1 : 0` comparator (see `compareIds` pattern already
  in these files).
- Diagnostics/telemetry timing must never feed back into geometry decisions.

## Attachment integrity (host/child junctions)

`CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md` exists because "just overlap two
closed meshes and hope the overlap hides the seam" produces visible base
caps and texture breakthrough — a *known, named failure mode*, not a
one-off bug. If you're placing a child body against a host:

- Volume III (growth) must reserve a junction zone and enforce clearance
  from other children — not just place a point.
- Volume IV/V (composition/geometry) must classify triangles as
  external/junction/internal and remove or blend at the junction — burial
  alone (sinking the child's base below the host surface) is **not
  sufficient** on its own; `trim.ts`'s `triangleTouchesProtectedTip` /
  `triangleInsideSolid` do the real classification. Check both ends: a
  child whose tip leans back toward a denser neighbor can end up with its
  "protected" band wrongly kept visible.
- Always visually check the **underside** and oblique angles, not just the
  default camera angle — hidden-face bugs hide exactly where you're not
  looking. See the `amore-3d-visual-polish` skill for how to actually
  render and screenshot a body outside the full app pipeline.

## Testing pattern

Tests in this codebase mirror the production formula rather than hardcoding
magic golden numbers (see `profile.test.ts`) — when you change a formula,
update the mirrored test formula in lockstep and explain *why* in the test
comment (per `.claude/rules/tests.md`: never update a golden fixture without
explaining the semantic change). Add a new test for any new geometric
invariant you're relying on (e.g., "no self-intersection," "sum of gaps is
2π") rather than trusting a screenshot alone — screenshots catch the bug
once, tests catch every regression after.

## Before you touch mesh generation, ask

1. Is this a **placement** problem (wrong body, wrong position, wrong
   count) or a **shape** problem (right body, ugly mesh)? Placement bugs
   live in `growth/`, shape bugs live in `geometry/`/`meshes/`. Don't fix a
   placement bug by hacking the mesh builder.
2. Does the change affect `trim.ts`/junction logic? If you're only changing
   *where* vertices sit within a ring (not which triangles exist or how
   many bodies there are), trim/junction code is almost always unaffected —
   it only reads triangle world positions, not facet indices.
3. Run `npm run typecheck && npm test` and, for anything visual, actually
   render it (see `amore-3d-visual-polish`) before calling it done —
   passing tests don't guarantee it looks right.
