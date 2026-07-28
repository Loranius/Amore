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
  CalendarHeartIcon, CameraIcon, CartIcon, ClockIcon,
  FilmIcon, GamepadIcon, HeartIcon, MoreIcon, PotIcon, SettingsIcon, TicketIcon, WalletIcon,
} from '@/components/icons/NavIcon';
import { CalendarIcon, GiftIcon } from '@/components/icons/UiIcon';
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
  { to: '/budget', Icon: WalletIcon, label: 'Фінанси' },
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
 * MoreMenu — не нові хаби/роути). `/calendar` — хаб із сабтабами.
 */
export const MORE_GROUPS: NavGroup[] = [
  {
    label: 'Часто',
    items: [
      { to: '/memories', Icon: CameraIcon, label: 'Спогади' },
      { to: '/calendar', Icon: CalendarIcon, label: 'Календар' },
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
      { to: '/map', Icon: MapPinIcon, label: 'Наша карта' },
      { to: '/game', Icon: GamepadIcon, label: 'Гра' },
    ],
  },
];

/** Плаский список — для десктоп-сайдбара й похідних (MORE_PREFIXES). */
export const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((g) => g.items);

/** Шляхи, які мають підсвічувати кнопку «Ще» в нижній навігації. */
export const MORE_PREFIXES: string[] = MORE_ITEMS.map((i) => i.to);


/** Сабтаби хабу «Календар» (/calendar). */
export const CALENDAR_TABS: NavItem[] = [
  // Календар із серцем, а не звичайний: звичайний уже позначає сам
  // розділ, і на десктопі обидва видно одночасно — пункт сайдбара й
  // сабтаб під ним.
  { to: '/calendar', Icon: CalendarHeartIcon, label: 'Події', end: true },
  { to: '/calendar/schedule', Icon: ClockIcon, label: 'Графік' },
];
