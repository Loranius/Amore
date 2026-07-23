import type { WishlistStatus } from './wishlistRpc';

export type WishCardContext = 'me' | 'partner' | 'shared';
export type WishCardStatusTone = 'personal' | 'available' | 'planned' | 'purchased' | 'shared';

export interface WishCardStatusChip {
  label: string;
  tone: WishCardStatusTone;
  icon: string;
}

export function wishCardStatusChip(input: {
  context: WishCardContext;
  completionMode: 'gift' | 'shared';
  status: WishlistStatus;
  reserved: boolean;
  canManageReservation: boolean;
}): WishCardStatusChip | null {
  if (input.completionMode === 'shared' || input.context === 'shared') {
    return { label: 'Разом', tone: 'shared', icon: '♡' };
  }

  if (input.context === 'me') {
    return input.reserved
      ? { label: 'Здійснюється', tone: 'planned', icon: '✦' }
      : { label: 'Моя мрія', tone: 'personal', icon: '♡' };
  }

  if (!input.reserved) {
    return { label: 'Доступне', tone: 'available', icon: '🎁' };
  }

  if (input.canManageReservation && (
    input.status === 'purchased' || input.status === 'preparing_surprise'
  )) {
    return { label: 'Куплено', tone: 'purchased', icon: '✓' };
  }

  if (input.canManageReservation) {
    return { label: 'Заплановано', tone: 'planned', icon: '♡' };
  }

  return { label: 'Здійснюється', tone: 'planned', icon: '✦' };
}
