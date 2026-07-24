import { WISHLIST_BUBBLE_TEXTURE_PART_1 } from './wishlistBubbleTexturePart1';
import { WISHLIST_BUBBLE_TEXTURE_PART_2 } from './wishlistBubbleTexturePart2';

/**
 * Soap-film texture extracted from the uploaded "soap-bubble" GLB by honoreo.
 * Source: https://sketchfab.com/3d-models/soap-bubble-893be3cf512848ba842912b7c61566b1
 * License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
 *
 * The original 4096px JPEG is resized to 256px because Wishlist bubbles render
 * at no more than 174px. Geometry is generated locally as a clean UV sphere,
 * avoiding a large binary asset while preserving the model's visible material.
 */
export const WISHLIST_BUBBLE_TEXTURE_URL = `data:image/jpeg;base64,${[
  WISHLIST_BUBBLE_TEXTURE_PART_1,
  WISHLIST_BUBBLE_TEXTURE_PART_2,
].join('')}`;
