import { describe, expect, it } from 'vitest';
import {
  InvalidWishTransitionError,
  canTransitionSharedWish,
  canTransitionWish,
  isWishDeletable,
  isWishEditable,
  isWishImmutable,
  transitionSharedWish,
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
    ['purchased', 'complete_gift', 'gifted'],
    ['gifted', 'archive', 'archived'],
  ] satisfies Array<[WishStatus, WishTransitionAction, WishStatus]>) (
    '%s --%s--> %s',
    (from, action, expected) => {
      expect(canTransitionWish(from, action)).toBe(true);
      expect(transitionWish(from, action)).toBe(expected);
    },
  );

  it('keeps the old preparing stage completion-compatible without requiring it', () => {
    expect(transitionWish('purchased', 'start_preparing')).toBe('preparing_surprise');
    expect(transitionWish('preparing_surprise', 'complete_gift')).toBe('gifted');
  });

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

  it('completes a shared wish directly without private gift stages', () => {
    expect(canTransitionSharedWish('visible', 'complete_shared')).toBe(true);
    expect(transitionSharedWish('visible', 'complete_shared')).toBe('archived');

    for (const status of ['created', 'reserved', 'purchased', 'preparing_surprise', 'gifted', 'archived'] as WishStatus[]) {
      expect(canTransitionSharedWish(status, 'complete_shared')).toBe(false);
      expect(() => transitionSharedWish(status, 'complete_shared')).toThrow(InvalidWishTransitionError);
    }
  });

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
