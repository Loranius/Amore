# Crystal Rollout Status

The controlled Crystal rollout is implemented behind `?engine=evolution`.

## Data contract

The preview consumes real Amore rows through a client-only orchestration hook:

- personal relationship events;
- completed plans;
- fulfilled wishlist events;
- visited map places;
- memories and their source links;
- bought shopping items.

The Evolution core, module adapters, Species, Growth, Composition, Geometry,
Material and Life layers remain pure and renderer-independent.

Wishlist history uses `get_evolution_wishlist_archive_v1()`, a pair-wide,
read-only sanitized RPC. It returns only stable identity, priority, completion
timestamps and shared scope. It never exposes titles, descriptions, prices,
URLs, media or gift reactions.

## Renderer rollout boundary

- production default: legacy `CrystalScene`;
- explicit preview: `?engine=evolution`;
- preview failure: automatic fallback to legacy `CrystalScene`;
- WebGL unavailable: existing SVG fallback;
- transmission remains permanently disabled.

## Geometry and composition acceptance

The accepted preview includes:

- one sharp faceted mother crystal as the focal body;
- shallow event-spire, satellite and inclusion generations;
- species-specific upward direction floors;
- conservative faceted `surfaceRadiusScale` passed through the Universal Growth Engine;
- sealed junctions on all accepted bodies;
- renderer-only centering and fit without mutating Growth or Geometry states;
- material-role quantization and `THREE.BatchedMesh` grouping.

## Measured Pixel 8 Pro preview

Headless Pixel 8 Pro profile with reduced motion and low quality tier:

- 36 Growth bodies;
- 699 rendered triangles;
- 5 measured WebGL draw calls;
- approximately 44.9 ms deterministic pipeline build;
- no white transparent-canvas rectangle;
- no fallback to the legacy renderer;
- accepted full-home framing and navigation layout.

## Validation

Completed successfully:

1. strict TypeScript;
2. full unit and integration test suite;
3. sealed-junction and append-only geometry tests;
4. production GitHub Pages build;
5. PWA and base-path verification;
6. Pixel 8 Pro visual preview;
7. measured WebGL draw-call and triangle acceptance;
8. manual inspection of the crystal-only and full-home screenshots.

The preview is ready for review. It does not become the production renderer
until the stacked Evolution PRs reach `main` and rollout is explicitly approved.
