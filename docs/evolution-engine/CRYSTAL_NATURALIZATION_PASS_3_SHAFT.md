# Crystal Naturalization — Pass 3: the shaft

Pass 1 called this the strongest of its findings and Pass 2 left it at the top
of the queue: the crystal's prism faces run from the base to the shoulder as
single unbroken strips. This pass breaks them.

Decision record: `docs/05_ADR/ADR-0010-shaft-interrupted-by-shoulder-cuts.md`.

---

## 1. The finding, as a number

```
88 of 88 prism faces (12 seeds) changed width monotonically over the shaft
median change across the whole height: 3.0° of arc
```

Not one face on one crystal widened and then narrowed. And it could not have:
a face's width is set by where its neighbours cut it, each neighbour is one
plane carrying one fixed tilt, so relative widths can only drift one way. **The
same face dominates from bottom to top, always.**

That single fact is both of Pass 1's confirmed shaft findings — "extremely long
uninterrupted vertical facets" and "insufficient variation lower/middle/upper".
They are the same defect seen twice.

---

## 2. Why the obvious fixes do not work

**A second tilt term on the prism plane.** A plane has one tilt by definition.
There is nowhere to put the term.

**A plane that follows the flare** — which is what the earned bevels already are
— cuts by the same amount at every height. It changes the shape and not the
monotonicity.

**A vertical plane pinned to the face.** Tried and measured. It should work in
principle: the face flares outward with height, so a vertical plane pinned at
one height is outside below it and inside above. But the flare is
`PRISM_FLARE` — 0.05 to 0.2 of the radius over the *entire* body — so above a
pin at three-quarters height there is about 0.015 of a radius left for the plane
to take. It took exactly that: a facet 5.6° wide at the top sample, 0° below it,
reversing the trend of 7 of 113 neighbours. A sliver, not a break.

---

## 3. What works: a plane that leans in

The cut sits at a prism face's own azimuth and tilts *inward* as it rises, so it
crosses its host exactly once. Below the crossing it stands outside the body and
owns no arc at all; above it, it takes the face and keeps taking more.

The strip becomes two storeys with a hard edge across it. The upper storey
narrows, the neighbours take the room, and their widths rise and then fall.

Two numbers decide how it lands, and both were measured rather than chosen:

- **Pin height 0.55–0.78.** Lower and the cut takes the corner away from the
  part of the shaft that is meant to be widest, and the body's broadest slice
  slides to mid-shaft. Measured: 0.657–0.950 of the height at these values, 0.44
  at four times the convergence — a crystal that necks before its point.
- **Convergence 0.02–0.055 of the radius** by the time it reaches the shoulder.
  Small on purpose. What makes the break read is not the silhouette — two to
  five percent of the radius is about a pixel at portal size — but the shading:
  the host leans out 3–11° from vertical, the upper storey leans in 4–10°, so
  the two catch the key light differently across a hard edge.

Its azimuth is offset from its host's by up to 0.12 of a facet step, so the
break is a real edge with two normals rather than a fold in one plane.

Dropped entirely at low LOD, where the break is under a pixel and the plane
still costs a face.

---

## 4. Result

Forty seeds:

| | before | after |
|---|---|---|
| prism faces with non-monotone width | 0 of 88 | 47 of 261 |
| median width change over height | 3.0° | 8.3° |
| bodies with at least one interrupted face | 0 | 40 of 40 |
| widest slice, share of height | 0.68–0.96 | 0.657–0.950 |
| polytope faces | 16–19 | 15–19 |

Verified on the live portal: the shaft now carries a facet that starts partway
up and runs to the shoulder, where before it was a set of bands with dead
straight edges from base to tip.

**The crown got better, not worse.** A shoulder cut narrows the shaft *locally*,
under one face — and Pass 2 sized the termination's drop off the body's global
narrowest prism face. That was enough until now; with the cuts in, the smallest
crown facet fell from 0.0149 of the body's width to 0.0071 and the slivers came
back. The drop is now asked of the shaft directly, under each crown face's own
azimuth. Floor: 0.0362, better than before this pass started.

**Unchanged:** body count, mesh count, draw calls, the earned-facet economy of
ADR-0004 (the cut is seeded detail, not a counted contribution), and growth
coherence.

---

## 5. What Pass 4 should be

> Done — see `CRYSTAL_NATURALIZATION_PASS_4_COLONY.md` and ADR-0011. Two of the
> three items turned out to be mechanisms that already existed and did nothing.

1. **Cluster ecology.** Fourteen bodies at one radius, one height, one tilt
   band, every one of them `role=focal`. There is no hierarchy at all. Cheap to
   vary, deterministic, and it fixes the "positioned around" read — which is now
   the largest remaining item on Pass 1's confirmed list.
2. **Growth bands.** The only item that adds evidence of history. The tree's
   geometric striation and its measured resolvability floor apply directly.
3. **Internal structure / material.** Last, deliberately: the shell is opaque by
   contract, so "internal zoning" has to be depth-weighted core light rather
   than real transmission.
