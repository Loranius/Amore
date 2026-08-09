# Crystal Naturalization — Pass 4: the colony

Pass 1's last confirmed structural finding: "placement feels positioned, not
grown — one ring, one height, one tilt band, all `role=focal`."

Two of the three things this pass fixes turned out not to be missing features.
They were **mechanisms that already existed, had tests, and did nothing.**

Decision record: `docs/05_ADR/ADR-0011-colony-rank-restored.md`.

---

## 1. Rank in the composition did not exist

```ts
if (body.generation === 0 || body.tier === 'king') return 'focal';
```

`generation === 0` stood in for "this is the monarch", and it was true while
every child grew *on* her. It stopped being true when children became
ground-rooted: a body growing out of the substrate is the root of its own
colony, so the growth engine gives it generation 0 **by design**. Every body in
a crystal colony has generation 0.

Measured on three couples: `focal` came out 19 of 19, 32 of 32 and 36 of 36 —
while `tier` was correct the entire time (king / support / family / micro).

Worth naming the shape of this bug: **a field derived from the wrong one of two
things that used to agree.** Nothing was broken when the line was written. The
other half of the codebase moved.

---

## 2. Rank in the material did not exist either — for two separate reasons

`buildBodyMaterial` mixes a body's colour from `primary` toward `secondary` by
role, 0.06 at focal rising to 0.44 at micro. But

```
secondary = mixRgb(primary, warmth, warmth · 0.36)
```

so for a couple whose events carry no warm channel, `secondary` **is**
`primary`, and the whole ladder mixes a colour with itself. Measured: warmth was
0 for all three couples, and the monarch, the current year and every skirt
crystal shared one identical RGB — 0.7768, 0.3601, 0.5162.

The value step was written too — `role === 'micro' ? 0.84 : 1` — and was inert
for a different reason: it was applied *inside* `capShellValue`, which divided
it straight back out. Any colour above the cap comes out at exactly the cap,
whatever was done to it first.

So the step now follows the cap. The cap keeps its own job — no body sits above
0.46 luma, in the shoulder of the tone curve where a difference in illumination
stops being a difference in pixels — and the ladder descends from it.

---

## 3. The tilt band was not a band

45–55° is ten degrees wide, and measured on three couples every child of every
colony landed inside it: 45.2–54.9, 45.5–54.8, 45.3–54.9. A colony whose members
all lean by the same amount is a starburst, and a starburst is arranged.

Widened to 30–58°. Both ends are safe, and not by luck: leaning further only
carries the tip further out, and `CHILD_MIN_UPWARD` is derived from the maximum
rather than hand-set, so `ensureUpward` follows the band instead of quietly
standing the steepest children back up. Standing straighter keeps the tip over
its own base, and `childDistance` already puts that base clear of the monarch's
surface by both radii plus `CHILD_MIN_CLEARANCE`.

The maximum stops at 58° because the engine holds a separate invariant: a body
standing in the ground grows upward rather than out of the side. 58° off the
monarch is 32° above the platform and sin 32° = 0.530; at 64° it was 0.438 and
the invariant broke.

---

## 4. Result

| | before | after |
|---|---|---|
| roles in a 19-body colony | 19 focal | 1 focal, 4 support, 1 family, 13 micro |
| shell albedo across the colony | one value, 0% spread | 0.460 / 0.437 / 0.423 / 0.391, 15% |
| child tilt | 45.2–54.9° | 30.6–57.8° |
| radial distance (already varied) | 0.18–0.46 | unchanged |
| body / mesh / draw-call count | — | unchanged |

Verified on the live portal: the children now sit at visibly different pitches
— one lying well over, one nearly upright — where before they were a single
even splay, and the monarch reads as the centre of the group rather than as the
tallest of a set of identical stones.

---

## 5. The lesson worth keeping

Both revived ladders had tests. Both suites were green. Both mechanisms were
dead.

A test that checks a function returns a value does not check that the value is
**different** across the inputs it is supposed to distinguish. The new tests
assert spread, not presence:

- the colony has more than one role, and exactly one `focal`;
- `generation` really is 0 on every body, so it demonstrably carries no rank;
- with `warmth` asserted to be 0, every non-focal body is still darker than the
  monarch, and the spread is between 8% and 25% — rank, not shadow.

This is the same failure mode Pass 2 found in the crown clamp (261 of 313 planes
on a bound) and Pass 3 found in the vertical shoulder cut. Three passes, three
mechanisms that looked live in the source and were not. Measuring the *output
distribution* rather than the code path is what found all three.

---

## 6. What Pass 5 should be

> Done — see `CRYSTAL_NATURALIZATION_PASS_5_STRIATION.md` and ADR-0012. Drawn in
> the shader rather than modelled, because ADR-0006 makes every face planar and
> displacing the shaft would break the property the faceting rests on.

1. **Growth bands.** The only remaining item that adds evidence of history —
   there is none anywhere in the geometry or the shader today. The tree's
   geometric striation and its measured resolvability floor (four rings per
   wave, or it aliases into nothing) apply here directly.
2. **Internal structure / material.** Last, deliberately: the shell is opaque by
   contract, because the canvas alpha-composites over a CSS sky and transmission
   renders black. "Internal zoning" therefore has to be depth-weighted core
   light rather than real transmission.
3. **Lighting and mobile calibration**, then the regression run — both are
   responses to whatever 1 and 2 produce, not independent work.
