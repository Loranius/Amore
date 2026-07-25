import { useCallback, useState } from 'react';
import type { WishlistViewMode } from './wishlistBoardView';

export type WishlistTabScope = 'me' | 'partner' | 'shared';
export type WishlistViewPreferences = Record<WishlistTabScope, WishlistViewMode>;

interface WishlistViewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const WISHLIST_VIEW_STORAGE_KEY = 'amore:wishlist:view-modes:v1';

export const DEFAULT_WISHLIST_VIEW_PREFERENCES: WishlistViewPreferences = {
  me: 'bubbles',
  partner: 'bubbles',
  shared: 'bubbles',
};

export function normalizeWishlistStoredView(value: unknown): WishlistViewMode | null {
  if (value === 'table') return 'feed';
  return value === 'bubbles' || value === 'feed' || value === 'polaroid' ? value : null;
}

function browserStorage(): WishlistViewStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readWishlistViewPreferences(
  storage: WishlistViewStorage | null = browserStorage(),
): Partial<WishlistViewPreferences> {
  if (!storage) return {};

  try {
    const raw = storage.getItem(WISHLIST_VIEW_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const preferences: Partial<WishlistViewPreferences> = {};

    const me = normalizeWishlistStoredView(parsed.me);
    const partner = normalizeWishlistStoredView(parsed.partner);
    const shared = normalizeWishlistStoredView(parsed.shared);

    if (me) preferences.me = me;
    if (partner) preferences.partner = partner;
    if (shared) preferences.shared = shared;

    return preferences;
  } catch {
    return {};
  }
}

export function writeWishlistViewPreference(
  scope: WishlistTabScope,
  view: WishlistViewMode,
  storage: WishlistViewStorage | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(
      WISHLIST_VIEW_STORAGE_KEY,
      JSON.stringify({ ...readWishlistViewPreferences(storage), [scope]: view }),
    );
  } catch {
    // Storage can be unavailable in private mode. The hook still keeps an in-memory value.
  }
}

export function useWishlistViewPreference(
  scope: WishlistTabScope,
): readonly [WishlistViewMode, (view: WishlistViewMode) => void] {
  const [preferences, setPreferences] = useState<WishlistViewPreferences>(() => ({
    ...DEFAULT_WISHLIST_VIEW_PREFERENCES,
    ...readWishlistViewPreferences(),
  }));

  const setView = useCallback((view: WishlistViewMode) => {
    setPreferences((current) => (
      current[scope] === view ? current : { ...current, [scope]: view }
    ));
    writeWishlistViewPreference(scope, view);
  }, [scope]);

  return [preferences[scope], setView] as const;
}
