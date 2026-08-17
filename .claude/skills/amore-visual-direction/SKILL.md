---
name: amore-visual-direction
description: How to decide what an Amore screen should look and feel like, and how to apply the portal's committed visual world to a new or reworked module. Use this when starting a module screen, when a screen needs a point of view rather than a bug fix, when choosing motion timing/easing, a type scale, or where colour is allowed to go, and when the owner asks for something bolder, quieter, more alive, or "in the same language as the other modules". Read it before writing the first line of a module's CSS — and before inventing a duration, a radius, or a colour.
---

# Amore visual direction

Derived from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(MIT), reduced to the parts that apply to a portal whose world is already chosen.

The floor — contrast, spacing, states, the refuse list — lives in
`amore-frontend-craft`. This file is about the decision *above* the floor.

## The world is already committed. Do not regenerate it

The upstream skill's headline feature generates a design system from a product
brief: pattern, style, palette, typography, effects. **That step is done here and
must not be re-run.** ADR-0031 fixed the portal's world from the owner's
reference art: dark violet ground, crystalline surfaces, one accent family,
tokens in `src/index.css`.

So the question is never "what style suits a couples' app". It is "what does
*this module* look like inside the world we already committed to". A module that
answers with its own palette has not been designed — it has been decorated.

The one thing each module legitimately owns is its **camera angle and its
composition**. The azimuths are fixed and ordered: wishlist +90°, plans +45°,
home 0°, shopping −45°. That ordering is the module's identity — and it means a
new module does not get to pick an angle freely, it takes the seat the order
leaves open. Colour is never the identity.

## Pick the mode before anything else

The mode names what success looks like *on that surface* — and it is chosen from
the surface, not from the product:

- **Operate** — the visitor completes a task. Almost every Amore module: plans,
  shopping, calendar, wishlist list views, all modals. Scanability, consistency
  and the real usage scene outrank expression. Brand lives in precise details,
  not in gestures.
- **Experience** — the visitor is inside the artifact. The home portal, and the
  crystal/constellation surfaces. Let the object lead from the first viewport;
  the interface recedes.
- **Read** — the visitor understands something. Plan detail, event detail.
  Structure for comprehension first, then make the reading worth staying in.

Getting this wrong is the most expensive mistake available: an Operate screen
built as an Experience screen is the "beautiful and unusable" failure, and an
Experience screen built as Operate is the reason the home portal would look like
a settings page.

## Motion: use the scale that already exists

Measured across `src/features/**`, the de-facto scale is **90 · 160 · 180 · 220 ·
260 ms**, with 180 ms by far the most common. Do not introduce a sixth value
because a specific element "felt better at 200".

Tier the intensity to the trigger:

| Moment | Duration | Easing | Notes |
|---|---|---|---|
| Press / hover feedback | 90–180 ms | ease-out | Displacement under 2 px, or it reads as motion rather than feedback |
| State change, reveal | 180–260 ms | ease-out | Enter from an already-visible default, never from nothing |
| Staggered list or grid | 250–350 ms total | ease-out | Stagger step 40–120 ms; the whole list must finish inside ~600 ms |
| Route / camera move | 400–600 ms | ease-in-out | This is the module transition; only one per navigation |

Three rules that outrank the table:

1. **One authored moment per screen.** Not an identical entrance on every block.
   The constellation earns its staggered birth because that *is* the content;
   a settings list does not.
2. **Ease out from visible.** Elements grow into place from a default that is
   already on screen. Fading in from zero opacity on every mount is the tell.
3. **Every animation gets its `prefers-reduced-motion` branch.** 63 blocks in
   this repo already do it; a new one without it is the odd one out.

Beware when verifying: the live harness renders through SwiftShader at roughly
three frames per second. A three-second animation takes nearly a minute there.
**Measure progress, not "did it finish in N seconds"** — one defect already got
through exactly that way (ADR-0028).

## Colour: where it is allowed to go

- Colour carries **meaning or identity**, never decoration. The plan-category
  left edge means a category. A gradient because a card looked empty means
  nothing.
- On a coloured surface, secondary text is **tinted from that hue**, not greyed.
  Grey on violet is the single most common way this portal looks cheap.
- The couple's own hue (ArtifactDNA) may shift a module inside a **bounded**
  spread — see `JOURNEY_HUE_SPREAD = 34` in `RelationshipJourney.tsx`. A full
  360° rotation once turned their path lime green in the middle of a violet
  world. Bound it or do not use it.
- New colour goes into `src/index.css` as a token first. There are 54 tokens and
  107 stray hex values in feature CSS; do not make it 108.

## Type

- Body measure 65–75ch. On a 412 px phone that is roughly one column — which is
  why long copy needs a `max-width` in ch, not in px.
- Obvious steps in scale and weight. Two sizes 1 px apart are not a hierarchy.
- Run the **real** Ukrainian copy at every breakpoint. Ukrainian words are longer
  than the English placeholders they were designed against, and this has already
  produced one live defect (truncated constellation labels).

## The query discipline, when you do reach for reference

The upstream skill's most portable idea is not its data — it is how it makes you
ask:

1. One dominant intent per question, 2–5 meaningful terms plus one constraint
   (product, platform, interaction).
2. Search the **semantic outcome** first ("badge label wraps", "focus not
   obscured"), the implementation stack second. Never replace the outcome with a
   framework keyword.
3. Verify the result actually fits this product and platform before using it.
   Retry once, narrower. If it still misses, say no verified match was found and
   use clearly-labelled general guidance.
4. **Never persist unverified output.** A guess written into a stylesheet becomes
   a fact nobody questions six modules later.

Rule 4 is why this project keeps measured numbers in comments: `JOURNEY_HUE_SPREAD`
carries the reason it exists, so the next person cannot silently widen it.

## Before you call a screen designed

- The mode is named and the composition serves it.
- Every duration is on the scale; every colour is a token or has a reason.
- One authored moment, with its reduced-motion branch.
- The real copy fits at 412 px and at desktop width.
- The screen would be recognisable as Amore with the logo removed.
