---
name: amore-frontend-craft
description: The quality floor for any visible change in the Amore portal, and the list of defaults that make an interface read as machine-made. Use this whenever building or changing a screen, card, modal, button, list, empty state, or any CSS in src/features — and before claiming a visual change is done. Also use when the owner says a screen looks flat, cheap, generic, unfinished, "like a template", or when a change needs verifying on the real portal. Covers contrast, spacing, type, motion, states, browser surfaces, and the anti-patterns that survive every review because nobody names them.
---

# Amore frontend craft floor

Derived from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0),
adapted to this repository and re-grounded in what is actually measured here.

This is the floor, not the direction. Direction lives in `amore-visual-direction`
and in ADR-0031. A green floor with no point of view is still a bad screen.

## Verify on the built result, never on intent

Each item below is a check on what rendered, not on what you meant. Run them
**together in one batched pass**, not as separate screenshot trips — they share
one render.

- **Contrast.** Body and placeholder text ≥4.5:1, large text ≥3:1. On a coloured
  surface, tint secondary text from that hue — never reach for grey. This portal
  is dark violet everywhere; grey secondary text on violet reads as a bug.
- **Depth.** A shadow carries an offset *and* a soft blur. A zero-offset coloured
  halo is decoration pretending to be depth.
- **Spacing.** Tight inside a group, generous between groups, more space above a
  heading than below it. Read the computed values, do not eyeball them.
- **Type.** Body measure 65–75ch. Run the **real** copy at every breakpoint and
  fix what overflows. This bit already cost a round here: the constellation
  labels were `white-space: nowrap` and cut «Річниця першог…» in half on the
  live screen — the fix was two lines and would never have surfaced in a test.
- **Motion.** One authored moment per screen, not an identical entrance on every
  block. Ease out from an already-visible default.
- **States.** Hover, disabled, loading, error, empty — plus real content, working
  controls, and keyboard focus.
- **Copy.** Controls name their action; errors name the problem *and* the
  recovery.

## What this repo already does well — do not "fix" it

Measured, so you do not waste a pass re-auditing:

- **`prefers-reduced-motion`: 63 blocks** across the CSS. The convention is real.
  Any animation you add needs its reduce branch, and that is the only reason to
  touch this.
- **`:focus-visible`: 66 rules.** Focus is taken seriously here. Match the local
  pattern (an `outline` in a `color-mix` of the module accent) rather than
  inventing one.

## The gap nobody has closed

**`::selection` is themed in exactly zero places.** Every screen in this portal
hands text selection to the browser default — a blue that belongs to no design
system and clashes with every violet surface we ship.

Browser surfaces are the parts you did not draw but still ship: selection, the
caret, scrollbars, focus rings, underline offset, tabular numerals. They are the
cheapest signal that a page was *built* rather than assembled, and the one most
reliably skipped. `caret-color` appears once; scrollbars are themed in eight
places. Selection, nowhere.

## Token drift is the real defect here

`src/index.css` defines **54 tokens**. Feature CSS contains **107 distinct
hardcoded hex values** across 82 stylesheets.

Before adding a colour, look for the token. Before adding a token, check whether
one already means that. A literal hex in `src/features/**` needs a reason in a
comment, and "the token was slightly off" is not one — fix the token.

## Refuse

These are the category's defaults, not bans. The brief can earn any of them; your
habit cannot. Reaching for one when the axis was free means you were not
deciding — and the fix is to rewrite the element, not to soften it.

**Structure**

- Same-size cards of icon + heading + text used *as* the page structure. Cards are
  the lazy container. Nested cards are always wrong — and this repo has 55
  stylesheets painting `var(--surface)`, so the collision is one careless wrapper
  away.
- The hero-metric template: big number, small label, supporting stats, accent.
- A kicker or eyebrow above a heading. This one is an outright ban: no brief earns
  it back. The heading carries its own weight.
- Section numbers (01 / 02 / 03) unless the sequence itself is information.
- A modal for a task that needs neither interruption nor protected focus.

**Surface**

- Gradient text. Emphasis comes from weight or size. (Currently zero occurrences
  here — keep it that way.)
- Glass and blur as decoration rather than as a specific effect.
- A coloured `border-left`/`border-right` above 1px on cards, list items, or
  alerts. Note the deliberate exception: plan tiles use a left edge in the
  category colour, and that is a committed decision from ADR-0031, not drift.
- Hard offset shadows (`box-shadow: 4px 4px 0`) outside a world that actually
  chose neobrutalism. This one did not.
- Sparklines, progress rings, and soft-shadowed rounded rectangles standing in
  for content.
- Monospace as a costume for "technical" rather than for code, data, or
  measurement.
- **Emoji or unicode glyphs standing in for an icon system.** This repo has seven
  real icon modules in `src/components/icons/` sharing one `iconBase.ts` stroke
  and weight. Use them or add to them; never paste a glyph.

## Verify in bounded passes, then stop

The ceiling covers the whole cycle — screenshots, defect scans, micro-edits and
rebuilds alike:

1. Build the change fully.
2. Inspect **once**, batched: `npm run live -- <route> --probe=<selector>`,
   phone and a wide device together when layout is at stake.
3. Fix everything that round showed, in one batch.
4. Confirm with **at most one** more round.
5. Stop polishing.

Open-ended self-QA burns the owner's money doing worse what a single careful
round does well. Read `scripts/live/README.md` before the first run: it lists six
ways a live screenshot has already lied in this project, five of which are closed
inside `portal.mjs` and one of which (frame rate under SwiftShader) you simply
have to know. Do not hand-roll a second harness; extend that one if it cannot
reach what you need — it learned sequential `--tap` exactly that way.

## Report what you measured

"Looks right" is not a result. `.rj-star × 7`, `.rj-beam × 6`, star diameters
35/22/16 px — that is a result. Every claim that a visual change works should
name the route, the device, and the numbers the probe returned.
