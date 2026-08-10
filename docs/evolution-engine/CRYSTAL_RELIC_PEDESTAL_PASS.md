# Crystal Portal — Relic Pedestal Pass

## Scope

Replace the flat stone portal platform with a renderer-only, stepped bronze reliquary beneath the existing relationship crystal. The pass adds dark engraved details, a violet glass light band, and deterministic brushed-metal surface maps while preserving the authoritative crystal, substrate, and child attachments.

## Requirement IDs

- `V7-REQ-011` — the portal adapter remains presentation-only and cannot mutate authoritative engine state.
- `CAI-REQ-001`–`CAI-REQ-012` — preserved by leaving all engine-owned crystal and attachment geometry untouched and keeping the reliquary below the shared ground plane.

## Files and Public Contracts Changed

- `src/features/home/crystal3d/scene/portalRelicPedestal.ts` — new bounded geometry and texture builders for the bronze body, engravings, violet glass, roughness map, and tangent-space normal map.
- `src/features/home/crystal3d/scene/PortalEnvironment.tsx` — renders the reliquary as three merged optical layers and disposes all generated GPU resources.
- `src/features/home/crystal3d/scene/portalScene.ts` — publishes the measured environment budget of 9 draw calls and 14,752 triangles; exposes the relic top and outer radii through the existing dais contract.
- `src/features/home/crystal3d/scene/portalRelicPedestal.test.ts` and `portalScene.test.ts` — cover the ground plane, bounds, draw-layer merging, glow placement, deterministic maps, and exact scene budget.

No engine state, persistence schema, serialized payload, or application API changed.

## Design Notes

- The top metal plane is authored at local `y = 0` and the group is placed at `PORTAL_GROUND_Y`; every crystal keeps its accepted engine position.
- Artifact-dependent scaling applies only on X/Z. The reliquary depth is fixed, so relationship age cannot move the ground plane or camera target.
- A lathed shell and raised rims form the dark-bronze stepped silhouette. Engravings and violet glass are separately merged, producing three pedestal draw calls rather than one mesh per ring or glyph.
- The body uses `MeshPhysicalMaterial` with metalness, controlled roughness, clearcoat, and deterministic 64×64 roughness/normal textures. No asset fetch or runtime randomness is introduced.
- The existing quartz substrate remains visible above the metal and continues to hide accepted crystal base caps.

## Tests Added or Changed

- Added geometry-plane, depth, radius, merged-layer, triangle-bound, light-band, and deterministic texture tests.
- Updated the environment draw-call and exact triangle-budget assertions.
- Re-ran the portal lighting tests to retain the established scene illumination contract.

## Commands Executed

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | TypeScript clean. |
| `npm test -- src/features/home/crystal3d/scene/portalRelicPedestal.test.ts src/features/home/crystal3d/scene/portalScene.test.ts src/features/home/crystal3d/scene/portalLighting.test.ts` | PASS | 47/47 tests. |
| `npm test` | BASELINE FAIL | 1,282/1,283 pass. The unrelated append-only fixture in `constraints.test.ts` fails identically on clean `origin/main` (age-1 events/wishes comparison). |
| `BASE_PATH=/Amore/ npm run build` | PASS | Production/PWA build completes; existing CSS and chunk-size warnings remain. |
| `npm run verify:pages-build` | PASS | GitHub Pages artifact verified for `/Amore/`. |

## Determinism and Fixture Evidence

Both 64×64 material maps are built from coordinate-only formulae and are byte-identical across repeated construction. The environment triangle constant is asserted against the geometry buffers actually rendered. The crystal pipeline and its source fixture are not changed.

## Serialization/Migration Evidence

Not applicable. The pass creates transient Three.js presentation resources only; no stored state or migration surface changed.

## Architecture Boundary Check

The new builders live in `features/home/crystal3d/scene`, consume no engine mutation API, and return only Three.js geometry/texture resources. `PortalEnvironment` mounts them below `CRYSTAL_GROUND_BASELINE` and disposes them on unmount. Engine-owned geometry, attachment records, material bindings, IDs, hashes, and replay order are untouched.

## Remaining Risks

- The execution sandbox blocked Chromium socket creation, so visual acceptance used an offline projection of the actual production crystal, camera, and pedestal buffers. Final device review should confirm PBR response and bloom strength in WebGL.
- The repository-wide append-only fixture failure and existing production-build CSS/chunk warnings remain outside this renderer-only scope.

## Next Safe Task

Open the Home portal on the target mobile and desktop devices, compare the bronze response and violet band against the supplied reference, and tune material constants only if the real environment lighting makes either layer too dark or too bright.
