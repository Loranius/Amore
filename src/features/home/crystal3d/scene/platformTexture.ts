import * as THREE from 'three';
import platformUrl from '@/assets/portal/platform.webp';

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
