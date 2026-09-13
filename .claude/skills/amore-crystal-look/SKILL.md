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

**Read the lab's `найслабша пара`** (ADR-0174). One command does the whole
measurement and cannot quietly measure the wrong thing:

```bash
node scripts/lab/artifact.mjs --years=11 --theme=light --quality=high [--off=<term>]
```

It masks the body out of the frame, puts the band on the monarch's shaft by
itself, cuts the shaft into facets at their **edges**, and prints the step
between each neighbouring pair. The verdict takes the **weakest** pair, because
one pair that coincides reads as one large plane however good the median is.

Three earlier readings of this number were wrong, and all three were the
instrument rather than the crystal:

- **`median` between plateaus** measured how smooth one facet is, not how
  different two are — one facet is not one plateau (ADR-0122).
- **`boundaryMedian`** fixed that but was still read off a band that missed the
  crystal: the default band sat below the shaft, on the geode's rubble, and
  a column averaged sky and moss together with stone. Of twenty-three plateaus
  in that band, two belonged to the crystal, and the "18%" every ablation was
  compared against was the island (ADR-0174).
- **`findPlateaus` cannot see a facet at all.** A facet has a ~20% gradient of
  its own (ADR-0085) and carries sparks — one column 17–32% brighter than its
  neighbours. It reported *zero* plateaus on a shaft where the eye sees six
  facets separated by 33–43%.

Two limits of the present instrument, both named rather than hidden:

- The body is found by **hue** (285–345°, pink). The colour is earned
  (ADR-0151), so `--gifts=shared` moves it out of that window and the tool
  **stops with a message** instead of measuring the island. `--hue=from-to`
  moves the window.
- Two facets closer than **20%** merge into one. That is the edge threshold, and
  it is above a facet's own internal gradient by necessity. The loss is visible
  in the *facet count*: a shaft showing two facets instead of six is the flat
  crystal, whatever the steps between them say.

If you need the raw frames rather than the verdict:

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

## A white rim on a saturated stone reads as a moulding seam

Darkening the interior (above) created a defect of its own, and it took a second
measurement to see it. The facet rim was drawn in the shared `rimColor` — light
pink, saturation 0.14. While the body itself sat at 0.23 saturation nobody could
tell; once the faces reached 0.43 the rim read as a white thread laid over the
stone (ADR-0177).

| | hue | saturation | value |
|---|---|---|---|
| faces | 314° | 0.43 | 0.68 |
| rim (before) | 318° | **0.15** | 0.84 |

The reference gems outline a facet **in the stone's own colour, brighter** — not
in another material. `facetEdgeColor` is now `mix(baseColor, white, 0.3)`: hue
untouched, value lifted. At 0.5 the saturation falls back to 0.22 and the white
thread returns; 0.3 holds it near 0.39.

It is a separate field from `rimColor` on purpose — that colour also drives the
Fresnel and glass terms, which draw the **silhouette**, and a silhouette has to
separate the body from the sky by brightness. Different job, different evidence.

Side effect worth knowing: facet separation rose from 46% to 52% on its own. A
near-white rim adds the same light to both neighbouring faces and so pulls them
together.

## Measure every belt, not only the shaft

The shaft is not the crystal. On the same frame that gave the shaft six facets
separated by 33–43%, the **crown was a single flat surface** — one facet across
39 columns, 0.21–0.23, no step at all (ADR-0176). The lab takes `--band=`, so
scan the termination and the daughters too before concluding anything.

What was wrong there is worth keeping, because it is not a bug in the key but a
blind spot in the *set*:

- Tone is handed out by a facet's **rank** around its belt, and the four-tone
  set alternated light/dark. Steps between *neighbours* were excellent — 41%,
  103%, 44%, 49% — and that is all ADR-0120 measured.
- But a four-cycle has a second distance: pairs **two apart**, (0,2) and (1,3).
  Under alternation those are two lights against two darks: 1.16 vs 1.38 is
  16%, 0.68 vs 0.78 is 13%.
- **The eye sees exactly that pair wherever every second facet is a sliver.**
  The monarch's crown has ten faces alternating big and narrow (6–8 triangles
  against 1–3), so the visible ones are ranks 1, 3, 5, 7, 9.
- The `paintProbe` ablation cannot see this: with two tints every odd rank takes
  the same one, so the probe reports the crown flat whatever the real set does.

The fix is three tones, not a different order of four: on a 3-cycle the pairs
two apart *are* the neighbouring pairs, so no stride of the eye can land on a
coincidence. Four values pairwise 30% apart need a ratio of 2.92 and the earned
colour's corridor (0.66…1.5) gives 2.27 — they do not fit.

Result: shaft weakest pair 33% → 46%, crown 1 facet → 2 facets 21% apart. The
crown stays under the threshold because its faces share a tilt and so catch
almost the same light; the shaft's grazing angles amplify the same 30% of paint
to 46–63%. That remainder is geometry, not paint.

## The crystal had no dark side

2026-09-09, the owner: *«візуал ще дуже сирий»*. Every facet number was healthy
— the shaft's weakest neighbouring pair measured 33% and its median 40%, above
the threshold on this page. The separation was never the problem.

**Measure the level and the saturation, not only the step between facets.** In
HSV, off the same band:

| | before | after |
|---|---|---|
| value | 0.75–0.93 | 0.58–0.84 |
| saturation | 0.23–0.38 | 0.30–0.46 |

Every face sat between 75% and 93% brightness — the body had no dark side at
all, and at that height on the ACES shoulder the couple's earned hue washes
toward white. That is what "raw" was: not flat facets, a flat *level*.

Two things had to move together, and either one alone is worse than doing
nothing:

- `interiorLevel` (0.55) multiplies the outgoing colour, and because it is one
  factor over the whole body it leaves every facet ratio exactly where it was —
  the weakest pair went 33% → 33%.
- **The rim is added after it.** A rim multiplied down along with the interior
  gives a uniformly darker crystal, which reads as a silhouette. Dark interior
  plus bright rim is the reference gems' entire construction.

And the level does *not* belong in the tint set, however tempting: scaling
`CRYSTAL_FACET_TINTS` by 0.55 produces the same picture and breaks the rule the
tints exist under — they must vary around the earned colour, not shift it.
`facets.test.ts` catches that on the first run, and it is right to.

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

## The base: what a crystal grows out of

Four more references (`low_poly_dirt_crystals`, `stalagmite ore cluster`,
`iridescent gems`, a second `stylizedgem`) answer this directly, and they all answer
it the same way.

**A cluster erupts from a heap of broken rock — never from a plate, a disc or a groove.**
The ore-cluster reference is the clearest: irregular faceted boulders of many sizes
packed into a mound, crystals rising from the gaps between them, small crystals nestled
among the stones at the foot, and the glow coming *up between the rocks* rather than out
of a channel. A smooth continuous surface under a crystal reads as a plinth however it
is shaped — that is what a plinth is — and no amount of shaping the seam fixed it.

How ours is built now:

- Boulders are the **same half-space intersection the crystals use** (ADR-0006). A
  boulder is a faceted convex solid and we already have an exact deterministic way to
  make one; they differ only in that their planes point anywhere rather than holding a
  hexagonal habit. Do not reach for a noised sphere: rock breaks along flat faces, and
  flat faces are what catch light differently from one another.
- They are **heaped on the seam, not instead of it**. The seam still carries ADR-0003 —
  it is the thing wide and deep enough that no base cap is exposed from below — and rock
  piled on a guarantee does not weaken it.
- `CrystalBodyProfile.seamTriangleCount` marks where the seam ends and the rubble
  begins. In **triangles**, not vertices: the mesh is split before it is drawn and the
  split gives every triangle its own copies, so vertex indices do not survive it.
  Every seam invariant must be scoped by it, or the mesh's highest point is a rock and
  the seam looks like it violated its own lip rule.
- **Trim boulders to the gap; do not reject them for being in one.** Rejecting on
  proximity threw away five in six and left two rocks on a bare seam. It is also the
  wrong shape of rule: a small stone against a crystal's foot is exactly what the
  reference shows, a large one there is the violation. Let the gap set the size, and
  state the guarantee over the size — every vertex outside the crystal's own radius.

## Transparency: not needed

**All four references are opaque.** No alpha, no `KHR_materials_transmission`, nothing.
They read as crystal better than ours did while see-through, and what carries them is the
facets — their rims, and how differently each catches light. Ours is now effectively
closed, with only a trace left so the earned light can get out.

While the shell was open the far facets showed through the near ones and the two sets of
edges cancelled into a wireframe. If someone proposes re-opening it, that is the thing to
look for first.

## Growth variants worth having

The iridescent set is a catalogue: single terminated point, **double-terminated** (points
at both ends, grown suspended rather than from a wall), short stubby prism lying down,
blocky tabular chunk, and a **fan cluster** — many small crystals of varying length
radiating from one base. Each also carries a **vertical colour gradient**, one hue at the
foot and another at the tip. We have the single point, the fan and the
gradient; the tabular and double-terminated habits are still open.

## Two things that turned out to be the same mistake

**Surface maps do not belong on a grown face, and transparency does not belong on
a crystal.** Both were added in good faith, both measured as costing more than they
gave, and both failed for the same underlying reason: they crossed the facet.

- A cellular albedo wrapped over the outside reads as hide at portal size, and —
  worse — the pattern runs *across* facet edges, which tells the eye the two planes
  either side are one surface. That is precisely the opposite of what the painted rim
  exists to say. Removing it raised the foot-to-tip contrast from 24 to 30 and the
  facet spread from 104 to 124.
- Transparency let the far facets show through the near ones, so two sets of edges
  crossed and cancelled into a wireframe.

What the map was for is still there, moved inside the stone: `veilStrength` is a 3D
field, so it clouds the body and **cannot cross a facet edge**. That is the test to
apply to any future surface idea — if it crosses an edge, it will flatten the crystal
no matter how good it looks on a flat sample.

Broken rock is the opposite case and keeps its map: it has no grown faces to keep
clean, and grain is most of what separates stone from plastic.

## The crystal was right and still looked wrong: measure the cluster, not the body

2026-09-07, the owner: *«просто стовп рожевого кольору, який стирчить із землі»*.
Every existing measurement said the monarch was correct — `crystalProfileDistance`
to the Blender reference was **0.036** against a ratchet of 0.05. It was not a
defect in the build. It was a faithful reproduction of a reference nobody wanted
any more: a single quartz prism at 3.2:1 with a short termination **is** a column.

**When every single-body number agrees and the frame still looks wrong, the thing
you have not measured is the arrangement.** `crystalClusterProfile` (in
`engine/species/crystal/crystalProfile.ts`) answers it:

- `secondShare` — the runner-up's height over the leader's. **This is the number
  that separates a cluster from a monolith with pebbles.** Reference 0.552, ours
  was 0.271.
- `sizeSpread` — are the satellites all one size? A prism repeated fifteen times
  is one crystal, not a cluster.
- `leanMeanDeg`, `reachMean` — does the druse fan, and how far out does it sit.

It takes **one triangle soup and finds the bodies itself** by shared vertices,
because the reference arrives as one mesh and our scene as many. Two different
splits would give two numbers you cannot put side by side — the same mistake this
project has already paid for twice.

The median told the real story: ours was 0.244 against the reference's 0.270 —
**the small crystals were already right**. What was missing was a rival.

Two changes that only work together, and knowing why matters more than the
numbers:

- monarch nominal aspect 5–5.85 → 3.72–4.35 (measured silhouette 3.383 → 2.505);
- tallest child's share of the monarch 0.4 → 0.5.

The child share had been *lowered* to 0.4 a month earlier because half read as
"almost the same crystal". That was true **beside a slim monarch**. A stout
monarch outweighs a tall child by volume, so the same child reads as a member of
a cluster. Neither change alone gives what the owner asked for, and reverting
either one alone will bring the column back.

Two things this cost, both measured rather than discovered later:

- the apex cut is a *fraction of the radius*, so a body a third wider pays a
  third more tax: the 30→40-year height drift went 0.154% → 0.208%;
- a wider colony makes the camera back off. At a child share of 0.55 the
  fourteen-year crystal filled *less* of the screen than the ten-year one —
  `portalCameraAge` caught it. 0.50 is the value that passes, and that is why it
  is 0.50 and not the reference's 0.552.

## Colour from three sources without mud or citrine

The owner's rule: her wishes granted by him → red, his by her → blue, shared →
green, and it moves the **whole** tone. Three ways to do that, two of them wrong,
and both wrong ones look obviously right until measured:

- **Average the colours in RGB.** Red, green and blue in equal parts are *grey*.
  A couple who give evenly got a stone with no colour at all (`#bba9aa` at 2/2/8).
- **Circular mean of the hues.** Never grey — at balance the mean vector has zero
  length, so there is nothing to pull toward. But the mean of red and green is
  **yellow**, and 3/0/5 turned the crystal yellow. Yellow quartz is citrine; §6 of
  the brief forbids it in its own line.
- **What works: the largest channel pulls, and the strength is its lead over the
  runner-up.** The target is always exactly one of the three named colours, so
  neither grey nor yellow is reachable by construction. It is continuous where the
  leader changes, because at a tie the lead is zero and the colour is the couple's
  own.

Two more things that only the frame could decide:

- **A pull of 0.8 was not enough.** The all-red crystal still read as "a slightly
  different pink" — the very pink the owner complained about. At 1.0 a one-sided
  history reaches the colour itself (`#ff5656`), and identity survives because
  reaching it requires *every* wish in one channel.
- **The road to green runs through blue.** The couple's family sits at 270°–340°,
  nearly opposite green. A couple whose shared wishes merely lead sees a *blue*
  stone. That is the hue circle, not a bug; the alternatives are grey and yellow.
  Red is unwrapped to 360° rather than 0° precisely so no arc crosses the yellow
  quadrant.

**The lab cannot show any of this by default.** The sandbox makes every wish
shared and anonymous, so a screenshot shows one state out of four — the one with
no colour. `crystalLab` takes `?gifts=hers|his|shared|mix` and `scripts/lab` takes
`--gifts=`; use them or you are looking at a frame that cannot disagree with you.
