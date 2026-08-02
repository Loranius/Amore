---
name: amore-game-concept
description: Game/interaction design for Amore's Evolution Engine — how real couple activity (memories, plans, wishlist, shopping, map, calendar) turns into a growing 3D object, and how a player-facing "click to inspect" experience should surface that. Use this whenever asked to design a new interaction for the crystal/tree/reef object, add gamification, design the click-to-zoom stats view, decide what counts as "growth," or evaluate whether a proposed feature fits the product's explicit "no fake game mechanics" constraint.
---

# Amore Game Concept

## The one mechanic that matters

The product owner has been explicit, twice: the *only* game element is that
the object grows from real events the couple adds to the app. No points,
no quests, no levels, no streak mechanics on top. Any proposal that adds
gamification beyond "your shared life visibly grows a beautiful object" is
out of scope unless asked for directly — resist the urge to make it more
game-like than that. The theming (species-driven portal colors, described
in `amore-portal-ux`) and the growth itself carry the "game" feeling; you
don't need scoring systems to make that land.

## How growth is actually wired today (so stats are real, not invented)

Events flow: real product data (`CalendarEventSource`, `PlanSource`,
`WishlistSource`, `MapPlaceSource`, `MemorySourceRecord`,
`MemoryLinkSource`, `ShoppingItemSource` — see
`src/engine/evolution/adapters/types.ts`) → normalized into an
`EvolutionSourceSnapshot` → `buildArtifactFromSnapshot` produces an
`ArtifactBlueprint` → the species blueprint (e.g.
`buildCrystalSpeciesBlueprint`) → `buildGrowthState` places a `GrowthBody`
per instruction.

Every `GrowthBody` (`src/engine/growth/types.ts`) already carries
`instructionId` and `sourceId` tracing back to the originating event, plus
semantic attributes (channel pressures like `achievement`/`remembrance`/
`exploration`/`stability`/`significance`/`culture` — see
`EVOLUTION_CHANNELS`). This means a "click this crystal spire, see what it
represents" feature is a **read**, not new modeling work: given a body's
`id`, walk back through the pipeline (or carry the source event forward
into render metadata) to show its real originating event, its date, and
which emotional "channel" it expressed most. Don't invent a stats schema
that isn't backed by this chain — the product owner was specific that
nothing should be static/placeholder.

## Designing the click-to-inspect interaction

When asked to build or extend this:

1. **What gets clicked** must resolve to a real `GrowthBody`, not a visual
   guess — raycasting in Three.js against the actual body meshes (which
   already carry `bodyId` in their mesh data) is the correct approach, not
   approximating position from the screenshot.
2. **The camera move** (zoom toward the clicked body) is a UX/visual-polish
   concern — camera framing, easing, and how the rest of the colony
   dims/blurs to focus attention belong in `amore-3d-visual-polish`'s
   territory once the interaction itself is decided here.
3. **The stats shown** should answer "why does this exist / what does it
   mean," pulling from the real event chain above: what kind of event
   (memory, plan, wishlist item...), when it happened, which archetype/
   formation it became and why (e.g. dominant emotional channel → chosen
   archetype, per `formations.ts`'s `ARCHETYPES` table), not generic mesh
   stats (triangle count etc. — those exist for developer diagnostics only,
   see the existing `evolution-preview-badge`, and shouldn't be user-facing
   product copy).
4. Consider what happens for bodies that predate this feature or come from
   synthetic/legacy data — degrade honestly ("details not available") over
   fabricating something.

## Extending "growth" to new species

Tree and reef will eventually want their own version of "which real event
made this branch/coral exist." The mapping mechanism (event → channel
pressure → archetype/formation choice) is species-specific
(`src/engine/species/{crystal,tree,reef}/`), but the *pattern* — real data
in, traceable semantic choice out, no invented numbers — should hold across
all three. When asked to design a reef- or tree-specific interaction, check
whether the crystal's existing adapter pattern already generalizes before
inventing a parallel one.

## Guardrail

If a proposed feature can't point at a specific real data field it's
driven by, it's not ready to build — flag that gap to the product owner
rather than filling it with a plausible-looking placeholder. This has come
up explicitly in this project already (the Godot engine's canary rollout
was reverted partly for shipping without grounding decisions in an actual
plan — see `docs/05_ADR/ADR-0002-godot-crystal-engine-reverted.md` — the
same discipline applies to feature design, not just infrastructure).
