// ============================================================
// НАВІГАЦІЯ — єдине джерело правди (порт розмітки старого index.html)
// ------------------------------------------------------------
// Іконки/підписи 1:1 зі старого bottom-nav, desktop-sidebar і
// more-menu. Пункт «Налаштування» тут відсутній навмисно: це не
// роут-view (у старому коді в кнопки не було data-view), а модалка —
// нею керує Layout через локальний стан.
// ============================================================

export interface NavItem {
  to: string;
  icon: string;
  label: string;
  /** end=true → активний лише на точному збігу (для '/'). */
  end?: boolean;
}

/** Чи активний пункт навігації для поточного шляху (для NavLink-сумісної підсвітки поза NavLink). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');
}

/** Ліва пара нижньої навігації (до центральної кнопки «дім»). */
export const BOTTOM_LEFT: NavItem[] = [
  { to: '/wishlist', icon: '♡', label: 'Вішлист' },
  { to: '/budget', icon: '₴', label: 'Фінанси' },
];

/** Центральна кнопка — головна. */
export const HOME_ITEM: NavItem = { to: '/', icon: '♡', label: 'Головна', end: true };

/** Права пара нижньої навігації (після центру, перед «Ще»). */
export const BOTTOM_RIGHT: NavItem[] = [
  { to: '/shopping', icon: '🛒', label: 'Покупки' },
];

/**
 * Розділи під кнопкою «Ще» (мобільне меню) і в десктоп-сайдбарі —
 * той самий список. `/calendar` і `/us` — хаби з сабтабами.
 */
export const MORE_ITEMS: NavItem[] = [
  { to: '/calendar', icon: '📅', label: 'Календар' },
  { to: '/media', icon: '🎬', label: 'Вотчліст' },
  { to: '/culinary', icon: '👨‍🍳', label: 'Кулінарія' },
  { to: '/whereto', icon: '🎈', label: 'Куди піти' },
  { to: '/map', icon: '📍', label: 'Наша карта' },
  { to: '/game', icon: '🕹️', label: 'Гра' },
];

/** Шляхи, які мають підсвічувати кнопку «Ще» в нижній навігації. */
export const MORE_PREFIXES: string[] = MORE_ITEMS.map((i) => i.to);


/** Сабтаби хабу «Календар» (/calendar). */
export const CALENDAR_TABS: NavItem[] = [
  { to: '/calendar', icon: '📅', label: 'Події', end: true },
  { to: '/calendar/schedule', icon: '🗓️', label: 'Графік' },
  { to: '/calendar/photos', icon: '📸', label: 'Фото' },
];
