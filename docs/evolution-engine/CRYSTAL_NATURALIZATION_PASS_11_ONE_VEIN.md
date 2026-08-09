# Crystal Naturalization — Pass 11: one vein

Two owner notes, read off the portal after Pass 10:

> «Кристали-діти приближ їх до основи кристала монарха, щоб вони органічно
> росли з одної спільної жили, тобто доведеться видалити одне налаштування яке
> змушувало кристали тягнутись до кристала монарха але ніколи не зростатиме з
> ним.»

> «Полікуй колір якщо він досягає рівних значень.»

Decision record: `docs/05_ADR/ADR-0016-one-vein-and-a-colour-that-survives-balance.md`.

---

## 1. The owner described a mechanism they could not see

The first note names a setting: *one that made the crystals reach toward the
monarch but never merge with her.* That setting existed, exactly as described:

```ts
const CHILD_EVENT_REACH = 0.05;
/** Fraction of that reach one important event closes. */
const CHILD_EVENT_STEP = 0.25;
```

A year's anniversaries and milestones closed a standoff they could never cross,
because the clearance floor sat underneath it. A crystal reaching for a mother
it was arithmetically forbidden to touch.

It is gone. Distance from the monarch is not something a couple earns — it is
what makes the colony one body. What a year did with itself shows in its size,
its facets and its fill, all of which are things the year *is* rather than where
it stands. `isImportantEvent` had no other consumer and went with it; the
calendar is still one of the six modules `yearActivity` counts.

---

## 2. How far off they actually stood

Measured on four couples, in each body's own frame:

| | value |
|---|---:|
| air between the monarch's surface and a child's | 0.080 |
| the same, mesh to mesh | **0.095** |
| a child's own diameter | 0.040 |

Every child stood more than two of its own widths off its mother. However tight
the ring looked in plan, from the portal's camera it read as separate crystals
arranged around a spire — which is what Pass 1 filed as *"placement feels
positioned, not grown"* and what four passes of tightening had not fixed,
because they tightened the ring and not the gap.

---

## 3. The clearance was drifting the wrong way, and nobody would have noticed

Cutting the flat clearance from 0.055 to 0.012 works at four years and nearly
fails at twenty-five. Measured as *how far the closest child's hull sits outside
the monarch's hull* — a plane test against the monarch's own faces, since both
are convex by ADR-0006:

| couple | flat 0.012 | proportional |
|---|---:|---:|
| 2 years | 0.0060 | 0.0122 |
| 4 years | 0.0035 | 0.0107 |
| 9 years | 0.0033 | 0.0138 |
| 25 years | **0.0010** | 0.0240 |

The cause is not a tuning error. `radialScale` is the distance to a **face**,
and a crystal is a polygon: its corners stand `1/cos(π/n)` further out — about
4% at eleven facets, more at the counts a child carries. That excess scales with
the body, so any flat clearance shrinks in relative terms as the monarch grows.

`0.012 + 0.12·(monarchRadius + childRadius)` covers both bodies' corner excess
about three times over. The margin is now positive everywhere and **grows** with
the couple's age instead of shrinking toward zero at the far end of the range —
which is the end nobody looks at.

Net: 0.095 of air became 0.011–0.024. Five times closer, and the vein's capsules
now merge into one node under the monarch instead of reaching out to each child
down its own branch.

---

## 4. A crossing nobody had looked for

While deriving the ring from the two radii, the skirt turned out to cross it —
in both directions. `SKIRT_RING_DISTANCE` was a flat 0.24 while the year ring
came from the monarch's girth:

| couple | year ring | skirt band |
|---|---:|---|
| 4 years | 0.158 | 0.240 – 0.310, clear outside |
| 25 years | 0.278 | 0.240 – 0.310, **straddling it** |

At twenty-five the monarch's own radius is 0.138 and a year crystal's is 0.048,
so the ring has walked out to 0.278 while the skirt has not moved at all: the
nearer half of the plan crystals now sit *inside* the year ring. A couple past
about twenty years had the marks of their finished plans scattered among and
behind the very crystals those marks are meant to hem.
`skirtDistance` now takes the same two radii plus the widest a year crystal can
grow, so the order is fixed at every age.

This was not on anyone's list. It fell out of deriving one number from the same
inputs as its neighbour instead of hand-setting it — which is the third time in
this sequence that replacing a constant with a derivation found a defect the
constant was hiding.

---

## 5. The colour that cancelled itself

ADR-0015 shipped with this as a stated risk; the owner read it off the screen
the same day.

```
hue  = [first, shared, second] / max(first, shared, second)
pull = max(first, shared, second) · 0.75
```

**Equal counts cancel.** Normalising three equal numbers gives `[1, 1, 1]`, and
over white that is white. The live couple's fourth year granted 2 / 2 / 2 and
published a tint of exactly `[1, 1, 1]` — indistinguishable from a couple who
had granted nothing at all. The doc comment called that the reward for balance,
paid in iridescence. On screen it is the absence of colour.

**And depth read one channel only**, so 3/3/3 and 3/0/0 pulled identically:
giving three times as much bought nothing.

The root of the first is a coincidence rather than a design: the channels were
mapped **straight onto RGB**, and three equal RGB channels are grey by
definition. Point them at mineral colours instead and the coincidence
disappears.

- **Direction** — the blend of rose quartz `[1, 0.35, 0.55]`, amethyst
  `[0.62, 0.35, 1]` and aquamarine `[0.35, 0.8, 1]`, in the proportion given. An
  even split lands on `[0.66, 0.50, 0.85]`, amethyst.
- **Depth** — the **total** granted, saturating at 14. More giving is always
  more colour.
- **Iridescence** — still balance, now as a second signal on top of a real
  colour rather than instead of one.

| granted | tint | iridescence |
|---|---|---:|
| 0 / 0 / 0 | `1 / 1 / 1` | 0 |
| 2 / 2 / 2 | `0.890 / 0.839 / 0.952` | 0.43 |
| 4 / 2 / 2 — the live couple | `0.890 / 0.770 / 0.904` | 0.29 |
| 10 / 0 / 0 | `1 / 0.652 / 0.759` | 0 |
| 10 / 10 / 10 | `0.743 / 0.625 / 0.887` | 1.00 |

**One wrong turn, worth recording.** The first attempt kept pale anchors and
rescaled the blend to full brightness. It came out *weaker* than the mapping it
replaced — the live couple landed at `[0.945, 0.895, 0.95]` against the old
`[1, 0.85, 0.85]`. Dividing by the largest channel drives that channel to white
and can only darken the others, so a pale anchor set has nothing left to give.
The chroma has to be in the anchors. Caught by printing the whole ladder before
writing a line of the ADR, not by a test.

---

## 6. What the tests now hold

- The clearance floor holds at six ages × three rings, against the
  *proportional* value and against the absolute floor separately.
- The skirt clears the widest a year crystal can grow, at four ages.
- Balance never costs more than 20% of the chroma of the most one-sided couple
  at the same total — a bound taken from the measurement (0.745 against 0.825),
  not from whatever made a failure go away.
- The colour deepens with the *total*: 3/3/3 must beat 3/0/0, which is the exact
  defect that shipped.

1234 tests green, `tsc --noEmit` clean, `npm run build` clean,
`validate_documentation.py` passing, and the live portal rendered under the
owner's login: the children now stand at the monarch's foot in one node of
quartz, and the druse is a pale amethyst rather than a pale pink.

Body count 7, meshes 8, draw calls 13 — unchanged.
