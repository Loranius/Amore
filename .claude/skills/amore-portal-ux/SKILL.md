---
name: amore-portal-ux
description: Portal-wide UX, theming, navigation, and onboarding for Amore (a couples' relationship app). Use this whenever working on the login/registration flow, the bottom navigation, the home screen layout, adding or changing CSS design tokens / color themes, building the "choose your species" onboarding step, or making the portal's look react to which Evolution species (crystal/tree/reef) a couple chose. Also use when told to change something "everywhere" or "across the whole app" — this skill has the single source of truth for tokens so you don't duplicate colors per page.
---

# Amore Portal UX

## Current state (read this before assuming something exists)

- **Theming today is light/dark only.** `ThemeProvider.tsx` sets
  `data-theme="light"|"dark"` on `<html>`; every token lives in `:root` /
  `[data-theme="dark"]` in `src/index.css` (the "Pink Portal" token system —
  `--bg`, `--surface`, `--accent`, `--page-gradient`, etc.). There is
  **no per-species theme yet.** Everything is a fixed pink/rose palette.
- **The home-page species switcher is a dev tool, not the product.**
  `HomeArtifactSwitcher` (`src/features/home/homeArtifact.ts`,
  `HomePage.tsx`) lets you flip between crystal/tree/reef via URL param +
  localStorage so progress on all three can be compared side by side during
  development. The product owner has explicitly said: don't polish this as
  a real feature, don't add static/mock data to it, it exists purely so
  development progress is visible. Treat it as scaffolding to be replaced,
  not extended.
- **There is no species-selection step in onboarding.** `LoginPage.tsx` is
  the only auth-flow file; there's no "pick your species" screen. This is
  real, not-yet-built work, not a bug.
- **Bottom nav** (`src/components/layout/BottomNav.tsx`,
  `src/app/nav.ts`): Бажання (wishlist) · Плани (plans) · Головна (home,
  center) · Покупки (shopping) · Ще (more). Reference art shows the home
  screen as a **full-bleed portal scene** (arch, columns, circular stone
  platform, starry sky, heart emblem) behind this same nav bar, not a small
  card widget — the Evolution object should be the entire screen's visual
  identity on Home, not a boxed-in preview.

## The target: species-driven global theming

Product direction (confirmed by the owner): a couple picks **one** species
at registration, permanently, and the *entire portal* re-themes around it —
not just the home screen:

- Crystal → purple/violet/pink, faceted glow accents.
- Tree → green/lime, organic warm tones.
- Reef → ocean blue, "watery" effects (bubbles, caustic light shimmer).

Design this the same way light/dark already works — as a **second
independent attribute**, not a fork of the token system. `data-theme` stays
light/dark; add something like `data-species="crystal|tree|reef"` on
`<html>` alongside it, and let `src/index.css` define a species token layer
(`--species-accent`, `--species-gradient`, `--species-glow`, etc.) the same
way `[data-theme="dark"]` overrides today. This keeps light/dark and
species orthogonal (dark+crystal, light+reef, etc. all need to work) rather
than needing six hand-authored combinations.

Concrete open questions to raise with the product owner before building
this (don't guess):

- Is the species choice ever changeable later, or truly permanent?
- What happens to a couple's existing data if they already have content for
  more than one species from the dev-switcher era?
- Does every themed surface need bespoke effects (reef bubbles) or is a
  shared "ambient particle layer" component parameterized by species enough
  for v1?

## Working with the token system

`src/index.css`'s comment block explains *why* it's centralized: pages used
to each duplicate `.pink-page`/`.home`/`.auth-screen` tokens locally, and
anything rendered outside those wrapper classes (Sidebar, BottomNav,
MoreMenu, notification bell) silently fell back to cold system defaults.
The fix was making `:root` the single source of truth and having
page-specific classes only set layout + gradient, not full palettes.
**Don't reintroduce per-page color duplication** — a new species theme
belongs as tokens at the same `:root`/`[data-attribute]` level, not as
inline styles or a new page-local CSS file.

## Interaction concept: click-to-inspect

Planned: clicking the Evolution object (whichever species) on Home zooms
the camera in and surfaces real statistics about what's growing and why —
which body/branch/coral maps to which life event. This must read from
actual `GrowthBody` data (each body already carries `sourceId`,
`instructionId`, and semantic attributes tracing back to the event that
grew it — see `amore-game-concept` for the data path), not placeholder
numbers. If you're building the stats panel before the data plumbing
exists, say so explicitly rather than shipping fabricated stats — the
product owner was explicit about "no static data."

## Checklist before shipping a UX change here

1. Does it use existing `:root` tokens, or did you hardcode a color that
   belongs in `index.css`?
2. Does it work in both light and dark theme (and, once built, all three
   species)?
3. If it touches Home, does it work as a full-screen experience, not just
   inside the current card-shaped preview?
4. Did you check `BottomNav`/`Sidebar`/`MoreMenu` still read correctly —
   these are exactly the surfaces that silently broke before the token
   centralization; don't repeat that mistake for species theming.
