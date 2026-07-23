import { describe, expect, it } from 'vitest';
import {
  InvalidWishTransitionError,
  canTransitionWish,
  isWishDeletable,
  isWishEditable,
  isWishImmutable,
  transitionWish,
  type WishStatus,
  type WishTransitionAction,
} from './stateMachine';

describe('wishlist v3 state machine', () => {
  it.each([
    ['created', 'publish', 'visible'],
    ['visible', 'reserve', 'reserved'],
    ['reserved', 'cancel_reservation', 'visible'],
    ['reserved', 'mark_purchased', 'purchased'],
    ['purchased', 'start_preparing', 'preparing_surprise'],
    ['preparing_surprise', 'complete_gift', 'gifted'],
    ['gifted', 'archive', 'archived'],
  ] satisfies Array<[WishStatus, WishTransitionAction, WishStatus]>) (
    '%s --%s--> %s',
    (from, action, expected) => {
      expect(canTransitionWish(from, action)).toBe(true);
      expect(transitionWish(from, action)).toBe(expected);
    },
  );

  it.each([
    ['created', 'reserve'],
    ['visible', 'complete_gift'],
    ['reserved', 'start_preparing'],
    ['purchased', 'cancel_reservation'],
    ['preparing_surprise', 'cancel_reservation'],
    ['gifted', 'reserve'],
    ['archived', 'publish'],
  ] satisfies Array<[WishStatus, WishTransitionAction]>) (
    'rejects %s --%s-->',
    (from, action) => {
      expect(canTransitionWish(from, action)).toBe(false);
      expect(() => transitionWish(from, action)).toThrow(InvalidWishTransitionError);
    },
  );

  it('only allows editing and deletion before reservation', () => {
    expect(isWishEditable('created')).toBe(true);
    expect(isWishEditable('visible')).toBe(true);
    expect(isWishEditable('reserved')).toBe(false);
    expect(isWishEditable('purchased')).toBe(false);

    expect(isWishDeletable('created')).toBe(true);
    expect(isWishDeletable('visible')).toBe(true);
    expect(isWishDeletable('purchased')).toBe(false);
    expect(isWishDeletable('preparing_surprise')).toBe(false);
  });

  it('marks gifted history as immutable', () => {
    expect(isWishImmutable('purchased')).toBe(false);
    expect(isWishImmutable('preparing_surprise')).toBe(false);
    expect(isWishImmutable('gifted')).toBe(true);
    expect(isWishImmutable('archived')).toBe(true);
  });
});
