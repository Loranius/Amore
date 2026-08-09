# Crystal Naturalization — Pass 10: the term and the colour

Not part of the original brief. Two things the owner read off the live portal
after Pass 9 landed:

> «Кристал монарх занадто великий для відносин віком 3 роки… після тридцяти
> років разом кристал і дочірні кристали просто будуть розростатися в ширину,
> додаватись нові грані.»

> «Мені не подобається що одна частина кристала жовта а інша рожева, це певно
> зв'язано бажаннями… **якщо звичайно** поточний двосторонній колір залежить від
> бажань.»

Decision record: `docs/05_ADR/ADR-0015-thirty-year-term-and-colony-wish-colour.md`.

---

## 1. The second one contained a question, and the answer was no

The owner said "probably wishes" and left themselves an out. Taking the guess at
face value and rebuilding the wish colour would have shipped a change that did
not touch either coloured region.

Measured on the live couple's published state before changing anything:

| what is on screen | where it comes from | is it wishes? |
|---|---|---|
| pink body | `materialPalette.primary/secondary` — the artifact's mineral | no |
| foot darker toward the core hue | `axialTintStrength: 0.55` | no — a gradient |
| yellow on some bodies | `emphasized ? rgb(1, 0.72, 0.28)`, `emphasized = year.complete` | no — a closed-year badge |

The shell did not read `tintRgb` **at all**. One half of the two-tone was a
gradient, the other was a badge meaning "this year is closed" — a meaning the
owner was reading as a colour defect.

**And not because the couple had granted nothing.** They have eight fulfilled
wishes with full attribution — four given to the first partner, two to the
second, two shared. Not one of them could reach the shell, because ADR-0004 said
so: *"the colour belongs to the core… outside, every crystal keeps the colony's
one mineral nature."* The owner asked for the opposite, so this pass reverses a
stated rule rather than fixing a bug — which is why it needed an ADR.

Inside the core it was barely doing anything for this couple either. The
monarch's `tintRgb` was **hardcoded** `[1,1,1]`, and the fourth year came out
exactly white because that year is perfectly balanced (2 / 2 / 2) and `wishTint`
turns balance into *iridescence* rather than hue. The couple who gave each other
the most got the whitest crystal.

---

## 2. The height curve gave away most of its range before year five

`0.42 + 0.3·ln(1 + years)` was chosen in ADR-0004 to replace an exponential that
**saturated** at five years. It solved that. What nobody measured was how the
range is distributed across the term:

| age | old | share of a 30-year crystal | new | share |
|---|---:|---:|---:|---:|
| day one | 0.420 | **29%** | 0.260 | **19%** |
| 1 year | 0.628 | 43% | 0.358 | 26% |
| 3 years | 0.836 | **58%** | 0.477 | **34%** |
| 10 years | 1.139 | 79% | 0.777 | 56% |
| 20 years | 1.333 | 92% | 1.111 | 79% |
| 30 years | 1.450 | 100% | 1.400 | 100% |

A couple on their first day already had 29% of the artifact, and by three years
58% — the crystal outgrew the relationship, and twenty-seven of the thirty years
shared the remaining two fifths. That is what the owner saw and it is a real
property of the curve, not a matter of taste.

The replacement is a plain power curve over a fixed 30-year term,
`0.26 + 1.14·progress^0.72`. The exponent below one still front-loads the early
years — day one to three years is an **83% gain**, so the years that matter most
to a young couple are still where the crystal changes fastest — but mildly
enough that year twenty is visibly taller than year ten.

`MONARCH_FULL_HEIGHT = 1.4` is not an arbitrary ceiling: it is `REFERENCE_HEIGHT`
in the renderer's camera fit. So "100%" means *the crystal that fills the frame*,
and every younger crystal is a measurable fraction of it. That is what makes the
table above a statement about the screen rather than about engine units.

Flat past thirty **by construction** — `progress` clamps, so there is no separate
branch and no clamp bolted on after the fact.

---

## 3. What a relationship past thirty gets instead

The owner named both: width, and new faces.

- **Width** — `veteranGirth()`, a saturating multiplier on the monarch's radial
  scale: ×1.00 at thirty, ×1.06 at thirty-five, ×1.16 at fifty, ×1.22 at seventy,
  ×1.35 in the limit. The children scale from the monarch, so the whole druse
  thickens with her. It only ever grows.
- **Faces** — one facet per five years past the term, inside the same 24-facet
  ceiling. Also add-only, so ADR-0004's hardest guarantee — *a facet earned is
  never lost to the passage of time* — is untouched.

Both are add-only for the same reason: this is the half of the model that has to
work for couples who will be using the product for decades, and a number that can
go down would eventually take something away from one of them.

---

## 4. The colour, and the two mechanisms it replaced

The monarch now publishes **one** tint for the colony, computed from every wish
the couple has granted across their whole history rather than one year at a time.
Volume VI reads it from the monarch's instruction and mixes it into **every
body's shell** at 0.8.

Proportionality came free: `wishTint` is already white at nothing granted and
deepens toward the hue with the count, so the mix takes it whole. Pure white is
treated as "nothing granted" and leaves the mineral untouched — otherwise a
couple with no wishes would get a washed-out crystal instead of their own.

Removed:

- `axialTintStrength` → 0. The foot-to-tip gradient. Its stated job — "a body of
  one flat colour reads as moulded" — now belongs to the zoning inside the stone
  (ADR-0013), which varies colour *within* a facet instead of splitting the body
  along its length. Pass 6's ablation had already measured this term at **0.50 of
  255** on average; almost everything it was contributing was the split itself.
- The closed-year gold. It marked something the colour is not about, and the year
  crystals already say "closed" by standing at full size.

---

## 5. Two tolerance failures that were worth measuring instead of loosening

Two colour assertions in `materialLifeRenderer.test.ts` failed after the gold came
out — comparing a closed year's hue against every other body's.

Rather than widen the tolerance to whatever made them pass, the gold was
temporarily restored and the ratio measured on both sides:

| | r/g of a closed year | r/g of every other body |
|---|---:|---:|
| with the gold | 1.7779 | 1.9057 |
| without | 1.9057 | 1.9057 |

So the gold was a **6.7%** hue shift, and with it gone the two are bit-identical
in the channels those tests compare. The tolerances are now set to three and two
decimal places respectively, citing those numbers — a tolerance chosen from a
measurement rather than from a failure message.

Six tests in total encoded the superseded rules — three growth, three colour —
and each was rewritten with the reason stated in the test, per
`.claude/rules/tests.md`.

---

## 6. Where it stands

1232 tests green, `tsc --noEmit` clean, `npm run build` clean,
`validate_documentation.py` passing, and the live portal rendered under the
owner's own login.

Measured on that render:

| | before | after |
|---|---:|---:|
| monarch height, share of `REFERENCE_HEIGHT` | 58% | **36%** |
| colony tint | — (shell ignored it) | `[1, 0.85, 0.85]`, iridescence 0.2 |
| monarch shell | — | r 0.5340 / g 0.4389 / b 0.4514 |
| same shell with the tint ablated | — | r 0.5340 / g 0.4987 / b 0.5130 |

So the wish colour is **not** inert on real data: the couple's giving takes 12%
off the green and blue channels of every body, identically across the druse. And
there is no yellow anywhere on it.

Body count 7, meshes 8, draw calls 13 — unchanged.
