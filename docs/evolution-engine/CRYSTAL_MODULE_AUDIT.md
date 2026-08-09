# Which portal modules reach the crystal

An audit the owner asked for — *"write out every module that drives the crystal
and every one that doesn't"* — and the corrections that came out of it.

Decision record: `docs/05_ADR/ADR-0017-modules-that-count.md`.

---

## 1. What the audit found

Not a gap. A **wrong denominator**.

`yearActivity` scores a year by how many portal modules it touched, over
`PORTAL_MODULE_COUNT`. So the list of event sources is not a list of
integrations — it is the artifact's definition of *what a shared life is made
of*. It had two errors, pointing opposite ways.

**The watchlist was not in the list at all.** It reached the artifact as a single
number in Volume VII's config and drove the dust drifting around the crystal.
No channels, no year breadth, no consistency. A year the couple spent watching
and reading together registered as **empty**. On live data that is 195 finished
items weighing nothing.

It also left `culture` — a pressure that drives the palette, `surfaceComplexity`
and `mutation` — reachable only from the map, via a city or country name on a
visited place.

**Shopping was in the list and gave almost nothing.** One collapsed record per
day, one channel, not a deliberate act. Buying milk counted as "a part of the
relationship this year touched" alongside a trip.

---

## 2. The map, as it stands now

| Module | What it drives |
|---|---|
| **Memories** | monarch's facet count; `remembrance` → refinement, luminosity; year breadth; consistency |
| **Plans** | one skirt crystal per completed plan (cap 24); deliberate act → monarch girth; channels; breadth; consistency |
| **Wishlist** | the colony's colour and iridescence; deliberate act → girth; breadth; consistency |
| **Map** | the quartz vein's width (×1…×1.45); deliberate act → girth; `exploration`/`culture`; breadth; consistency |
| **Calendar** | deliberate act → girth; `significance`/`stability`; breadth; consistency |
| **Media** | **new** — `culture` pressure; breadth; consistency; the sparkle count |
| **Schedule** | **new** — shared days off lift a year's fill. Not an event source |
| ~~Shopping~~ | **removed** — no events, no channels, no breadth |
| Game, Where-to, Piggy bank, Swipe, Culinary | nothing, by the owner's decision |

---

## 3. Two defects found *after* the code was written

Both in the schedule term, both found by measurement rather than by re-reading
the formula. They are the reason this document exists separately from the ADR.

### It could take something away

The first version blended: `0.65·activity + 0.35·togetherness`.

A couple who **starts keeping** the work schedule and has a quiet year gets
`togetherness = 0` — and their already-published year crystal shrinks. Measured
on the pipeline test: year 1 went from 0.0873 to 0.0801 the moment the schedule
covered it with nothing to show.

The rule that falls out, now written into a test that sweeps five activity
levels against five day counts: **adopting a module may never cost a couple
something they already had.** ADR-0004 states it for facets; it holds for every
signal that arrives late. The term is now purely additive.

### It normalised by coverage, and the live portal said no

The second version divided by the months the schedule actually covers. That
looks like the honest thing to do — two covered months at a good rate should
read as a good year, not as a year that is 10/12 empty.

Then the live data arrived:

| | value |
|---|---|
| schedule rows | 2026-07 … 2026-08, two months |
| shared days off | 18 |
| togetherness under coverage normalisation | 18 / (60·2/12) = **1.00, saturated** |
| togetherness counting flat | 18 / 60 = **0.30** |

Eighteen days across two months extrapolates to 108 across twelve, so one good
stretch of a newly adopted module outvoted everything the couple had recorded
all year.

Flat counting says only what is known. And because the term is additive, thin
coverage cannot punish anyone — so the entire `scheduleCoveredMonths` input, the
branch that produced it and half the query disappeared with it. **The correct
version is the smaller one**, which is not how it looked at design time.

---

## 4. The weakness that survives

`media_items` has no completion date. The adapter dates every event by
`created_at` and marks it `historical-estimate` — the same evidence grade a
memory with a month-precision date carries.

Measured live: **all 195 finished items have a 2026 `created_at`**, so the whole
watchlist lands in one relationship year. Nothing gets worse — the term only
adds — but the fairness this change was supposed to bring to earlier years does
not materialise for this couple's history. It arrives with a `finished_at`
column, or with time.

---

## 5. Gates

1240 tests green, `tsc --noEmit` clean, `npm run build` clean,
`validate_documentation.py` passing, live portal rendered under the owner's
login: 7 bodies, 8 meshes, 13 draw calls, both new queries returning data.
