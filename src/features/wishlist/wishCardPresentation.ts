import type { WishIconComponent } from '@/components/icons/WishIcon';
import { SparkIcon } from '@/components/icons/EventIcon';
import { TogetherIcon } from '@/components/icons/WishIcon';
import { CheckCircleIcon, HourglassIcon } from '@/components/icons/PlanIcon';
import { GiftIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import type { WishlistStatus } from './wishlistRpc';

export type WishCardContext = 'me' | 'partner' | 'shared';
export type WishCardStatusTone = 'personal' | 'available' | 'planned' | 'purchased' | 'shared';

export interface WishCardStatusChip {
  label: string;
  tone: WishCardStatusTone;
  /** Компонент, а не вузол: та сама позначка стоїть і в чипі картки,
      і в шапці розгорнутої картки, де вона більша. */
  Icon: WishIconComponent;
}

export function wishCardStatusChip(input: {
  context: WishCardContext;
  completionMode: 'gift' | 'shared';
  status: WishlistStatus;
  reserved: boolean;
  canManageReservation: boolean;
}): WishCardStatusChip | null {
  if (input.completionMode === 'shared' || input.context === 'shared') {
    return { label: 'Разом', tone: 'shared', Icon: TogetherIcon };
  }

  if (input.context === 'me') {
    return input.reserved
      ? { label: 'Здійснюється', tone: 'planned', Icon: SparkIcon }
      : { label: 'Моя мрія', tone: 'personal', Icon: HeartIcon };
  }

  if (!input.reserved) {
    return { label: 'Доступне', tone: 'available', Icon: GiftIcon };
  }

  if (input.canManageReservation && (
    input.status === 'purchased' || input.status === 'preparing_surprise'
  )) {
    return { label: 'Куплено', tone: 'purchased', Icon: CheckCircleIcon };
  }

  if (input.canManageReservation) {
    return { label: 'Заплановано', tone: 'planned', Icon: HourglassIcon };
  }

  return { label: 'Здійснюється', tone: 'planned', Icon: SparkIcon };
}
