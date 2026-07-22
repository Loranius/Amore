export const WISH_STATUSES = [
  'created',
  'visible',
  'reserved',
  'preparing_surprise',
  'gifted',
  'archived',
] as const;

export type WishStatus = (typeof WISH_STATUSES)[number];

export type WishTransitionAction =
  | 'publish'
  | 'reserve'
  | 'cancel_reservation'
  | 'start_preparing'
  | 'complete_gift'
  | 'archive';

const TRANSITIONS: Readonly<
  Record<WishStatus, Partial<Record<WishTransitionAction, WishStatus>>>
> = {
  created: { publish: 'visible' },
  visible: { reserve: 'reserved' },
  reserved: {
    cancel_reservation: 'visible',
    start_preparing: 'preparing_surprise',
  },
  preparing_surprise: { complete_gift: 'gifted' },
  gifted: { archive: 'archived' },
  archived: {},
};

export class InvalidWishTransitionError extends Error {
  constructor(
    public readonly status: WishStatus,
    public readonly action: WishTransitionAction,
  ) {
    super(`Cannot perform ${action} while wish is ${status}`);
    this.name = 'InvalidWishTransitionError';
  }
}

export function canTransitionWish(
  status: WishStatus,
  action: WishTransitionAction,
): boolean {
  return TRANSITIONS[status][action] !== undefined;
}

export function transitionWish(
  status: WishStatus,
  action: WishTransitionAction,
): WishStatus {
  const next = TRANSITIONS[status][action];
  if (!next) throw new InvalidWishTransitionError(status, action);
  return next;
}

export function isWishEditable(status: WishStatus): boolean {
  return status === 'created' || status === 'visible';
}

export function isWishDeletable(status: WishStatus): boolean {
  return status === 'created' || status === 'visible';
}

export function isWishImmutable(status: WishStatus): boolean {
  return status === 'gifted' || status === 'archived';
}
