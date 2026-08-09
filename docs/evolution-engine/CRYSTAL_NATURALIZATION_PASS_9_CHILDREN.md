# Crystal Naturalization — Pass 9: the children

The last item on Pass 1's list that was real work rather than a property of the
architecture: *"secondary crystals share too much of the same shape language."*

Decision record: `docs/05_ADR/ADR-0014-juvenile-habit.md`.

---

## 1. Three wrong measurements before the right one

This pass measured the wrong thing three times, and it is worth recording
because all three traps are the same trap: a plausible number that is describing
something other than what it is named after.

1. **Aspect from an axis-aligned bounding box.** The children lean 30–58°, so
   the box describes the tilt, not the shape. They came out at 0.90 — as wide as
   they are tall, a pebble.
2. **Width projected from the world origin** rather than from the body's own
   anchor, so a child standing 0.2 out from the druse's axis measured 0.2 wider
   than it is. Aspect near 0.9 again, this time for a different reason.
3. **Faces classified by world Y.** A leaning body's prism faces have world
   normals tilted by as much as the lean, so they landed in the crown bucket:
   the crown came out at 2.4× the prism area, which is arithmetically impossible
   for a body four radii long.

Every one of the three produced a number that looked like an answer.

---

## 2. What the fourth measurement said

In each body's own frame, anchored on its own anchor, classified against its own
axis:

| | monarch | child |
|---|---|---|
| prism faces | 11 | 11 |
| crown faces | 7 | 5 |
| crown area / prism area | 0.10 | 0.11 |
| aspect | 4.01 | 3.15 |
| prism area spread (max/min) | 8.06 | **402** |
| thinnest prism face, share of body width | 0.52 | **0.074** |

**Pass 1 was right and precise.** A child is a scaled monarch: the same face
counts, the same crown share. The archetype's anisotropy was the only thing
separating them — `tabular` flattens to 0.59 against `prismatic`'s 0.93 — and
flattening is not a habit.

And the shaft carried the sliver the crown had already been guarded against
twice.

---

## 3. The habit is mineralogy, not a size setting

A crystal that grew **fast** develops **fewer forms** and **more equal faces**:
supply is not the limit, so every prism face advances at the same rate and the
minor forms never get time to appear. A crystal that grew **slowly for years**
develops the subsidiary forms and the strongly unequal faces that come from
competing for room.

So a juvenile carries:

- **no shoulder cut** — a form of a mature termination, and the largest single
  difference between the two silhouettes: the monarch's shaft is interrupted and
  steps back, a child's runs clean;
- **no dominant face** — nothing had time to win;
- a **narrower band of prism offsets**, 0.90–1.02 against 0.86–1.06;
- **half the azimuth jitter**;
- a **minor rhombohedron retreated past closing**, so the z faces are absent
  rather than small: three broad termination faces against the monarch's six
  alternating ones.

---

## 4. Two traps, both caught by the regression sweep

**The minor faces were first set to 0.72 of their closing distance.** That leaves
28% of a face's linear size, and 28% of small on a tiny body is a sliver — the
sweep put a facet at 0.0011 of its body's width on a 25-year `sparse` couple.
This is exactly the trap ADR-0009 documented, walked straight back into one pass
later. The fix is the one that comment already implied: past closing, so the
form is *absent*.

**The prism band was first narrowed to 0.94–0.98.** At that width the prism
planes stand at so nearly the same distance that their shoulder corners land at
nearly the same height, and the crown planes clip those corners into degenerate
triangles.

That second one was **bisected against the pass's other two changes** rather than
guessed at: reverting the band alone cleared all twenty-five failing cases, while
reverting either of the others made it worse. 0.92–1.00 still fails; 0.90–1.02 is
clear with margin.

The sweep from Pass 8 earned its keep twice in one pass, on its first outing.

---

## 5. Result

| | monarch | child before | child after |
|---|---|---|---|
| prism faces | 11 | 11 | **8** |
| crown faces | 7 | 5 | **4** |
| prism area spread | 8.06 | 402 | **19** |
| thinnest prism face / width | 0.52 | 0.074 | **0.41** |

On the portal the children now read as a different habit outright: blunt,
chisel-like tips of a few broad faces above clean even shafts, against the
monarch's stepped six-faceted point.

Body count, mesh count and draw calls are unchanged.

---

## 6. Pass 1's list, finally

| Finding | Status |
|---|---|
| Termination planes feel designed | fixed — Pass 2 |
| Extremely long uninterrupted vertical facets | fixed — Pass 3 |
| Insufficient variation lower/middle/upper | fixed — Pass 3 |
| Placement feels positioned, not grown | fixed — Pass 4 |
| No evidence of growth history | fixed — Pass 5 |
| Material reads as pastel glass | fixed — Pass 6 |
| Secondaries share the same shape language | fixed — this pass |
| Overly consistent prism cross-section | architecture: one plane per face can only drift one way |
| Silhouette too predictable while rotating | architecture: a convex body is 180° symmetric by definition |

Seven of nine fixed. The two that remain are consequences of the crystal being a
convex intersection of half-spaces (ADR-0006), and changing either means
changing what the crystal *is* — which is an ADR, not a pass.
