import { freshSeed } from '@/lib/entropy';
export interface WishlistPolaroidPlacement {
  rotate: number;
  x: number;
  y: number;
  tapeRotate: number;
}

/** Свіжий seed розкладки полароїдів. Спільне джерело — `freshSeed`. */
export const freshWishlistPolaroidSeed = freshSeed;

export function wishlistPolaroidLayout(
  seed: number,
  id: number,
  index: number,
): WishlistPolaroidPlacement {
  let hash = 2166136261;
  const value = `${seed}:${id}:${index}`;

  for (let offset = 0; offset < value.length; offset += 1) {
    hash ^= value.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;

  const direction = (hash & 1) === 0 ? -1 : 1;
  return {
    rotate: ((hash >>> 1) & 1) === 0 ? -4 : 4,
    x: direction * (10 + ((hash >>> 4) % 19)),
    y: ((hash >>> 9) % 17) - 8,
    tapeRotate: ((hash >>> 14) % 7) - 3,
  };
}
