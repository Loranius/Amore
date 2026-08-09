# Crystal Naturalization — Pass 1: baseline analysis

Answers Pass 1 of the owner's *Crystal Naturalization Pass* brief: document what
the crystal currently is, and check each observation in the brief's §3 against
the actual output rather than against either the brief or the code comments.

No code was changed. Everything below is measured — from the published geometry
for a synthetic four-year couple, and from the live portal for the render tests.

---

## 1. What generates the crystal today

| Stage | Module | What it decides |
|---|---|---|
| Species | `engine/species/crystal/` | years, activity, consistency, tints, facet counts |
| Growth | `engine/growth/` | bodies, anchors, directions, sizes, per-body seed |
| Composition | `engine/composition/` | role, tier, sector, radial distance |
| Planes | `engine/geometry/planes.ts` | the half-space set each body is cut from |
| Polytope | `engine/geometry/polytope.ts` | intersection → faces |
| Mesh | `engine/geometry/mesh.ts` | per-face fan, `faceIds`, `borderEdges`, `axialT` |
| Trim | `engine/geometry/trim.ts` | hidden-face and base-cap removal |
| Substrate | `engine/geometry/substrate.ts` | the boulder field the druse sits in |
| Material | `engine/material/engine.ts` | per-body shader recipe |
| Renderer | `engine/renderer/three/` | batching, the crystal shader, the fit |

**The crystal is not a lathe and has not been one since ADR-0006.** Each body is
the intersection of half-spaces, so every face is planar by construction. This
matters for the brief: §9 ("preserve planar faces") is structurally guaranteed,
and §4's warning against vertex noise is already the architecture's position.

### Deterministic seeding

`seededUnit(body.seed, label)` throughout — no `Math.random()` anywhere in
`engine/` (verified by grep). Every plane, jitter and drift is a labelled draw
off the body's own seed. §24 is satisfied.

---

## 2. Measurements — monarch, four-year couple

52 triangles. 21 planes: 1 base, prisms, bevels, crown, 5 safety.
16 faces survive trimming: 8 near-vertical, 7 crown, 1 base.

**Prism faces are already unequal.**

```
areas   min 0.0267   median 0.0605   max 0.1065   max/min 3.99
azimuth gaps  16.6  17.6  75.2  31.6  62.4  30.2  79.4  47.0   (even = 45.0)
```

A four-fold area spread and gaps from 17° to 79°. The brief's "facet widths that
feel mathematically distributed" and "too much symmetry" are **not** what the
data shows.

**But the faces are vertical.** Measured inclination of the eight near-vertical
faces: −0.08° to −1.03°. The flare exists (`PRISM_FLARE_MIN/MAX`) and is real,
but under one degree — it changes the radius, not the read. Each face is one
unbroken strip from base to shoulder. The brief's "extremely long uninterrupted
vertical facets" is **confirmed**, and it is the strongest finding here.

**Cross-section evolves, monotonically.** Slicing the half-spaces by height:

```
y=0.05  r 0.059..0.093  roundness 0.638
y=0.50  r 0.061..0.102  roundness 0.596
y=0.90  r 0.062..0.111  roundness 0.559
```

The body widens and grows *less* round with height, which is the direction §7
asks for. What it cannot do is §7's actual request — "lower section: one facet
dominates; middle: another gains area" — because each plane carries a single
fixed tilt, so relative face areas can only change monotonically. **The same
facet dominates from bottom to top, always.**

**The termination is clamped flat.** Seven crown faces:

```
inclination  33.2  36.9  34.8  37.2  34.1  35.1  33.8   (spread 4.0°)
areas        0.0007 .. 0.0113   max/min 16.8
crown area = 7.7% of prism area
```

`CROWN_FACE_MIN/MAX_DEG` is 42–54°, and a monarch this tall wants a steeper
angle than the band allows, so **every crown face lands on the same clamp**. The
seeded shoulder spread survives as ±2°. That is why the tip reads as a designed
roof: not because the code lacks variation, but because the lattice band removes
it for exactly this aspect ratio. The brief's "termination planes that feel
designed rather than grown" is **confirmed, with a specific cause**.

The 16.8× area spread also means some crown faces are near-degenerate slivers —
§36's "tiny meaningless facets".

**Silhouette through the turn**: width varies 39.3% around the axis, one broad
maximum and one narrow minimum. Not flat — but a single smooth hump, so it reads
as "wide axis / narrow axis" rather than as incident. Convex bodies are 180°
symmetric by definition, so that part is geometry, not a defect.

---

## 3. Measurements — the cluster

Fourteen bodies for a four-year couple. Every one of them:

```
role = focal          (all 14 — no suppressed, no decorative, no hierarchy)
radial distance       0.194 .. 0.275      (one ring)
anchor.y              −0.01 .. −0.02      (one height)
direction.y           0.58 .. 0.70        (one tilt band, ~50–55°)
```

Two size classes: year crystals 0.147–0.174 tall, plan crystals 0.042–0.063.
Within a class they are near-identical. The monarch is 0.937 — six times the
largest child.

This is the brief's §19–§22 in one table. Placement **is** a ring at one radius,
one height and one tilt; dominance **is** scale multiplication; and there is no
competition, suppression or burial variation to speak of. **Confirmed.**

Each child is built by the same `buildCrystalFacePlanes` as the monarch, with
the same prism-plus-crown construction — the brief's "secondary crystals share
too much of the same shape language" is **confirmed by construction**, not just
by eye.

---

## 4. What already works and must not be broken

Pass 1's other job is to say what to preserve.

**Growth coherence is solid.** Same couple, increasing history:

```
years=2  bodies=8   h=0.878  azimuths 34,109,140,203,233,312,359
years=3  bodies=11  h=0.958  azimuths 34,109,140,203,233,312,359
years=4  bodies=14  h=1.022  azimuths 16,34,109,140,203,233,312,359
years=6  bodies=20  h=1.121  azimuths 16,34,109,140,203,233,312,359
```

The seed never changes, the monarch grows monotonically, all seven original
faces keep their azimuths, and year four *adds* one face — a bevel earned with
photos (ADR-0004) — without relaying out the rest. §25 and §26 are already met.
Any Pass 2–5 change has to keep this property.

**Seed diversity is real.** Four couples with identical history produce 7–8
prism faces with area sets from 0.016 to 0.116 — different individuals, same
family. §35 is met.

**Budgets have headroom.** The whole crystal is 52 triangles for the monarch and
a few hundred for the druse; the live portal reports 11,218 rendered triangles
of which 8,773 are the temple. Crystal draw calls are 5 against a ceiling of
materials+1 = 5. §27's "do not solve naturalism by raising polygon count" is not
a constraint we are anywhere near — **there is room to spend geometry on
silhouette, termination and facet boundaries.**

---

## 5. Verdict on the brief's §3 list

| Observation | Verdict | Evidence |
|---|---|---|
| Overly consistent prism cross-section | **Partly** | roundness drifts 0.64→0.56, but monotonically and always the same dominant face |
| Extremely long uninterrupted vertical facets | **Confirmed** | inclination < 1°, one strip base to shoulder, no transitional facets |
| Too much symmetry | **Refuted** | azimuth gaps 17°–79°, area spread 4× |
| Facet widths mathematically distributed | **Refuted** | see above |
| Termination planes feel designed | **Confirmed** | all 7 crown faces clamped to a 4° band |
| Insufficient variation lower/middle/upper | **Confirmed** | single fixed tilt per plane makes non-monotonic change impossible |
| Silhouette too predictable while rotating | **Partly** | 39% width variation, but one smooth hump |
| Almost no evidence of growth history | **Confirmed** | no striation, no zoning, no growth bands anywhere in geometry or shader |
| Secondaries share the same shape language | **Confirmed** | same plane builder, same prism+crown |
| Placement feels positioned, not grown | **Confirmed** | one ring, one height, one tilt band, all `role=focal` |
| Material reads as pastel glass | **Confirmed** | opaque shell by contract; no zoning, no inclusion depth at portal size |

---

## 6. Proposed order for Passes 2–10

Ordered by measured gain per unit of risk, not by the brief's numbering.

1. **Termination (brief's Pass 4) first, not fourth.** One clamp is flattening
   seven faces into a 4° band. Widening the band by aspect, or deriving the
   angle per face instead of clamping the lot, is a small change with the
   largest visible return — the tip is what reads as "designed".
2. **Facet competition (Pass 3)** — give each prism plane a second tilt term so
   its width can grow *and* shrink over height, and let boundaries shift. This
   is what turns long strips into faces that compete. It is also the change most
   likely to disturb growth coherence, so it needs the year-2..6 azimuth check
   above as a test.
3. **Cluster ecology (Pass 5)** — vary radius, height, tilt and burial per
   child; introduce a real role hierarchy instead of fourteen `focal`s. Cheap,
   deterministic, and it fixes the "positioned around" read.
4. **Growth bands (Pass 6 partly)** — the tree just gained geometric striation
   with a measured resolvability floor; the same technique applies here and is
   the only thing on this list that adds "evidence of growth history".
5. **Internal structure / material (Passes 6–7)** — last, deliberately. The
   shell is opaque by contract (the canvas alpha-composites over a CSS sky, so
   transmission shows black), so "internal zoning" has to be depth-weighted core
   light rather than real transmission. Cheapest to get wrong, and §32 says not
   to let material hide geometry.

Passes 8–9 (lighting, mobile) are calibration and should follow whatever 2–5
produce. Pass 10 is the regression run.

---

## 7. Rotation test

Eight azimuths rendered from the live portal at 45° steps. All eight read as
the same object; none is obviously artificial. What repeats across all of them:
the shaft is a small number of tall unbroken strips, and the tip is a roof of
near-equal triangles. That is the same two findings as the measurements, seen
from every side — which is the useful part: they are structural, not a bad
angle.
