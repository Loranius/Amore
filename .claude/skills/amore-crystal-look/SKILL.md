---
name: amore-crystal-look
description: How to make Amore's crystal read as a crystal — the stylized-gem techniques reverse-engineered from reference assets, and the measurement workflow that tells you which one is actually failing. Use this whenever the owner says the crystal looks flat, plastic, machined, "not crystalline", like leather or fabric, or asks for more glass, reflection, glow or depth; whenever tuning anything in src/engine/material/, the crystal shader in src/engine/renderer/three/material.ts, or facet appearance in src/engine/geometry/planes.ts. Read it BEFORE changing a lighting or material number — the first three attempts at these complaints all changed the wrong number, and this skill says how to find the right one in about ten minutes.
---

# Amore Crystal Look

## The one rule

**Measure before you tune.** Every "the crystal looks flat" complaint so far has had a
cause that was invisible to inspection and obvious to a pixel scan, and in each case the
number a reasonable person would have reached for was not the number that mattered.

Recorded misses, all of them plausible and all of them wrong:

| Hypothesis | Result when tested |
|---|---|
| Emissive is washing the facets | 0.047 — negligible |
| The colonnade lamps flood it | zeroing both moved 6/255 |
| The core glow flattens it | −14/255, real but minor |
| Key light too weak | ×4 widened facet spread by **nothing** |
| Albedo too bright | halving it moved 6/255 |

The actual causes were a stale index formula, a tone-mapping shoulder, and a termination
angle derived from the wrong thing. None was findable by reading the material code.

## The measurement workflow

Render the live portal, crop the monarch, scan a horizontal band across it, and read the
luminance profile. A crystal that reads as a crystal has **adjacent facets differing by
30%+**; under ~10% it will look like a smooth shape no matter what else is right.

1. Start Vite on 5199. Log in headless with playwright-core and the Chromium at
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, flags
   `--enable-unsafe-swiftshader --use-angle=swiftshader-webgl`. Relay `*.supabase.co`
   through Node `fetch` with `NODE_USE_ENV_PROXY=1` via `page.route`.
   Wait for `[data-evolution-preview="ready"]`, then ~11 s for the life frame to settle.
2. Crop the monarch and average luminance down each pixel column over a band of rows.
   Print the profile. Facet steps show up as plateaus; the spread between plateaus is
   the number that matters.
3. To attribute brightness, **zero one term at a time and re-scan.** This is the whole
   technique. The difference in the profile is that term's contribution, and it is
   routinely nothing like what the code suggests.

**Undo the tone curve before concluding anything.** Output 161..186 of 255 looks like a
9% spread; in linear scene radiance those samples are 0.36..1.6 — a range of more than
four to one, compressed away because the body sits on the shoulder of the ACES curve.
A tone-mapped screenshot is not a measurement of light.

## What the reference assets actually do

Three stylized gems the owner supplied (`stylizedgem`, `glowinggem`, a handpainted
`crystal_gem_pack`). Their shared technique, in one sentence: **the crystal is painted,
not lit.**

- The handpainted pack uses `KHR_materials_unlit` — **no lighting model at all**.
  Every bit of its look is in base colour.
- The stylized gem outlines **every facet rim in all three channels at once**: bright in
  albedo, rougher in roughness, brighter in emissive. Interiors are dark and flat.
- Adjacent facets differ enormously — deep maroon beside bright pink. That is painted
  contrast, far past what any light rig produces.
- Emissive carries a **large-scale hue gradient across the body**, not one flat colour.
- The glowing gem's emissive is flat cyan and its opacity is a flat 0.66: the glow is a
  uniform colour, and all the structure lives in albedo.

This agrees with the measurement from the opposite direction: switching the key light off
entirely moves the monarch's facets by about 3%. Lighting was never going to separate
them. Anything that must survive is a property of the surface.

## What we implemented from it, and how

**Facet rims, procedurally.** We can never use their method directly — they have a UV
atlas per gem, and our faces are a different shape on every couple. The equivalent without
an atlas is barycentric edge distance:

- `CrystalMeshData.borderEdges` — one bitmask per triangle, bit `k` set when the edge
  opposite corner `k` is a real facet edge rather than an internal cut of the fan.
  Only the pass that builds the fan knows this.
- The renderer expands it to a `evolutionEdge` vec3 attribute: each corner gets 1 in its
  own slot, **except** slots whose edge is suppressed, which get 1 everywhere so they
  never approach zero.
- The shader takes `min` of the three and lights the rim.

Two traps, both hit:

1. **Floor the derivative.** A suppressed edge carries 1 at all three corners, so its
   `fwidth` is exactly zero and `smoothstep(0, 0, x)` divides by it. The resulting NaN
   does not stay local — `min()` carries it across the whole facet and the body renders
   as speckled noise. `max(fwidth(...) * width, vec3(1e-5))`.
2. **Requires split geometry.** A triangle must own its three vertices or it cannot carry
   its own barycentric slot. `splitCrystalMeshFaces` guarantees this; check the vertex
   count is exactly three times the triangle count and bail out rather than write a wrong
   attribute.

Measure the rim in **screen space**, not object space, or a year crystal becomes more
outline than crystal.

## Traps specific to this codebase

- **`repeat` lives on a Three texture, not on a material.** One shared texture instance
  gives every body whichever density was written last. Clone per density; `clone()` keeps
  `source`, so the pixels upload once.
- **The life frame rewrites `emissiveIntensity` every frame** from
  `userData.evolutionBaseEmissiveIntensity`. Anything that raises emissive at build time
  must publish the raised value there or it vanishes on the first frame.
- **Any index formula of the form `floor(triangle / 2)` is stale.** It encodes the
  pre-ADR-0006 lathe. Polytope faces fan into a different triangle count each, and
  slivers are dropped. Publish the mapping from the pass that builds it.
- **Transmission is permanently 0** — Three samples a render target the CSS sky is not
  in. Alpha composites correctly; refraction is not available. Don't re-litigate it.
- **Environment maps are off by decision**, not omission (`render/envMap.ts`): every
  route to one goes through a HalfFloat render target, the standing suspect for the white
  background on the owner's device. Reflection must be computed — Fresnel rim plus a
  sky/ground term — so those few ALU operations are the entire reflection budget and
  should not be rationed by quality tier.
- **A constant added to every facet is not a reflection**, whatever it is named. The sky
  term carried a `0.25 +` floor that lifted every face alike and cost facet separation.
  Reflection belongs at the silhouette.

## Geometry facts worth keeping

- The termination angle is **lattice, not proportion**. Quartz fixes the prism-to-
  rhombohedral angle near 141.8°, so crown faces sit near 52° from horizontal whatever the
  prism's length. Deriving it from the body's aspect ratio gave a tall monarch crown
  normals only 12–16° above horizontal — indistinguishable from the prism faces below.
  A point that sharpens as the body grows is a spire; spires are carved, not grown.
- Azimuth jitter trades width inequality against orientation. Two faces 22° apart are two
  faces catching the same light. Width inequality is better bought from the plane
  *offsets*, which move a face without changing where it points.

## Owner's standing constraints

- Faces stay **flat**. "Do not make the surfaces curved or noisy. Make the flat surfaces
  unequal." Never reach for noise or displacement to fix flatness.
- The colour is **earned** (ADR-0004). A texture map that carries its own hue must be
  greyscaled so it modulates rather than replaces; only value may be capped, and all three
  channels must scale by one factor so hue and saturation survive.
- Horizontal banding across the prism was rejected on sight. Growth striations are real
  quartz, and at portal size they read as stripes ruled onto the crystal.
- Do not commit or push without an explicit instruction.
