export type WishlistCloudPriority = 'high' | 'medium' | 'low';

export interface WishlistCloudPriorityPresentation {
  label: 'Жадане' | 'Бажане' | 'Приємне';
  icon: string;
  size: number;
}

export interface WishlistCloudPlacement {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  translateX: number;
  translateY: number;
  rotate: number;
  delay: number;
  duration: number;
  zIndex: number;
}

const PRIORITY_PRESENTATION: Record<WishlistCloudPriority, WishlistCloudPriorityPresentation> = {
  high: { label: 'Жадане', icon: '✦', size: 174 },
  medium: { label: 'Бажане', icon: '♡', size: 116 },
  low: { label: 'Приємне', icon: '❀', size: 78 },
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ranged(hash: number, shift: number, minimum: number, maximum: number): number {
  const range = maximum - minimum + 1;
  return minimum + ((hash >>> shift) % range);
}

export function normalizeWishlistCloudPriority(value: unknown): WishlistCloudPriority {
  if (value === 'high' || value === 'dream') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

export function wishlistCloudPriorityPresentation(
  value: unknown,
): WishlistCloudPriorityPresentation {
  return PRIORITY_PRESENTATION[normalizeWishlistCloudPriority(value)];
}

export function wishlistCloudPlacement(id: number | string, index: number): WishlistCloudPlacement {
  const hash = stableHash(`${id}:${index}`);

  return {
    marginTop: ranged(hash, 0, -8, 18),
    marginRight: ranged(hash, 4, -9, 14),
    marginBottom: ranged(hash, 8, -8, 18),
    marginLeft: ranged(hash, 12, -9, 14),
    translateX: ranged(hash, 16, -10, 10),
    translateY: ranged(hash, 20, -12, 12),
    rotate: ranged(hash, 24, -4, 4),
    delay: (hash % 11) * -0.37,
    duration: 5.2 + (hash % 8) * 0.26,
    zIndex: 1 + (hash % 5),
  };
}
