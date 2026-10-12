import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveWishDetailsContext,
  wishlistProductHost,
} from './wishDetailsPresentation';
import type { WishlistItemV3 } from './wishlistRpc';

function testItem(overrides: Partial<WishlistItemV3> = {}): WishlistItemV3 {
  return {
    id: 17,
    owner: 1,
    title: 'Футболка з Макімою',
    description: null,
    link: null,
    image_url: null,
    processed_image_url: null,
    image_mode: null,
    image_preference: 'auto',
    image_processing_revision: 0,
    price: null,
    priority: 'high',
    status: 'active',
    reserved: false,
    reserved_by: null,
    completion_mode: 'gift',
    can_edit: true,
    can_delete: true,
    can_move: true,
    can_reserve: false,
    can_complete: false,
    version: 1,
    ...overrides,
  } as WishlistItemV3;
}

describe('WishDetailsSheet presentation helpers', () => {
  it('resolves the same context for bubble and feed triggers', () => {
    expect(resolveWishDetailsContext(testItem(), true)).toBe('me');
    expect(resolveWishDetailsContext(testItem(), false)).toBe('partner');
    expect(resolveWishDetailsContext(
      testItem({ completion_mode: 'shared' }),
      false,
    )).toBe('shared');
    expect(resolveWishDetailsContext(testItem(), true, 'partner')).toBe('partner');
  });

  it('renders a compact store host without www', () => {
    expect(wishlistProductHost('https://www.example.com/products/17')).toBe('example.com');
    expect(wishlistProductHost('not a url')).toBe('not a url');
  });
});

// ── Одна головна дія на аркуш (ADR-0255) ────────────────────
// Аркуш читається з джерела: тести тут без DOM, а правило — про те, які
// слова й кнопки взагалі існують на аркуші.
describe('аркуш мрії: одна головна дія, решта — у «•••»', () => {
  const source = readFileSync(join(__dirname, 'WishDetailsSheet.tsx'), 'utf8');

  it('головна дія називається за тим, чия мрія', () => {
    expect(source).toContain('Подарую');
    expect(source).toContain('Здійснили');
    expect(source).toMatch(/editIsPrimary[\s\S]*Редагувати/);
  });

  it('банера «Додано до твоєї хмари мрій» і ряду з чотирьох кнопок більше немає', () => {
    expect(source).not.toContain('Додано до твоєї хмари мрій');
    expect(source).not.toContain('wl-cloud-sheet-actions');
    expect(source).not.toContain('Купити');
  });

  it('перенести й видалити — лише в меню', () => {
    const menu = source.slice(source.indexOf('className="wl-cloud-sheet-menu"'));
    expect(menu).toContain('Перенести');
    expect(menu).toContain('Видалити');
    expect(source.match(/Перенести/g)).toHaveLength(1);
    expect(source.match(/Видалити/g)).toHaveLength(1);
    expect(source).toContain('aria-haspopup="menu"');
  });
});
