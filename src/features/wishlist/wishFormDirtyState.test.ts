import { describe, expect, it } from 'vitest';
import { hasUnsavedWishChanges, type WishFormDraftSnapshot } from './wishFormDirtyState';

const INITIAL: WishFormDraftSnapshot = {
  scope: 'me',
  title: 'Навушники',
  link: 'https://example.com/item',
  imageUrl: 'https://example.com/image.jpg',
  price: '2500',
  priority: 'high',
  description: 'Чорні',
};

const SNAPSHOT_KEYS: Array<keyof WishFormDraftSnapshot> = [
  'scope',
  'title',
  'link',
  'imageUrl',
  'price',
  'priority',
  'description',
];

describe('hasUnsavedWishChanges', () => {
  it('keeps an untouched form clean', () => {
    expect(hasUnsavedWishChanges(INITIAL, { ...INITIAL }, false)).toBe(false);
  });

  it.each(SNAPSHOT_KEYS)('detects a changed %s field', (key) => {
    expect(
      hasUnsavedWishChanges(
        INITIAL,
        { ...INITIAL, [key]: `${INITIAL[key]}-changed` },
        false,
      ),
    ).toBe(true);
  });

  it('treats a newly selected local photo as an unsaved change', () => {
    expect(hasUnsavedWishChanges(INITIAL, { ...INITIAL }, true)).toBe(true);
  });

  it('becomes clean again after values are reverted', () => {
    const changed = { ...INITIAL, title: 'Інша назва' };
    expect(hasUnsavedWishChanges(INITIAL, changed, false)).toBe(true);
    expect(hasUnsavedWishChanges(INITIAL, { ...INITIAL }, false)).toBe(false);
  });
});
