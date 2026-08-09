# Crystal Naturalization — Pass 7: the stage

Six passes deferred lighting and viewport calibration on the grounds that each
would be a response to whatever the geometry and material turned out to be. This
is that pass. It found one thing about the lighting, one dead light, and — off
to the side of what it was looking for — a defect that made the portal
unusable on desktop.

---

## 1. The lights, ablated

Each light zeroed in turn, live portal, measured on the monarch's shaft and on
the temple floor away from it:

| light | intensity | shaft mean Δ | facet contrast Δ | stage mean Δ |
|---|---|---|---|---|
| key (directional) | 1.42 | 7.55 | **+3.74** | 10.89 |
| back (directional) | 0.26 | −0.02 | 0.04 | 1.35 |
| point | 0.16 | −0.01 | 0.04 | **0.02** |
| ambient | 0.10 | 2.02 | −1.31 | 0.92 |
| hemisphere | 0.24 | 1.50 | −0.89 | 0.97 |

**The key light earns its place.** A sweep from 1.42 down to 0 moves facet
contrast 22.14 → 18.40 and stage brightness 41.2 → 30.1: it buys a fifth of the
crystal's facet separation and a quarter of the temple's light for 4% of the
shaft's brightness. Nothing here needs changing.

**A correction, because the first reading said the opposite.** The initial
statistic for facet separation was the mean of the four largest adjacent-pixel
deltas along a scan row, and it reported that switching the key light *off*
raised separation from 26.6 to 32.3 — that the key light was flattening the
crystal. It is a fragile measure: it depends on exactly which pixel lands on an
edge, and across a monotone sweep it came out non-monotone (26.4, 33.2, 29.0,
30.2, 31.8, 32.5) while every other number in the same runs was clean.
Re-measured as the spread of per-facet mean brightness — segment the row at its
largest steps, take the standard deviation of the segment means — the sweep is
monotone and the conclusion reverses.

**The point light is not weak, it is absent.** 0.02 of 255 on the stage and 0.01
on the crystal, both below the quantisation step. The cause is arithmetic: a
Three.js point light decays with the square of distance, and this one sat about
four units from the podium, so 0.16 of intensity arrives as a hundredth.
Removed.

---

## 2. The desktop portal had no navigation

Looking for viewport problems rather than lighting ones, at 1280×800:

```
.sidebar-nav        [12, 73, 215, 596]   13 links
elementFromPoint at its centre  →  canvas
```

The sidebar was laid out, styled, visible by every computed property — and
painted over by the crystal's canvas, which also took all of its clicks. The
scene draws itself as `position: fixed` layers with their own `z-index`, and a
positioned element paints above a non-positioned one whatever their order in the
flow; the sidebar was `position: static` with `z-index: auto`.

The phone's bottom navigation never had the bug because it was already
`position: fixed; z-index: 50`, which is also the proof that 50 is enough — it
stands over the same canvas.

Fixed by giving the sidebar the same stacking treatment. Verified the same way
it was found: `elementFromPoint` at the sidebar's centre now returns
`a.sidebar-item`, on the home route and on an ordinary page alike, in both
themes.

A regression test reads the stylesheet rather than a rendered page, and says so:
the defect is a missing declaration, and jsdom resolves neither media queries nor
stacking. It fails on the unfixed CSS — checked by stashing the fix and watching
it go red.

---

## 3. What this pass is really about

Three of the last six passes found a mechanism that existed and did nothing; two
found a number that saturated its own range. This one found a light contributing
a hundredth of a quantisation step and a navigation bar behind a canvas.

The common thread is not carelessness in any of these — every one of them was
correct when written, and each was broken by something that moved somewhere
else. What catches them is the same procedure every time: **measure the output,
not the code path, and attribute the measurement by turning the suspect off.**

Worth recording as the practice, because it is the one thing from this whole
sequence that generalises beyond the crystal.

---

## 4. What is left

**A regression run** — done, see `CRYSTAL_NATURALIZATION_PASS_8_REGRESSION.md`.
A 194-case engine matrix that runs in CI, validated by reintroducing the Pass 4
bug and watching 25 cases go red; and a live sweep of thirteen routes at three
viewports, which found `/map` down at every one of them because the token guard
used `??` against an empty string. This pass covered
two themes and three viewports on one couple; the sweep should cover the range
of histories the six growth dependencies produce.

**A separate plane builder for the children**, the one remaining item on Pass 1's
confirmed list that is real work rather than a property of the architecture.
