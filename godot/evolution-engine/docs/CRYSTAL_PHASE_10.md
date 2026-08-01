# Crystal Phase 10 — Visual polish and presentation acceptance

Phase 10 converts the technically accepted Phase 9 Crystal into a coherent mobile presentation without changing Artifact DNA, Evolution Events, append-only history, hierarchy, colony membership or collision decisions.

## Accepted visual direction

The Crystal must read as one naturally grown mineral artifact:

- one dominant focal Crystal;
- asymmetrical default presentation;
- dense and sparse zones with visible negative space;
- buried and shared bases rather than detached pieces;
- segmented mineral colour families instead of one flat purple material;
- cloudy or darker lower growth and clearer, brighter terminations;
- real lighting and reflections as the primary source of readability;
- emission and glow only as restrained accents.

Phase 10 keeps opaque Compatibility-renderer sorting. It does not claim true transmission, refraction or volumetric absorption; those remain future optical work and must not be simulated with unstable transparent overlap on the current Web target.

## Deterministic visual profile

`crystal_visual_profile.gd` owns renderer-only presentation choices:

- amethyst violet for the mother;
- sapphire, aqua, seafoam, amber and rose families for supporting growth;
- semantic mapping from expansion, internal density, polishing, structural and luminosity pressure;
- stable identity-based colours for DNA basal growth;
- base-to-tip cloudy, mineral and glass-like colour progression;
- bounded per-facet variation;
- deterministic default yaw and tilt from the DNA seed.

The profile consumes canonical metadata but never writes to it.

## Geometry projection polish

The Crystal mesh retains the accepted root, direction, radius, length and termination. Phase 10 adds one renderer profile ring between the waist and shoulder and applies a bounded mother-only visual taper. This removes the flat cylindrical read while preserving full height and canonical lateral bounds.

Vertex colours now interpolate through:

```text
cloudy embedded base
  → saturated mineral body
  → polished shoulder
  → pale reflective termination
```

No per-frame mesh rebuild is introduced.

## Foundation and framing

- the separate scene Floor plane is removed;
- the low-profile Phase 5 foundation remains part of the mineral artifact, not a pedestal;
- the foundation uses a darker, rougher, low-emission mineral treatment;
- the artifact floats in the empty scene with a small vertical offset;
- portal payloads hide the internal Godot debug panel;
- the default camera uses a narrower mobile field of view and an oblique starting angle;
- the scene retains exactly one key light and two bounded fills;
- the background uses a dark charcoal/slate procedural Sky rather than pure black.

## Mobile budgets

- exactly three presentation lights;
- maximum individual light energy: 1.2;
- Sky radiance remains at the accepted low resolution;
- glow intensity maximum: 0.22;
- opaque Crystal material;
- Crystal roughness remains 0.20–0.35;
- Crystal clearcoat remains 0.25–0.65;
- Crystal emission remains at or below 0.03;
- foundation roughness remains 0.42–0.50;
- foundation emission remains at or below 0.008;
- no particles, additional lights, animated transparency or post-process material stack.

## Before and after acceptance

The Phase 9 baseline is the Pixel 8 Pro browser proof generated from commit:

`28bdd4960998bae82ddf10ad1e2779ffaeb1ebe9`

Baseline screenshot:

`godot-react-bridge-pixel-8-pro.png`

Phase 10 must produce a new Pixel 8 Pro browser proof and be reviewed against the baseline for:

1. removal of the visible floor and large cast-shadow plane;
2. reduced central-cylinder appearance;
3. clearer base-to-tip material depth;
4. at least four readable mineral colour families in semantic fixtures;
5. stronger asymmetry and negative space from the default camera;
6. darker integrated foundation rather than a separate support;
7. no new seams, black collars or broken roots;
8. unchanged full-motion and reduced-motion bridge acceptance.

## Automated acceptance gates

`visual_polish_smoke.gd` validates:

1. deterministic visual profile and start angle;
2. semantic palette diversity;
3. vertex colour variation;
4. opaque material sorting and prior material bounds;
5. darker foundation material within existing budgets;
6. absence of a Floor node;
7. floating artifact framing;
8. camera field-of-view bounds;
9. restrained environment glow and exposure;
10. exactly three bounded lights.

The phase is complete only after parser/import, every prior smoke test, the new visual smoke, Web export, full-motion browser proof, reduced-motion browser proof and manual before/after review all pass.
