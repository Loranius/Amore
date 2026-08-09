# Crystal Naturalization — Pass 12: the reference cluster

The owner supplied a low-poly quartz cluster and four notes: hide the black
growth bands, pull the children onto the monarch's foot like a skirt, make the
camera follow the artifact's size, and adapt the arrangement from the reference.

Decision record: `docs/05_ADR/ADR-0018-one-cluster-and-a-camera-that-follows-it.md`.

---

## 1. What the reference actually says

The `.dae` holds five identical copies with different material sets. Each is
seven connected components: one lump of rock and **six crystals**. Split by
connected component, measured by principal axis in each body's own frame:

| faces | width | depth | height | aspect | tilt off vertical |
|---|---:|---:|---:|---:|---:|
| 48 | 1.78 | 1.34 | 5.03 | 3.2 | 3.6° |
| 32 | 1.44 | 1.44 | 3.98 | 2.8 | 1.5° |
| 32 | 1.22 | 1.05 | 4.22 | 3.7 | 2.0° |
| 32 | 1.04 | 1.05 | 3.84 | 3.7 | 1.3° |
| 20 | 0.87 | 0.91 | 2.54 | 2.9 | 4.1° |
| 20 | 0.95 | 1.00 | 2.09 | 2.1 | 1.1° |

Three findings, all three against what we had.

**They stand.** 1.1–4.1° off vertical, against our children's 30–58° off the
monarch. A vug does not fan out: its members nucleate on one seam and race the
same way, and what varies between them is **size, not bearing**. The wide band
came from reading Pass 1's *"placement feels positioned"* as a call for spread,
and spread is what a starburst is.

**Aspect ~3.0**, against our children's 4.25. Blunter and stouter.

**Every base on one plane**, all out of the same rock.

The first two became numbers directly: tilt 7–26° off the monarch, and
`radialScale = axialScale / 6`. The third was already true since ADR-0016.

---

## 2. The bands are gone, not zeroed

ADR-0012's growth striation was correct mineralogy — horizontal striation
perpendicular to the c-axis is how quartz is told from beryl — and at portal
size it read as black bands across the shaft.

Removed outright: the shader block, both uniforms, both published fields, the
`striationCount` derivation and its suite. An inert mechanism with a name that
promises work is the exact defect five passes of this work have found in other
people's code.

---

## 3. Standing the children up broke four things, and the sweep found all four

Not one was visible by reading the change.

**The ring step was a constant.** `0.2` held while a child was slim. Thickening
took a twenty-five-year child's radius from 0.074 to 0.105, so two adjacent
rings needed 0.21 and had 0.20 — ring 2 landed **0.051 inside** ring 1.

**A ring is a circle, and nothing was asking.** `n` bodies of width `2r` with a
gap need `n·(2r + gap)` of circumference. Two of a nine-year couple's eight
first-ring crystals came out **0.0014 into each other**. `ringSeatingRadius` now
answers that question, measured against the ring's *actual* occupancy rather
than its capacity: a young couple is the case the owner looks at, and widening
their two-crystal ring to seat eight would buy nothing.

**The skirt cleared only ring 0.** A nine-year couple already has ring 1, and it
sat 0.032 inside its own hem.

**And the same defect again, in the rock.** A boulder was trimmed against the
**planes** of its hull rather than its corners. Nine planes put a corner up to
1.6× further out than the nearest face, so a boulder's vertex crossed a crystal
it had been moved clear of. This is ADR-0016's clearance bug wearing a different
hat: a radius that describes a face used as though it described the solid.

Hull margins between every pair of bodies, before and after:

| couple | after standing them up | after the four fixes |
|---|---:|---:|
| 1 year | 0.0108 | 0.0108 |
| 4 years | 0.0185 | 0.0317 |
| 9 years | **−0.0318** | 0.0339 |
| 25 years | **−0.0510** | 0.0423 |

---

## 4. The druse had become a disc

With the children thickened, a twenty-year colony measured **2.23 scene units
wide against 2.36 tall**. On a portrait phone that is not a look, it is a
geometric trap: a disc that wide forces the camera so far back that the artifact
renders *smaller* than a four-year one. Twenty bodies of width `2r` cannot fit a
circle narrower than `20·2r`, so the only lever that answers is `r`.

A child's share of the monarch now falls as the colony crowds —
`0.5·(N/4)^−0.35` past four years. The owner's ceiling ("half of the monarch,
never more") is untouched; what changed is that a crowded seam gives each
crystal less, which is what a real vug does.

**The exponent is bounded by an invariant, not by taste.** A closed year may
never shrink, and each new year both takes a share and grows the monarch, so the
share may fall no faster than the monarch rises: `ln(1.4/0.527) / ln(30/4) =
0.486`. 0.35 leaves a third of the margin — and the regression sweep now checks
it on the built bodies rather than trusting the arithmetic.

| age | crystals radius | height |
|---|---:|---:|
| 1 year | 0.36 | 0.82 |
| 4 years | 0.58 | 1.21 |
| 10 years | 0.91 | 1.77 |
| 20 years | **1.30** | 2.54 |
| 30 years | 1.46 | 2.79 |

---

## 5. The camera follows the artifact

The frame was three constants: height 5.2, width 2.3, target 1.25 above ground.
So growth moved the crystal and nothing else, a three-year couple filled **23%
of the screen height**, and the target sat *above the tip* of their crystal —
the camera was aiming at empty air over it.

Now the frame comes from the artifact's height, and the share of it the crystal
occupies rises from 0.52 to 0.66 across the term. Both of the owner's
requirements are one curve: more visible scene, and a bigger crystal.

Measured on the real pipeline at aspect 0.46:

| age | visible frame height | crystal's share |
|---|---:|---:|
| 1 year | 1.69 | 49% |
| 4 years | 2.72 | 44% |
| 10 years | 4.27 | 41% |
| 20 years | 6.10 | 42% |
| 30 years | 6.86 | 41% |

Four times more scene, and the crystal never drops below 41% against the old
23%. On a wide screen the share climbs 56% → 64%.

The aim point is 0.58 of the artifact's height — deliberately above the middle,
because the top third of the canvas is the home screen's header, and at 0.46 the
crystal's tip landed exactly under the artifact's own title.

---

## 6. Gates

1218 tests green, `tsc --noEmit` clean, `npm run build` clean,
`validate_documentation.py` passing, and the live portal rendered under the
owner's login: the monarch fills the frame, the children stand around her foot
in one node of quartz, and there is not a band anywhere on the shaft.

Bodies 7, meshes 8, draw calls 13 — unchanged.
