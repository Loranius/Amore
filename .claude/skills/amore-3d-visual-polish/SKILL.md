---
name: amore-3d-visual-polish
description: Lighting, materials, shading, and visual QA for Amore's crystal/tree/reef 3D renderer (Three.js + React Three Fiber). Use this whenever tuning a material, fixing something that "looks flat / plastic / cartoonish / wrong," working toward the painterly stylized reference art, adding rim light / glow / clearcoat / subsurface effects, or whenever you need to actually render and screenshot a 3D body to check a geometry or material change instead of trusting code alone. Also use before claiming any 3D visual change is "done" — this skill has the headless screenshot workflow for verifying it.
---

# Amore 3D Visual Polish

## The target look

Reference art (provided by the product owner, stored in the conversation,
not the repo — ask if you need to see them again) shows a consistent style
across all three species: painterly-but-clean stylized PBR, glossy specular
highlights, soft rim/fresnel lighting, saturated jewel-tone colors, and a
sense of internal glow (crystal) or bioluminescence (reef) or magical energy
(tree's glowing bark veins). It reads as "hextech/fantasy game asset," not
photoreal and not flat-shaded low-poly.

Two different kinds of gap close this distance, and it's worth telling them
apart before changing anything:

- **Geometry gaps** — wrong facet regularity, wrong branch shape, wrong
  coral silhouette. Fix in `amore-3d-geometry`, not here.
- **Shading/material gaps** — flat lighting, missing highlights, no glow,
  visible seams. Fix here.

Chasing a "too regular" complaint with material tweaks (e.g. adding noise
textures to hide a perfectly even lathe) usually fails — fix the geometry
lever first, then polish the material on top of already-good shape.

## What's already implemented (check before assuming a gap)

The material layer here is more sophisticated than it looks from a
screenshot — read the actual files before adding something that already
exists:

- **Crystal** (`src/features/home/crystal3d/material/crystalMaterial.ts`):
  seam-blend materials with three vertex regions (`external`/`seam`/
  `unbound`, per `CAI-REQ-009..010`), per-facet tint variation (real
  minerals don't have perfectly even color face-to-face), flat shading by
  design (not a bug).
- **Reef** (`src/engine/species/reef/materials/reefMaterials.ts`): full PBR
  response per morphotype — `clearcoat`, `clearcoatRoughness`, `sheen`,
  `transmission`, `thickness`, `ior`, `subsurfaceStrength`. This is already
  built for a glossy/wet/translucent coral look; if reef looks flat, check
  whether these values are actually reaching the Three.js material, not
  whether they exist.
- **Tree** (`src/engine/renderer/three/treeMaterials.ts`): bark roughness
  varies per-vertex via a custom `onBeforeCompile` shader injection reading
  a `barkCharacter` attribute — a real technique, not a placeholder. If you
  need the reference art's glowing bark veins, this `onBeforeCompile`
  pattern is exactly where an emissive vein mask would plug in (interpolate
  an emissive multiplier the same way `roughnessFactor` is patched).

## Things worth doing that likely aren't implemented yet

- Rim/fresnel light on the crystal to match the reference's glassy edge
  glow (Three.js `MeshPhysicalMaterial` doesn't have Godot-style `rim_*`
  properties — either fake it with a fresnel term in a custom shader chunk
  via `onBeforeCompile`, same pattern as the tree bark shader, or use
  `iridescence`/a thin clearcoat + strong `envMapIntensity` with a matching
  environment map).
- Contact shadow / ambient occlusion where bodies meet the ground or each
  other — right now colonies can read as "floating" rather than grown from
  a base. Baked vertex AO or SSAO is cheaper than real-time GI here.
- Emissive vein mask for tree bark (see above).
- An actual HDRI/environment map — specular highlights read as "glossy
  plastic" without one, "gem in a cave" with one. Check what
  `EvolutionCrystalPreviewScene.tsx`'s `<Canvas>` currently lights with
  before adding more point lights instead.

## How to actually look at a change (don't skip this)

Passing tests does not mean it looks right. This repo has no dedicated
visual-preview route for isolated geometry testing, so build one on the
fly when you need it:

1. Start the dev server: `npx vite --port 5173 --strictPort` (background
   it; `nohup ... & disown` works in a sandboxed shell where job control is
   unreliable).
2. Write a throwaway HTML+React entry (e.g. `.tmp-visual-check/index.html`
   + `main.tsx`) that imports `buildCrystalMesh`/the relevant mesh builder
   directly, constructs a `THREE.BufferGeometry` from `positions`/
   `normals`/`indices`, and renders it in a bare `<Canvas>` with a couple of
   directional lights — this sidesteps needing real Supabase data or the
   full evolution pipeline. Use a handful of bodies with different
   seeds/archetypes so you can see variety, not just one shape.
3. Screenshot it headless: `playwright-core` (`npm install --no-save
   playwright-core` if not present) launched at
   `/opt/pw-browsers/chromium-*/chrome-linux/chrome` with
   `--enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader
   --use-angle=swiftshader-webgl` (software rendering — no real GPU in a
   sandboxed container). Take at least two angles: the default camera and
   one dragged toward the underside — hidden-face and base-cap bugs hide
   exactly where you don't naturally look.
4. **Actually look at the image with the Read tool before claiming
   success.** A blank or black frame means the render failed, not that
   there's nothing to see.
5. Delete the throwaway harness afterward (`rm -rf .tmp-visual-check`) —
   it's a debugging tool, not a feature.

If the change is genuinely full-pipeline (needs real growth/composition
state), it's more work to fake convincingly — consider whether the
lower-fidelity direct-mesh-builder check above already answers the
question before reconstructing the whole pipeline synthetically.

## Judging the result

Ask specifically:

- Does this read as painterly/stylized, or photoreal, or flat cartoon?
  (Target is the first.)
- Is there a highlight that moves believably with the camera, or does the
  surface look matte/dead?
- Where two bodies meet, is there a visible seam, gap, or shadow break?
- From an unusual angle (underside, oblique), does anything that should be
  hidden peek through?

Don't rate a change against your memory of "roughly what it should look
like" — put the actual before/after screenshots side by side.
