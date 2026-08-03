import * as THREE from 'three';
import normalUrl from '@/assets/crystal/crystal-normal.webp';
import surfaceUrl from '@/assets/crystal/crystal-surface.webp';
import veinsUrl from '@/assets/crystal/crystal-veins.webp';

/**
 * The crystal's surface maps.
 *
 * Baked down from a 2048² PBR set the owner supplied as a glTF. Three things
 * were done to it, and each was a decision rather than a conversion:
 *
 * The albedo map was reduced to **greyscale**. It arrived blue-violet, and an
 * albedo map multiplies the material colour — so shipping it in colour would
 * have painted every couple's crystal the same blue and erased the one thing
 * ADR-0004 makes the artifact for. As grey it modulates the earned colour
 * instead of replacing it. It is also lifted off black for the same reason: a
 * map that reached zero would punch holes in the crystal rather than shade it.
 *
 * The metallic-roughness map was **dropped**. ADR-0005 put the shell's
 * roughness in a narrow optical band on purpose, and a map that fought that
 * band would undo the reasoning rather than add to it. The relief is carried by
 * the normal map, which is what actually reads.
 *
 * All four were 2048² PNG — 9.7 MB, against an app that precaches 9.1 MB in
 * total. At 512² WebP the three that survived come to 17 KB together: the
 * pattern is smooth cellular veining, which is exactly what WebP is good at,
 * so almost none of it was information.
 *
 * Loaded once for the whole app. Every crystal in every artifact wears the same
 * mineral, so a per-material load would be the same bytes decoded again.
 *
 * Handed out **per density**, though, and that distinction is not a detail:
 * `repeat` lives on the texture rather than on the material, so a single shared
 * instance gives every body whichever density was written last. The vein and
 * the crystals want deliberately different grain, and with one instance between
 * them the vein silently wore the crystals' — a change to its density moved
 * nothing on screen at all. Clones have their own `repeat` but share `source`,
 * so this costs one more sampler binding and not one more byte of texture.
 */

const cache = new Map<string, CrystalSurfaceTextures>();

export interface CrystalSurfaceTextures {
  /** Greyscale cell pattern; multiplies the body's earned colour. */
  surface: THREE.Texture;
  /** Tangent-space relief. */
  relief: THREE.Texture;
  /** Near-black with bright veins; tinted by the body's own emissive colour. */
  veins: THREE.Texture;
}

/** One decode per map for the whole app; every density clones off these. */
let base: { surface: THREE.Texture; relief: THREE.Texture; veins: THREE.Texture } | null = null;

function decode(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  // The mesh publishes its coordinates in engine units, so a face carries as
  // many cells as it is wide. Repeat has to be on or every face past one unit
  // would clamp to a smear of the map's last row.
  texture.anisotropy = 4;
  return texture;
}

function load(url: string, density: number): THREE.Texture {
  if (base === null) {
    base = {
      surface: decode(surfaceUrl, THREE.SRGBColorSpace),
      relief: decode(normalUrl, THREE.NoColorSpace),
      veins: decode(veinsUrl, THREE.SRGBColorSpace),
    };
  }
  const origin = url === surfaceUrl ? base.surface : url === normalUrl ? base.relief : base.veins;
  // `clone` keeps `source` — the same decoded image, uploaded to the GPU once —
  // and copies only the sampling state, which is precisely the split needed
  // here: shared pixels, private `repeat`.
  const texture = origin.clone();
  texture.repeat.set(density, density);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Returns null where there is no DOM.
 *
 * `TextureLoader` decodes through an `HTMLImageElement`, so it cannot run under
 * the test runner — and the guard is honest rather than a stub: an image is a
 * browser resource, and nothing outside a browser has one. What the tests do
 * check is the published recipe that drives this, which is engine state and
 * runs anywhere.
 */
export function crystalSurfaceTextures(density: number): CrystalSurfaceTextures | null {
  if (typeof document === 'undefined') return null;
  if (!Number.isFinite(density) || density <= 0) return null;
  const key = density.toFixed(6);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const set: CrystalSurfaceTextures = {
    surface: load(surfaceUrl, density),
    relief: load(normalUrl, density),
    veins: load(veinsUrl, density),
  };
  cache.set(key, set);
  return set;
}

/** Test seam: drops the shared textures so a suite can start from nothing. */
export function disposeCrystalSurfaceTextures(): void {
  for (const set of cache.values()) {
    set.surface.dispose();
    set.relief.dispose();
    set.veins.dispose();
  }
  cache.clear();
  base = null;
}
