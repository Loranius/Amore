// ============================================================
// Вибір вигляду дошки вішлиста — тонка обгортка над спільним механізмом
// (`_shared/viewPreference`). Раніше вся логіка читання/запису жила тут
// і майже дослівно повторювалась у `wishlistArchiveView.ts`.
// Публічний API навмисно не змінився: `WishlistPage` не чіпаємо.
// ============================================================
import {
  normalizeView,
  readViewPreference,
  readViewPreferences,
  useViewPreference,
  writeViewPreference,
  type ViewPreferenceConfig,
  type ViewPreferenceStorage,
} from '@/features/_shared/viewPreference';
import type { WishlistViewMode } from './wishlistBoardView';

export type WishlistTabScope = 'me' | 'partner' | 'shared';
export type WishlistViewPreferences = Record<WishlistTabScope, WishlistViewMode>;

export const WISHLIST_VIEW_STORAGE_KEY = 'amore:wishlist:view-modes:v1';

const CONFIG: ViewPreferenceConfig<WishlistViewMode> = {
  storageKey: WISHLIST_VIEW_STORAGE_KEY,
  modes: ['bubbles', 'feed', 'polaroid'],
  fallback: 'bubbles',
  // 'table' — назва вигляду до перейменування; збережені вибори лишились.
  aliases: { table: 'feed' },
};

export const DEFAULT_WISHLIST_VIEW_PREFERENCES: WishlistViewPreferences = {
  me: CONFIG.fallback,
  partner: CONFIG.fallback,
  shared: CONFIG.fallback,
};

export function normalizeWishlistStoredView(value: unknown): WishlistViewMode | null {
  return normalizeView(CONFIG, value);
}

export function readWishlistViewPreferences(
  storage?: ViewPreferenceStorage | null,
): Partial<WishlistViewPreferences> {
  return readViewPreferences<WishlistViewMode, WishlistTabScope>(CONFIG, storage);
}

export function readWishlistView(
  scope: WishlistTabScope,
  storage?: ViewPreferenceStorage | null,
): WishlistViewMode {
  return readViewPreference<WishlistViewMode, WishlistTabScope>(CONFIG, scope, storage);
}

export function writeWishlistViewPreference(
  scope: WishlistTabScope,
  view: WishlistViewMode,
  storage?: ViewPreferenceStorage | null,
): void {
  writeViewPreference<WishlistViewMode, WishlistTabScope>(CONFIG, scope, view, storage);
}

export function useWishlistViewPreference(
  scope: WishlistTabScope,
): readonly [WishlistViewMode, (view: WishlistViewMode) => void] {
  return useViewPreference<WishlistViewMode, WishlistTabScope>(CONFIG, scope);
}
