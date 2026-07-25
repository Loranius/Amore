export interface WishlistPolaroidPlacement {
  rotate: number;
  x: number;
  y: number;
  tapeRotate: number;
}

export function freshWishlistPolaroidSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] ?? Date.now();
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

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
