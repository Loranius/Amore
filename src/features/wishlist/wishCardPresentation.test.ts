import { describe, expect, it } from 'vitest';
import { wishCardStatusChip } from './wishCardPresentation';

describe('wishCardStatusChip', () => {
  it('uses personal and shared context labels', () => {
    expect(wishCardStatusChip({
      context: 'me',
      completionMode: 'gift',
      status: 'visible',
      reserved: false,
      canManageReservation: false,
    })?.label).toBe('Моя мрія');

    expect(wishCardStatusChip({
      context: 'shared',
      completionMode: 'shared',
      status: 'visible',
      reserved: false,
      canManageReservation: false,
    })?.label).toBe('Разом');
  });

  it('distinguishes available, planned and purchased partner wishes', () => {
    expect(wishCardStatusChip({
      context: 'partner',
      completionMode: 'gift',
      status: 'visible',
      reserved: false,
      canManageReservation: false,
    })?.label).toBe('Доступне');

    expect(wishCardStatusChip({
      context: 'partner',
      completionMode: 'gift',
      status: 'reserved',
      reserved: true,
      canManageReservation: true,
    })?.label).toBe('Заплановано');

    expect(wishCardStatusChip({
      context: 'partner',
      completionMode: 'gift',
      status: 'purchased',
      reserved: true,
      canManageReservation: true,
    })?.label).toBe('Куплено');
  });
});
