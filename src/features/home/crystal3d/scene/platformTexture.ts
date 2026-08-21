import * as THREE from 'three';
import platformUrl from '@/assets/portal/platform.webp';
import colonnadeUrl from '@/assets/portal/colonnade.webp';
import floorStoneAlbedoUrl from '@/assets/portal/floor-stone-albedo.webp';
import floorStoneNormalUrl from '@/assets/portal/floor-stone-normal.webp';
import floorStoneRoughnessUrl from '@/assets/portal/floor-stone-roughness.webp';

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
  roughness: THREE.Texture;
}

export const PORTAL_FLOOR_TEXTURE_RESOLUTION = 512;
export const PORTAL_FLOOR_MAX_ANISOTROPY = 8;
export const PORTAL_FLOOR_TEXTURE_FILES = [
  'floor-stone-albedo.webp',
  'floor-stone-normal.webp',
  'floor-stone-roughness.webp',
] as const;

/**
 * The floor's clean, mobile-sized PBR set.
 *
 * The previous albedo and normal files had a stretched half-frame baked into
 * the pixels, so no UV change could make them sharp. This CC0 stone set is
 * greyscaled for the same reason as the platform: an albedo map multiplies the
 * material colour, so neutral stone accepts the day or night palette instead
 * of painting both themes beige. Normal and roughness maps stay linear.
 *
 * Wrapped rather than clamped: the top-down UVs run far past one, and clamping
 * would smear the map's last row across the whole floor. Anisotropy is capped
 * at eight: it materially sharpens the shallow mobile camera angle without
 * requesting the desktop maximum on every device.
 */
let tiles: PortalTileTextures | null = null;

export function portalFloorAnisotropy(rendererMaximum: number): number {
  if (!Number.isFinite(rendererMaximum)) return 1;
  return Math.min(
    PORTAL_FLOOR_MAX_ANISOTROPY,
    Math.max(1, Math.floor(rendererMaximum)),
  );
}

function applyFloorSampling(
  textures: PortalTileTextures,
  rendererMaximum: number,
): void {
  const anisotropy = portalFloorAnisotropy(rendererMaximum);
  for (const texture of [textures.albedo, textures.normal, textures.roughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (texture.anisotropy !== anisotropy) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }
}

export function portalTileTextures(rendererMaximumAnisotropy = 4): PortalTileTextures | null {
  if (typeof document === 'undefined') return null;
  if (tiles !== null) {
    applyFloorSampling(tiles, rendererMaximumAnisotropy);
    return tiles;
  }
  const loader = new THREE.TextureLoader();
  const albedo = loader.load(floorStoneAlbedoUrl);
  const normal = loader.load(floorStoneNormalUrl);
  const roughness = loader.load(floorStoneRoughnessUrl);
  albedo.colorSpace = THREE.SRGBColorSpace;
  normal.colorSpace = THREE.NoColorSpace;
  roughness.colorSpace = THREE.NoColorSpace;
  tiles = { albedo, normal, roughness };
  applyFloorSampling(tiles, rendererMaximumAnisotropy);
  return tiles;
}

/** Test seam. */
export function disposePortalTileTextures(): void {
  tiles?.albedo.dispose();
  tiles?.normal.dispose();
  tiles?.roughness.dispose();
  tiles = null;
}

/**
 * The colonnade's stone, greyscaled for the same reason as the rest: it takes
 * the theme's pillar colour instead of bringing its own.
 */
let colonnade: THREE.Texture | null = null;

export function portalColonnadeTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (colonnade !== null) return colonnade;
  const texture = new THREE.TextureLoader().load(colonnadeUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  colonnade = texture;
  return colonnade;
}

/** Test seam. */
export function disposePortalColonnadeTexture(): void {
  colonnade?.dispose();
  colonnade = null;
}
