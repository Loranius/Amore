// Вибір вигляду архіву. Логіка читання/запису — у спільному
// `_shared/viewPreference`; тут лишається лише конфігурація архіву.
import { freshSeed } from '@/lib/entropy';
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

/**
 * Свіжий seed розкладки архіву.
 *
 * Була третьою дослівною копією тієї самої функції (полароїди вішліста,
 * хмара бажань, архів). Копії не розійшлись лише тому, що їх не встигли
 * змінити.
 */
export const freshArchivePolaroidSeed = freshSeed;

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
