# Crystal Naturalization — Pass 5: growth striation

The last item on Pass 1's confirmed list that adds something rather than fixes
something: **"almost no evidence of growth history — no striation, no zoning, no
growth bands anywhere in geometry or shader."**

That was literally true. There was no term for it in either.

Decision record: `docs/05_ADR/ADR-0012-growth-striation.md`.

---

## 1. What was missing

Horizontal striation across the prism faces, perpendicular to the c-axis, is
*the* diagnostic feature of quartz — it is how the mineral is told from beryl at
a glance. Our shaft had none. Pass 1's "no evidence of growth history" and the
long-standing complaint that the shaft reads machined are the same absence seen
from two sides: a perfectly smooth prism face is not a thing quartz does.

---

## 2. Drawn, not modelled — and that is a constraint

Since ADR-0006 every face is planar by construction, and the architecture's own
position (§4 of the owner's brief agrees) is that vertex noise is not how this
crystal gets its detail. Cutting real steps into the shaft would break the one
property the whole faceting rests on.

It is also unnecessary. A striation is a terrace a few microns deep; what it
does to a render is change a normal, and a normal can be changed without moving
a vertex. So the term lives in the fragment shader, beside the facet rim that
already works the same way.

**Three decisions inside it, each with a reason:**

- **The shaft only.** Quartz prism faces are striated and the rhombohedral
  termination faces are smooth. Bands crossing the tip would be a texture nature
  does not put there. Read off the object normal, so it does not depend on where
  the camera is.
- **A terrace, not a ripple.** Real striation is a hard lip and a slow run back.
  A symmetric sine gives a corrugation, which reads as a machined thread — the
  exact impression this exists to remove.
- **An analytic fade, not a clamp.** `fwidth` gives bands-per-pixel; below about
  two pixels a band the pattern stops being striation and becomes moiré, so it
  fades out. This is the same failure the tree's bark striation hit when its
  frequency outran the rings carrying it — measured at 1.9 rings per wave, and
  it rendered as *nothing at all* rather than as something wrong. Fading is
  honest here: a crystal seen from far enough away genuinely has no visible
  striation.

---

## 3. The count is the history

**One band per year the couple has been together.**

Striations *are* growth increments on a real crystal, so this is the one place
where the mineral's own texture and the artifact's meaning are the same thing
rather than one dressed as the other. It is also the monarch's only expression
of the year count — until now she carried it solely as height, and height is a
quantity you cannot count.

Floor of 4, ceiling of 36. The floor because a couple in their first year would
otherwise get a single line, which reads as a defect rather than a texture — a
crystal has striations from the moment it has a prism face. The ceiling because
the monarch stands about 300 px tall on a portrait phone, so 36 bands is 8 px
apart, and past that the shader's own fade would be deciding the look instead of
the number.

Off on `micro` bodies (a terrace across nine pixels is noise) and off on the
`fallback` quality tier.

---

## 4. Measured on the live portal

A vertical scan down three columns of the shaft, run twice — once with the term
and once with it stashed out, so the effect is attributed rather than assumed:

```
                 dips in column     mean luminance
control (none)     2 / 0 / 0          173.3 / 202.6 / 200.1
with striation     6 / 4 / 5          173.2 / 202.5 / 200.0
```

The lines land at canvas rows 134, 275, 412 — evenly spaced by about 140 rows,
which is the periodicity the count asks for. Depth is 5–13 luminance units out
of ~200, so a 2.5–6.5% hairline: visible as texture, not as a barcode.

**Mean luminance is unchanged to a tenth of a unit.** The terrace is balanced
about zero, so the crystal did not quietly get darker — which is what a
one-sided band term would have done, and it would have been easy to miss behind
"it looks fine".

---

## 5. Where the pass list stands

Pass 1 confirmed nine findings. After five passes:

| Finding | Status |
|---|---|
| Termination planes feel designed | fixed — Pass 2, lattice angle + r/z |
| Extremely long uninterrupted vertical facets | fixed — Pass 3, shoulder cuts |
| Insufficient variation lower/middle/upper | fixed — Pass 3, same mechanism |
| Placement feels positioned, not grown | fixed — Pass 4, rank + tilt band |
| Secondaries share the same shape language | partly — Pass 4 gave them rank and colour, not a different plane builder |
| No evidence of growth history | fixed — this pass |
| Overly consistent prism cross-section | partly — roundness still drifts monotonically |
| Silhouette too predictable while rotating | partly — convex bodies are 180° symmetric by definition |
| Material reads as pastel glass | open — Pass 6 |

---

## 6. What Pass 6 should be

> Done — see `CRYSTAL_NATURALIZATION_PASS_6_INTERIOR.md` and ADR-0013. An
> ablation of every shader term found the interior mechanisms measurable at
> under half a percent of the range; the fix was where the inclusion was applied
> rather than how strong it was.

**Internal structure, and it is the hard one.** The shell is opaque by contract:
the canvas alpha-composites over a CSS sky, so real transmission renders black.
"Internal zoning" therefore has to be depth-weighted core light rather than
transmission, which is the cheapest thing on this list to get wrong and the one
§32 warns against — material must not be used to hide geometry.

After that, lighting and mobile calibration are responses to whatever Pass 6
produces rather than independent work, and the regression run closes it out.
