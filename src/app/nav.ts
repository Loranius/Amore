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

/** Ліва пара нижньої навігації (до центральної кнопки «дім»). */
export const BOTTOM_LEFT: NavItem[] = [
  { to: '/wishlist', icon: '♡', label: 'Wishlist' },
  { to: '/budget', icon: '₴', label: 'Finance' },
];

/** Центральна кнопка — головна. */
export const HOME_ITEM: NavItem = { to: '/', icon: '♡', label: 'Home', end: true };

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
  { to: '/us', icon: '💞', label: 'Ми' },
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

/** Сабтаби хабу «Ми» (/us). */
export const US_TABS: NavItem[] = [
  { to: '/us/question', icon: '💬', label: 'Питання дня' },
  { to: '/us/capsule', icon: '💌', label: 'Капсула' },
];
