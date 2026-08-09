# Crystal Naturalization — Pass 6: the interior

The last open finding from Pass 1: **"material reads as pastel glass — opaque
shell by contract; no zoning, no inclusion depth at portal size."**

This pass started with an audit rather than a change, because the previous four
passes each found a mechanism that looked live in the source and was not. The
audit found the same thing again, and it found it for the whole material at
once.

Decision record: `docs/05_ADR/ADR-0013-zoning-inside-the-stone.md`.

---

## 1. The ablation

Every scalar term in the crystal shader, zeroed one at a time, with the live
portal rendered and diffed against the unmodified run. Mean absolute change per
channel over the artifact's own lit pixels, out of 255:

```
CoreStrength         16.62    91% of pixels moved by >2
FacetEdgeStrength     5.84    31%
GlassStrength         1.03    13%
RimStrength           0.93    10%
StriationStrength     0.81     6%    (added last pass)
SkyStrength           0.81     6%
VeilStrength          0.72     9%
AxialTintStrength     0.50     1%
InclusionDensity      0.42     7%
AuroraStrength        0.22     2%
```

**The crystal is core light plus facet rims.** Everything else is under half a
percent of the range. In particular the three terms that exist to give the stone
an interior — inclusions, veils, and the foot-to-tip gradient — together move
about 1.6 of 255.

That is Pass 1's finding as a number, and it is a better statement of it than
"reads as pastel glass": the interior mechanisms are not weak, they are
inaudible, and no honest amount of turning them up would have been the fix.

---

## 2. Why the inclusion was inaudible

Not the constant. The application:

```glsl
outgoingLight *= 1.0 - evolutionInclusion * uEvolutionInclusionContrast;
```

It multiplied the **shaded result** — specular highlight included. That is what
a stain on the *surface* does. A cloud inside quartz is not a stain: it is a
region that scatters the light crossing it, so what it changes is the light
coming from *within*.

And it was thresholded. `smoothstep(1 − density, 1, band)` with a measured
density of 0.111 keeps the top eighth of the noise range — thin filaments, which
is what an inclusion *trail* looks like and not what zoning looks like.

So two changes, both about placement rather than magnitude:

- The band now modulates the **inner light**, alongside the veil, and both
  *lift* it. Milky quartz is white because a cloud scatters light back out; a
  clouded stage of the crystal reads as brighter from within, never as a dark
  patch.
- It is a **broad zone**, not a threshold. Sharpening toward the boundary rather
  than cutting at it keeps every part of the body inside a stage of one kind or
  another, which is how a crystal is actually built.

Weighting the zoning by the inner light — which is already `facing³` — is what
makes it depth rather than paint. Both terms fade to nothing at the silhouette,
where there is no stone between the eye and the far side to hold anything. A
flat addition would have drawn the same pattern on a face seen edge-on, the one
place a real inclusion cannot show.

---

## 3. §32: the material must not hide the geometry

The brief is explicit about this and it is the real risk of the pass, so it was
measured rather than asserted. Horizontal scans across the shaft at five heights
inside a **fixed** window — the first attempt used a brightness threshold to
find the shaft, which moved when the term under test changed the brightness, so
the two runs were not measuring the same pixels:

| | zoning on | zoning off | change |
|---|---|---|---|
| step across facet boundaries | 26.26 | 26.54 | **−1.1%** |
| broad range within one facet | 25.02 | 22.14 | **+13.0%** |

Facet separation is intact; the interior gained an eighth more variation. Pushed
to twice the amplitude the facet step did not fall at all (26.6), so the
constraint is not what is bounding this — the look is.

---

## 4. The amplitude had to stay a derivation

The first value that read well on the portal was a slope of 2.6 on
`inclusionBase`. Measured across couples it put a couple who logged in one burst
at 1.303 and a steady couple at 0.950 — **both clamped to 1**, so the number
stopped meaning anything and the cloudiness no longer came from the history.

At 1.4 they come out 0.986 and 0.796: a quarter of the range apart, neither
clamped, and the low end still above the amplitude measured to lift within-facet
variation by 13%.

This is worth stating as a rule, because it is the fifth version of the same
mistake in six passes: **a derived number that saturates is a constant with a
derivation's name on it.** The test now asserts the gap between two couples, not
just that the field is populated.

---

## 5. Pass 1's list, closed out

| Finding | Status |
|---|---|
| Termination planes feel designed | fixed — Pass 2 |
| Extremely long uninterrupted vertical facets | fixed — Pass 3 |
| Insufficient variation lower/middle/upper | fixed — Pass 3 |
| Placement feels positioned, not grown | fixed — Pass 4 |
| No evidence of growth history | fixed — Pass 5 |
| Material reads as pastel glass | fixed — this pass |
| Secondaries share the same shape language | partly — they have rank, colour and tilt of their own; the plane builder is still shared |
| Overly consistent prism cross-section | partly — roundness still drifts monotonically |
| Silhouette too predictable while rotating | partly — a convex body is 180° symmetric by definition |

Two of the three remaining "partly" items are structural properties of the
architecture rather than defects: a convex half-space intersection *is* 180°
symmetric, and one plane per face *can* only drift one way in cross-section. The
third — a different plane builder for the children — is real work, and it is the
honest next thing if the owner wants it.

---

## 6. What is left

> Done — see `CRYSTAL_NATURALIZATION_PASS_7_STAGE.md`. The key light earns its
> place (a fifth of the crystal's facet separation); one light was contributing
> a hundredth of a quantisation step; and the desktop portal turned out to have
> no reachable navigation at all, with the canvas painting over the sidebar.

**Lighting and mobile calibration**, which five passes have deliberately
deferred because each was a response to whatever the geometry and material
turned out to be. The ablation table above is the input to it: the crystal is
carried by two terms, and the stage was tuned when it was carried by different
ones.

**A regression run** across ages, couples, both themes and both orientations,
which is Pass 10 of the owner's original brief and the only item of it not yet
touched.
