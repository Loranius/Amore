// ============================================================
// НАВІГАЦІЯ — єдине джерело правди (порт розмітки старого index.html)
// ------------------------------------------------------------
// Підписи 1:1 зі старого bottom-nav, desktop-sidebar і more-menu.
// Пункт «Налаштування» тут відсутній навмисно: це не роут-view (у
// старому коді в кнопки не було data-view), а модалка — нею керує
// Layout через локальний стан.
//
// `Icon` — посилання на компонент, а не готовий вузол: той самий пункт
// малюється в чотирьох місцях різного розміру (22px у нижній панелі,
// 26px у центрі й у шторці «Ще», 20px у сайдбарі), тож розмір задає
// місце виклику. Завдяки цьому файл лишається чистими даними без JSX.
// ============================================================
import type { ReactNode } from 'react';
import type { IconProps } from '@/components/icons/iconBase';
import {
  CameraIcon, CartIcon, ClockIcon,
  FilmIcon, GamepadIcon, HeartIcon, MoreIcon, PiggyBankIcon, PlansIcon,
  PotIcon, SettingsIcon, TicketIcon,
} from '@/components/icons/NavIcon';
import { GiftIcon } from '@/components/icons/UiIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';

export type NavIconComponent = (props: IconProps) => ReactNode;

export interface NavItem {
  to: string;
  Icon: NavIconComponent;
  label: string;
  /** end=true → активний лише на точному збігу (для '/'). */
  end?: boolean;
}

/** Значки, які малює не пункт списку, а сама панель. */
export const MORE_ICON: NavIconComponent = MoreIcon;
export const SETTINGS_ICON: NavIconComponent = SettingsIcon;

/** Чи активний пункт навігації для поточного шляху (для NavLink-сумісної підсвітки поза NavLink). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');
}

/** Ліва пара нижньої навігації (до центральної кнопки «дім»). */
export const BOTTOM_LEFT: NavItem[] = [
  // Подарунок, а не серце: серце вже стоїть на «Головній» — сусідньому
  // слоту тієї самої панелі. Той самий значок і в «Спогадах», де ним
  // позначене виконане бажання.
  { to: '/wishlist', Icon: GiftIcon, label: 'Вішлист' },
  // «Плани» замість «Фінансів»: спільні задуми відкривають щодня, а
  // накопичення — раз на кілька тижнів. Одна з п'яти позицій нижньої
  // панелі має належати першому.
  { to: '/plans', Icon: PlansIcon, label: 'Плани' },
];

/** Центральна кнопка — головна. */
export const HOME_ITEM: NavItem = { to: '/', Icon: HeartIcon, label: 'Головна', end: true };

/** Права пара нижньої навігації (після центру, перед «Ще»). */
export const BOTTOM_RIGHT: NavItem[] = [
  { to: '/shopping', Icon: CartIcon, label: 'Покупки' },
];

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Розділи під кнопкою «Ще» (мобільне меню) і в десктоп-сайдбарі, згруповані
 * за частотою використання (лише для легкого візуального розділення в
 * MoreMenu — не нові хаби/роути).
 */
export const MORE_GROUPS: NavGroup[] = [
  {
    label: 'Часто',
    items: [
      { to: '/memories', Icon: CameraIcon, label: 'Спогади' },
      // Календаря тут більше немає: він став вкладкою всередині «Планів», а
      // «Плани» стоять у доці. Лишити його і в меню означало б два входи в
      // те саме місце — і пара вчила б портал двічі.
      { to: '/schedule', Icon: ClockIcon, label: 'Графік' },
      { to: '/media', Icon: FilmIcon, label: 'Вотчліст' },
    ],
  },
  {
    label: 'Ідеї',
    items: [
      { to: '/culinary', Icon: PotIcon, label: 'Кулінарія' },
      { to: '/whereto', Icon: TicketIcon, label: 'Куди піти' },
    ],
  },
  {
    label: 'Інше',
    items: [
      { to: '/piggybank', Icon: PiggyBankIcon, label: 'Скарбничка' },
      { to: '/map', Icon: MapPinIcon, label: 'Наша карта' },
      { to: '/game', Icon: GamepadIcon, label: 'Гра' },
    ],
  },
];

/** Плаский список — для десктоп-сайдбара й похідних (MORE_PREFIXES). */
export const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((g) => g.items);

/** Шляхи, які мають підсвічувати кнопку «Ще» в нижній навігації. */
export const MORE_PREFIXES: string[] = MORE_ITEMS.map((i) => i.to);
