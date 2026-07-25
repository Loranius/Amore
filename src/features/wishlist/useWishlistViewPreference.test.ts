import { describe, expect, it } from 'vitest';
import {
  WISHLIST_VIEW_STORAGE_KEY,
  normalizeWishlistStoredView,
  readWishlistViewPreferences,
  writeWishlistViewPreference,
} from './useWishlistViewPreference';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('wishlist view preference', () => {
  it('migrates the legacy table value to feed', () => {
    expect(normalizeWishlistStoredView('table')).toBe('feed');
  });

  it('ignores malformed and unsupported stored values', () => {
    const malformed = new MemoryStorage();
    malformed.setItem(WISHLIST_VIEW_STORAGE_KEY, '{');
    expect(readWishlistViewPreferences(malformed)).toEqual({});

    const unsupported = new MemoryStorage();
    unsupported.setItem(WISHLIST_VIEW_STORAGE_KEY, JSON.stringify({
      me: 'cards',
      partner: 'feed',
      shared: 17,
    }));
    expect(readWishlistViewPreferences(unsupported)).toEqual({ partner: 'feed' });
  });

  it('stores each Wishlist scope without overwriting the others', () => {
    const storage = new MemoryStorage();

    writeWishlistViewPreference('me', 'feed', storage);
    writeWishlistViewPreference('shared', 'polaroid', storage);

    expect(readWishlistViewPreferences(storage)).toEqual({
      me: 'feed',
      shared: 'polaroid',
    });
  });
});
