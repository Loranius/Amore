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
  PlanCategory,
  PlanStatus,
  CulinaryDish,
  ShoppingCategory,
} from '@/types';
import { SHOPPING_CATEGORIES } from '@/app/constants';

const USER_NAMES: readonly UserName[] = ['Діма', 'Лєна'];
export function isUserName(v: unknown): v is UserName {
  return typeof v === 'string' && (USER_NAMES as readonly string[]).includes(v);
}

/** Рядок users → AppUser з валідним name (інакше null — не мовчазний каст). */
export function toAppUser(row: { id: number; name: string } | null | undefined): AppUser | null {
  if (!row || !isUserName(row.name)) return null;
  return { id: row.id, name: row.name };
}

const PLAN_CATS: readonly PlanCategory[] = ['date', 'dream', 'trip', 'goal', 'other'];
const PLAN_STATUSES: readonly PlanStatus[] = ['planned', 'active', 'done'];

/**
 * Перевіряє форму jsonb events.metadata. Плани, бекфілені з тегів
 * `[cat:…][status:…]`, мають саме цю структуру; сирі події — null.
 */
export function isPlanMetadata(v: unknown): v is PlanMetadata {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.cat === 'string' &&
    (PLAN_CATS as readonly string[]).includes(m.cat) &&
    typeof m.status === 'string' &&
    (PLAN_STATUSES as readonly string[]).includes(m.status) &&
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
