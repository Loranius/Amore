import * as THREE from 'three';
import platformUrl from '@/assets/portal/platform.webp';
import tilesUrl from '@/assets/portal/tiles.webp';
import tilesNormalUrl from '@/assets/portal/tiles-normal.webp';

/**
 * The platform's stone.
 *
 * Greyscale, and that is the same decision the crystal's maps got: it arrived
 * as sandstone, and an albedo map multiplies the material colour, so in colour
 * it would have painted the whole podium sand whatever the theme said. As grey
 * it modulates the palette's own dais colour instead of replacing it.
 *
 * Loaded once for the app. Returns null where there is no DOM — `TextureLoader`
 * decodes through an `HTMLImageElement`, and nothing outside a browser has one.
 */
let cache: THREE.Texture | null = null;

export function portalPlatformTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (cache !== null) return cache;
  const texture = new THREE.TextureLoader().load(platformUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache = texture;
  return cache;
}

/** Test seam: drops the shared texture so a suite can start from nothing. */
export function disposePortalPlatformTexture(): void {
  cache?.dispose();
  cache = null;
}

export interface PortalTileTextures {
  albedo: THREE.Texture;
  normal: THREE.Texture;
}

/**
 * The floor's tiles, supplied by the owner.
 *
 * Greyscaled for the same reason the platform's stone was: an albedo map
 * multiplies the material colour, so in colour it would paint the floor its
 * own sandstone whatever the theme says. The normal map keeps its colour — it
 * is a vector, not a hue.
 *
 * Wrapped rather than clamped: the floor lays the pattern out by arc length and
 * radius, so the coordinates run far past one, and clamping would smear the
 * map's last row across the whole ring.
 */
let tiles: PortalTileTextures | null = null;

export function portalTileTextures(): PortalTileTextures | null {
  if (typeof document === 'undefined') return null;
  if (tiles !== null) return tiles;
  const loader = new THREE.TextureLoader();
  const albedo = loader.load(tilesUrl);
  const normal = loader.load(tilesNormalUrl);
  for (const texture of [albedo, normal]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  albedo.colorSpace = THREE.SRGBColorSpace;
  normal.colorSpace = THREE.NoColorSpace;
  tiles = { albedo, normal };
  return tiles;
}

/** Test seam. */
export function disposePortalTileTextures(): void {
  tiles?.albedo.dispose();
  tiles?.normal.dispose();
  tiles = null;
}
