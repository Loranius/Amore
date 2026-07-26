import { describe, expect, it } from 'vitest';
import { canRemoveWishPhotoAfterSaveError } from './wishlistFailurePolicy';

describe('Wishlist failed-save cleanup policy', () => {
  it.each([
    new Error('wish_not_editable'),
    new Error('invalid_wishlist_price'),
    new Error('permission denied for function update_wishlist_item_v3'),
  ])('allows cleanup after confirmed server rejection', (error) => {
    expect(canRemoveWishPhotoAfterSaveError(error)).toBe(true);
  });

  it.each([
    new TypeError('Failed to fetch'),
    new Error('NetworkError when attempting to fetch resource.'),
    new Error('Request timed out'),
    new Error('connection reset by peer'),
    new DOMException('The operation was aborted.', 'AbortError'),
  ])('keeps the file after ambiguous transport failure', (error) => {
    expect(canRemoveWishPhotoAfterSaveError(error)).toBe(false);
  });

  it('keeps the file when the error shape is unknown', () => {
    expect(canRemoveWishPhotoAfterSaveError({ code: 500 })).toBe(false);
  });
});
