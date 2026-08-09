# Crystal Naturalization — Pass 2: the termination

Pass 1 measured the crystal and proposed reordering the owner's brief, putting
**termination first** because one clamp was flattening seven faces into a 4°
band and the tip is what reads as "designed". This is that pass, plus the
owner's separate instruction to stop the crystal turning by itself.

The owner's direction was explicit: use the brief as a basis, take only what
genuinely improves the crystal, do not follow it step by step. So this pass does
not do the brief's §14–§18 in order; it does the one thing Pass 1 measured as
the largest return, and stops.

Decision record: `docs/05_ADR/ADR-0009-still-artifact-and-lattice-termination.md`.

---

## 1. What was wrong, measured

The crown angle was derived from each body's aspect ratio and then clamped into
a 42–54° band. Across every body of three couples:

```
faceDeg histogram   54: 222   42: 39   everything else: 52
raw aspect angle    37.8 .. 76.2
monarch             7 of 7 planes on the ceiling, every couple, every age
```

**261 of 313 crown planes landed exactly on a bound.** The crystal already had
one fixed crown angle. It had it by accident, through a clamp, behind code that
said the angle followed the body — and `CROWN_SHOULDER_SPREAD`, the seeded
variation meant to make the faces unequal, was consumed by the clamp and had no
effect at all.

The result on screen was Pass 1's finding: seven crown faces inside a 4° band,
near-equal, a roof.

---

## 2. What replaced it

**One number, and it is the mineral's.** The prism-to-rhombohedral interfacial
angle in quartz is 141°47′, so a rhombohedral face lies at 51.78° from
horizontal — on a stubby crystal and a tall one alike. The aspect derivation is
gone, not clamped.

**The variation moved to where quartz actually keeps it: size.** A termination
carries two rhombohedra, r and z, alternating around the crystal at the *same*
angle. z grows faster, travels further from the centre, and gets eaten by its
neighbours, so z faces come out markedly smaller — and often close up entirely,
which is why so much quartz reads three-sided at the tip and six-sided at the
waist. So alternate crown planes now stand back from the apex instead of every
plane meeting at it.

**The retreat is a proportion, not a distance.** The distance at which a minor
face closes varies about thirtyfold across one crystal, because it depends on
the azimuth gaps to its neighbours:

```
δ* = drop · sin(pitch) · (1 − cos gap) / cos gap
      regular hexagon (gap 30°)   0.12 · radius
      the 17° gap this family also produces   0.008 · radius
```

Quoted in radii, a retreat closes some faces outright and does not touch others
— measured, and it did: one surviving face came out at 1/368th the area of its
neighbour, which is a sliver, not a facet (§36). Quoted as a share of δ* it
behaves the same everywhere.

---

## 3. Result

Monarch, high LOD, as a fraction of the body's own width:

| | before | after |
|---|---|---|
| smallest crown facet | 0.354 | 0.070 |
| median crown facet | 0.419 | 0.149 |
| major : minor mean area | — | 1 : 0.358 |
| facets below 0.05 width | 0 | 0 |

Before, every crown facet was within 20% of every other — that is the roof.
After, there are two clearly separate sizes and no sliver.

Across 258 crown facets on forty seeds: floor 0.0149, 5th percentile 0.141,
median 0.60, two facets below 0.05. The floor is what the regression test
guards; the radius-quoted retreat took it to 0.003.

**The cost, stated plainly.** On child crystals — a sixth the monarch's size and
a few pixels wide on the portal — facets under 0.05 of body width went from 6 to
29 out of ~1650. That is below what the screen can resolve on those bodies, and
the sliver test measures the monarch, which is the body that reads.

**What did not change.** Body count, mesh count, draw calls, the growth
coherence Pass 1 verified (same seed, same azimuths, year four still *adds* one
bevel without relaying out the rest), and every prism-face property. The
termination is 8% shorter because a 51.78° face drops less than a 54° one, so
the shoulder sits about 8% higher — two silhouette ceilings moved with the
arithmetic written down beside them.

---

## 4. The self-rotation

Separate instruction, same theme. The artifact turned about its own axis at
0.075 rad/s. ADR-0008 had kept it and argued the platform's rotational symmetry
made it safe, which is true and still is — but it never addressed what the turn
does to the viewer: the couple drags the crystal to a face they want and the
crystal carries that face away again. A crystal in stone also does not revolve.

`CrystalLifeState.rotationSpeed` and `CrystalLifeFrame.rotationY` are removed
from the published contract, and `applyCrystalLifeFrame` no longer touches
`group.rotation` at all. The only rotation left in the portal is the camera's,
under the viewer's finger.

Verified on the live portal: over nine samples across twelve idle seconds, the
shaft's left and right silhouette edges move at most one pixel — that one pixel
being the breathing scale, which stays. The old spin would have carried them
through roughly 51° of turn in the same window.

---

## 5. What Pass 3 should be

Unchanged from Pass 1's ordering, minus the item just done:

1. **Facet competition** — a second tilt term per prism plane, so a face's width
   can grow *and* shrink over height and the boundaries between faces shift.
   This is what turns long vertical strips into faces that compete, and it is
   the change most likely to disturb growth coherence, so the year-2..6 azimuth
   check has to run as a test.
2. **Cluster ecology** — fourteen bodies at one radius, one height, one tilt
   band, all `role=focal`. Cheap to vary, deterministic, and it fixes the
   "positioned around" read.
3. **Growth bands** — the only item on the list that adds evidence of history.
   The tree's geometric striation and its measured resolvability floor apply
   here directly.
