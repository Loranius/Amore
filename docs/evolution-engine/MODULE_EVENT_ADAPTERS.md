# Evolution Engine — Module Event Adapters

## Purpose

Module adapters translate current Amore records into the species-neutral
`EvolutionEventInput` contract. They do not render anything and do not know
whether the selected artifact is a crystal, tree or coral reef.

The rules are versioned by `EVOLUTION_ADAPTER_RULES_VERSION`. Changing a weight,
a date fallback or an inclusion rule requires a new rules version so existing
artifacts remain reproducible.

## Clock rule

Adapters never call `Date.now()`. The caller must pass an explicit `asOf`
timestamp and IANA time zone. This keeps tests and historical rebuilds stable.
Future records never produce growth.

## Current mapping

### Our calendar events

Included:

- `type = anniversary`;
- only occurrences on or before `asOf`;
- `is_milestone = false` becomes a regular relationship event;
- `is_milestone = true` becomes a strong milestone;
- yearly records produce low-pressure anniversary recurrences.

Excluded:

- birthdays;
- generic/state holidays;
- legacy `other` calendar rows.

Regular events mainly add remembrance and significance. Milestones add the
strongest significance pressure in the current adapter set.

### Plans

Only `status = done` is included.

Date priority:

1. `completed_at` — verified;
2. `end_date` — historical estimate;
3. `start_date` — historical estimate.

A completed plan without any usable date is skipped and reported in adapter
diagnostics.

Category mapping:

- `trip`, `ride`, `place` -> exploration;
- `date`, `rest` -> remembrance and stability;
- `event`, `holiday` -> culture and remembrance;
- `activity`, `learning` -> achievement;
- `home` -> stability;
- unknown categories -> conservative `other` profile plus a diagnostic.

### Wishlist

Only fulfilled wishes are included.

Date priority:

1. `fulfilled_at` — verified;
2. `gift_date` — historical estimate.

High priority increases significance. Shared wishes add a small stability
pressure. Reserved or unfulfilled wishes do not grow the artifact.

### Map

Only places with explicit `visited_at` are included. Ideas, favourites and
restaurant bookmarks without a visit date are ignored.

Visits add exploration and remembrance. A known city/country adds a small
culture pressure, while rating adds a bounded significance adjustment.

### Memories

Each preserved photo creates a small remembrance event. Exact day or camera
`taken_at` dates are verified; broader precision is a historical estimate.

Photos mirrored automatically from wishes, places, goals or calendar events
receive reduced pressure because the originating module already contributes the
main event. This prevents the same moment from growing the artifact twice at
full strength.

### Media

Only finished media entries are included. Their completion state is verified;
when the schema has no dedicated completion timestamp, `created_at` remains an
explicit historical estimate rather than pretending to be an exact watch date.

Finished media contributes bounded culture and remembrance pressure.

## Reef-specific source boundary

Reef Species accepts normalized events only from:

- calendar;
- plans;
- wishlist;
- map;
- memories;
- media.

The source check happens again inside Reef Species before its pressure ledger
is rebuilt. This prevents legacy or future adapters from introducing an
unreviewed indirect influence.

Work Schedule is handled separately from module events. Past dates on which
both partners marked a day off add bounded, year-grouped substrate support;
they do not increase portal activity or Evolution channel pressure.

## Deliberately excluded for now

- game activity;
- culinary and recipe records;
- where-to ideas and bookmarks;
- shopping items;
- piggy-bank balances, transactions and targets;
- current locations and location history;
- financial balance and free-spending limit;
- unfinished plans and ideas;
- unfulfilled wishes;
- birthdays of relatives;
- generic holidays;
- recipes because adding a recipe does not prove a shared experience;
- plan tasks because they are preparation details, not separate relationship
  milestones.

These exclusions can be reconsidered only with stable historical timestamps and
a clear relationship meaning.

## Stable IDs

Examples:

- `calendar:12:origin`
- `calendar:12:year:2026`
- `plan:7:completed`
- `wish:19:fulfilled`
- `place:5:visited`
- `memory:81:preserved`
- `media:44:finished`

IDs depend on persistent row IDs and occurrence dates, never array positions or
database response order.

## Integration boundary

`toEvolutionSourceSnapshot()` maps existing typed Amore rows into the transport-
neutral snapshot. It performs no queries.

A later loader may fetch Supabase tables and call:

```text
Supabase rows
  -> toEvolutionSourceSnapshot
  -> adaptEvolutionSnapshot
  -> buildArtifactBlueprint
  -> ArtifactBlueprint
```

Home artifact renderers consume the resulting blueprint through their own
species adapters; module loaders do not import Three.js or renderer state.
