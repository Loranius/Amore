import type { UserName } from '@/types';

const GENITIVE: Partial<Record<UserName, string>> = {
  Діма: 'Діми',
  Лєна: 'Лєни',
};

/**
 * Використовуємо відоме відмінювання для чинних імен, а для майбутніх
 * користувачів завжди показуємо фактичне ім'я без загального fallback.
 */
export function partnerGenitive(name: string): string {
  return GENITIVE[name as UserName] ?? name;
}

export function partnerWishlistTitle(name: string): string {
  return `Бажання ${partnerGenitive(name)}`;
}
