// Вибір вигляду архіву. Логіка читання/запису — у спільному
// `_shared/viewPreference`; тут лишається лише конфігурація архіву.
import {
  normalizeView,
  readViewPreference,
  writeViewPreference,
  type ViewPreferenceConfig,
} from '@/features/_shared/viewPreference';

export type WishlistArchiveViewMode = 'bubbles' | 'feed' | 'polaroid';
export type WishlistArchiveScope = 'personal' | 'shared';

const CONFIG: ViewPreferenceConfig<WishlistArchiveViewMode> = {
  storageKey: 'amore:wishlist:archive-view-modes:v1',
  modes: ['bubbles', 'feed', 'polaroid'],
  fallback: 'bubbles',
  aliases: { table: 'feed' },
};

export function normalizeWishlistArchiveView(value: unknown): WishlistArchiveViewMode | null {
  return normalizeView(CONFIG, value);
}

export function readWishlistArchiveView(scope: WishlistArchiveScope): WishlistArchiveViewMode {
  return readViewPreference<WishlistArchiveViewMode, WishlistArchiveScope>(CONFIG, scope);
}

export function writeWishlistArchiveView(
  scope: WishlistArchiveScope,
  view: WishlistArchiveViewMode,
): void {
  writeViewPreference<WishlistArchiveViewMode, WishlistArchiveScope>(CONFIG, scope, view);
}

export function freshArchivePolaroidSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] ?? Date.now();
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function archivePolaroidLayout(seed: number, id: number, index: number) {
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
    x: direction * (8 + ((hash >>> 4) % 17)),
    y: ((hash >>> 9) % 15) - 7,
    tapeRotate: ((hash >>> 14) % 7) - 3,
  };
}
