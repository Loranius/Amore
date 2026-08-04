---
name: amore-tree-look
description: How to make Amore's tree species read as a tree — the techniques reverse-engineered from five reference tree assets, what separates a cheap tree from an expensive one, and the traps in this codebase. Use this whenever working on the tree species: foliage, canopy, leaves, branches, bark, wind, or anything under src/engine/foliage/ or src/engine/species/tree/; whenever the owner says the tree looks flat, plastic, bald, fake, or "like broccoli"; and before importing any tree model. Read it BEFORE changing a leaf or canopy number — the crystal work established that these complaints are almost never caused by the number a reasonable person reaches for, and the measurement workflow that found the real causes is in `amore-crystal-look`.
---

# Amore Tree Look

## Start here

The measurement workflow in **`amore-crystal-look`** applies unchanged: render the
live portal headless, crop, scan a luminance profile, and attribute brightness by
zeroing one term at a time. Do not tune a tree by eye either. That skill also holds
the standing constraints — earned colour (ADR-0004), no committing without an
explicit instruction — which apply to every species.

What follows is only what is *different* about trees.

## What the reference assets actually do

Five models the owner supplied: `tree`, `tree_gn`, `old_tree`, `maple_trees`,
`tree_animate`. They disagree about almost everything except the two things below,
which every one of them does.

**1. Two materials, and only two.** Bark and foliage. Bark is `OPAQUE`; foliage is
`MASK` or `BLEND` and **always `doubleSided`**. There is no third material anywhere
in five models — no separate twigs, no separate trunk cap. If a tree needs a third,
that is a sign the split is in the wrong place.

**2. Leaves are alpha-cut cards, not geometry.** Every model. The differences are
entirely in *how many cards and how large*:

| Model | Triangles | Approach |
|---|---:|---|
| `tree` | 3.3k | a few dozen **large** leaf cards fanned off branch tips |
| `tree_animate` | 19k | mid-size cards, plus one wind animation |
| `tree_gn` | 23k | many **small** cluster cards packed into a dense crown |
| `old_tree` | 125k | cards *and* modelled twigs |
| `maple_trees` | 165k | modelled leaves, no cards |

A tree at 3.3k triangles and a tree at 165k are the same technique at two ends of a
dial. Ours has to sit near the cheap end — the portal already spends ~8.8k on the
colonnade — so the honest reference is `tree` and `tree_gn`, not the maples.

**Alpha cutoff is per-asset, not universal**: 0.13, 0.41, 0.57, 0.70, 0.75 across
the set. It is tuned against the specific leaf texture's alpha ramp. A cutoff copied
from another tree will either eat the leaf edges or leave a halo.

**Only `maple_trees` uses `BLEND`**, and it is the one with modelled leaves and no
sorting problem to speak of. For cards, `MASK` is the answer: blended cards need
back-to-front ordering, and a canopy is thousands of overlapping quads with no
coherent order — exactly the hazard that made the crystal opaque.

## What separates a tree from broccoli

The silhouettes are where these models differ most, and the lesson is about
**crown structure**, not leaf count:

- `tree` reads as a tree despite 3.3k triangles because its cards are arranged in
  **tiers** — distinct layers of foliage with gaps of sky between them, each fanned
  off a visible branch.
- `tree_gn` fills a near-spherical crown with small clusters. It reads as dense
  canopy, and it only works because the clusters vary in size and the trunk splits
  visibly before disappearing into them.

What neither does is distribute leaves evenly over a blob. An even crown is the
"broccoli" failure, and no amount of leaf detail fixes it — the fix is gaps.

## Traps specific to this codebase

- **`KHR_materials_pbrSpecularGlossiness` is dead.** Four of the five models use it,
  and modern `GLTFLoader` ignores it — they render **flat white**. If an imported
  tree comes out white, this is why, and the fix is to read the base colour texture
  out of the GLB and wire a `MeshStandardMaterial` yourself, not to hunt for a
  loader flag. (Verified on these five: all rendered white in Three 0.170.)
- **We already have a foliage engine.** `src/engine/foliage/treeFoliage.ts` publishes
  `TreeFoliageState` — clusters with position, direction, normal, radius, density,
  keyed to branch samples and roles, capped by `maxClusters`/`maxLeaves`. Leaves are
  *already* clusters on branches, which is the `tree_gn` structure. Do not build a
  second one; change the published numbers.
- **The species is `src/engine/species/tree/`**, and it must not import Three or any
  asset. Card meshes, textures and materials belong in the renderer adapter, the
  same split the crystal holds to.
- **Budget is shared.** The portal environment publishes its own triangle count and
  the acceptance test subtracts it. A tree that grows the scene has to update
  `PORTAL_ENVIRONMENT_TRIANGLES` and say so.

## Wind

Only `tree_animate` has any, and it is a single baked animation clip. Ours should
not import that: the crystal's life frame (`sampleCrystalLife`) already establishes
the pattern — a pure function of elapsed time that freezes under reduced motion, with
the renderer applying it. Wind on cards is a vertex shader term keyed on card height
and a phase per cluster; a baked clip cannot respond to a couple's data and cannot be
frozen for accessibility.

**Do not move the whole tree.** ADR-0008 was written after exactly that mistake on the
crystal: a rooted artifact may turn and breathe, never translate or tip. A tree is
rooted in the same ground and answers to the same rule — the wind moves the canopy,
not the trunk.

## Asset pipeline, if a model is imported

Established on the platform and colonnade, and it holds here:

1. Extract the mesh from the GLB and embed it as base64 in a source module. A loader
   is asynchronous, and no part of the portal scene knows how to exist without its
   pieces.
2. Bake textures to 512² WebP. These five carry 8–24 MB each against an app that
   precaches ~9 MB in total.
3. **Greyscale anything that carries hue** — bark and leaves both. A leaf map in
   colour would paint every couple's tree the same green and erase what ADR-0004
   makes the artifact for. Grey modulates the earned colour instead.
