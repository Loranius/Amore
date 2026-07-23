import { describe, expect, it } from 'vitest';
import { partnerGenitive, partnerWishlistTitle } from './partnerLabel';

describe('partner wishlist title', () => {
  it('uses Лєна when Діма is signed in', () => {
    expect(partnerWishlistTitle('Лєна')).toBe('Бажання Лєни');
  });

  it('uses Діма when Лєна is signed in', () => {
    expect(partnerWishlistTitle('Діма')).toBe('Бажання Діми');
  });

  it('keeps a future unknown user name instead of a generic partner fallback', () => {
    expect(partnerGenitive('Олексій')).toBe('Олексій');
    expect(partnerWishlistTitle('Олексій')).toBe('Бажання Олексій');
  });
});
