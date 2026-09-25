// ============================================================
// GUARDS — runtime-перевірки на межі з БД / зовнішніми API
// ------------------------------------------------------------
// Типи описують очікувану форму; guard'и підтверджують її в
// рантаймі, замість сліпого `as`. Використовуються там, де дані
// приходять «ззовні» (users.name, jsonb metadata, culinary-ai).
// ============================================================
import type {
  UserName,
  AppUser,
  PlanMetadata,
  CulinaryDish,
  ShoppingCategory,
} from '@/types';
import { SHOPPING_CATEGORIES } from '@/app/constants';

/**
 * Найдовше ім'я, яке портал беруть за ім'я.
 *
 * Межа тут не з бази (`users.name` — `text` без обмеження), а з екрана:
 * підпис довший за це не вміщається ні в чипі доріжки «Графіка», ні в
 * кнопці вибору на вході, і замість імені пара побачила б обрізок.
 */
export const USER_NAME_MAX = 32;

/**
 * Рядок із-за межі → ім'я, або `null`.
 *
 * ОДНА ФУНКЦІЯ, А НЕ ПРЕДИКАТ ПЛЮС КАСТ. Тут був `isUserName(v): v is
 * UserName` — предикат, який КАЗАВ «це ім'я», не приводячи його до
 * ладу. З обрізанням це стало б брехнею просто в підписі: `' Лєна '`
 * дало б `true`, а далі в портал пішов би рядок із пробілами. Функція,
 * що повертає нормалізоване значення або `null`, такого сказати не
 * може.
 */
export function asUserName(value: unknown): UserName | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (name.length === 0 || name.length > USER_NAME_MAX) return null;
  return name as UserName;
}

/** Рядок users → AppUser з валідним name (інакше null — не мовчазний каст). */
export function toAppUser(row: { id: number; name: string } | null | undefined): AppUser | null {
  if (!row) return null;
  const name = asUserName(row.name);
  if (name === null) return null;
  return { id: row.id, name };
}

const PLAN_CATS: readonly string[] = ['date', 'dream', 'trip', 'goal', 'other'];
const PLAN_STATUSES: readonly string[] = ['planned', 'active', 'done'];

/**
 * Перевіряє форму jsonb events.metadata. Плани, бекфілені з тегів
 * `[cat:…][status:…]`, мають саме цю структуру; сирі події — null.
 */
export function isPlanMetadata(v: unknown): v is PlanMetadata {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.cat === 'string' &&
    PLAN_CATS.includes(m.cat) &&
    typeof m.status === 'string' &&
    PLAN_STATUSES.includes(m.status) &&
    (m.done_at === null || typeof m.done_at === 'string')
  );
}

/**
 * Мінімальна перевірка відповіді culinary-ai: обов'язкові title +
 * масив ingredients. Відсіює тіла-помилки виду {error:'anthropic 502'},
 * які invokeFn міг повернути з non-2xx (див. supabase.ts).
 */
export function isCulinaryDish(v: unknown): v is CulinaryDish {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.title === 'string' && Array.isArray(d.ingredients);
}

/**
 * Приводить довільне значення (з shopping-parse чи старих рядків БД)
 * до валідної категорії; невідоме → 'Інше'. Так у типізований
 * ShoppingCategory ніколи не потрапляє «чужий» рядок.
 */
export function toShoppingCategory(v: unknown): ShoppingCategory {
  return typeof v === 'string' && (SHOPPING_CATEGORIES as readonly string[]).includes(v)
    ? (v as ShoppingCategory)
    : 'Інше';
}
