# Reef Environment — CC0 Habitat and Background Pass

## Purpose

The production reef must read as a living underwater place without allowing a stock model to replace the artifact generated from portal history.

The scene therefore has two explicit layers:

1. the central production coral, built only by Reef Species phases 1–12;
2. a decorative habitat layer with seabed, rocks, water depth, particles, fish and distant silhouettes.

Production identity, colony counts, pressure, geometry budgets and acceptance signatures continue to describe layer 1 only. World-level renderer metrics remain available separately.

## CC0 assets

### Distant coral silhouette

- asset: `Coral Reef Set` by MiniPoly;
- source: <https://poly.pizza/m/74GL45Fvdh>;
- license: CC0 1.0;
- source topology: 8 static meshes, 6,080 triangles;
- shipped GLB: under 450 KB.

At runtime the eight meshes are transformed into a shallow arc and merged into one geometry, one material and one draw call. The result sits behind the central reef inside depth fog. It never contributes colonies or receives portal-event bindings.

### Rock PBR set

- asset: `Coral Stone Wall` by Dimitrios Savva;
- source: <https://polyhaven.com/a/coral_stone_wall>;
- license: CC0;
- maps: diffuse, OpenGL normal and roughness;
- resolution: 1K each;
- shipped format: WebP;
- displacement: omitted.

One cached texture set feeds two shared rough stone materials: near terrain and fog-darkened distant terrain. Anisotropy is capped at 4 for mobile.

The exact source hashes, license URLs and conversion notes live beside the files in `public/models/CORAL_REEF_SET_LICENSE.txt` and `public/textures/reef/LICENSE.txt`.

## Loading and caching

The GLB and PBR maps belong to the lazy reef renderer chunk. They are excluded from PWA precache, so users who select Crystal or Tree do not download them. After the first real reef visit, Workbox stores them in the dedicated `reef-visual-assets` cache for up to 30 days.

## Acceptance

Automated coverage verifies:

- the GLB header and source mesh count;
- the 6,100-triangle ceiling;
- the 450 KB GLB ceiling;
- all three 1K texture files and their 500 KB per-map ceiling;
- both CC0 records;
- one merged backdrop draw call in Pixel 8 Pro acceptance;
- no change to the central reef's seven-draw-call production contract.

The visual browser check still requires a working local Chromium and portal preview data. When that runner is unavailable, full unit coverage, TypeScript, production build, asset parsing and runtime data contracts remain mandatory; the missing screenshot is reported rather than bypassing TLS or inventing acceptance.
