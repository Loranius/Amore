import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  formatWishlistFeedPrice,
  WishlistFeedCard,
  wishlistFeedDescription,
} from './WishlistFeedCard';
import type { WishlistItemV3 } from './wishlistRpc';

function testItem(overrides: Partial<WishlistItemV3> = {}): WishlistItemV3 {
  return {
    id: 17,
    owner: 1,
    title: 'Футболка з Макімою',
    description: 'Чорна футболка з принтом',
    link: null,
    image_url: null,
    processed_image_url: null,
    image_mode: null,
    image_preference: 'auto',
    image_processing_revision: 0,
    price: 1299,
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

describe('WishlistFeedCard', () => {
  it('renders title, description, priority and price as real text nodes', () => {
    const html = renderToStaticMarkup(
      <WishlistFeedCard
        item={testItem()}
        busy={false}
        detailsOpen={false}
        onOpen={() => undefined}
      />,
    );

    expect(html).toContain('Футболка з Макімою');
    expect(html).toContain('Чорна футболка з принтом');
    expect(html).toContain('Жадане');
    expect(html).toContain('1');
    expect(html).toContain('299');
    expect(html).toContain('₴');
    expect(html).not.toContain('data-wish-title');
  });

  it('provides stable fallbacks for missing description and price', () => {
    expect(wishlistFeedDescription('   ')).toBe('Опис не додано');
    expect(formatWishlistFeedPrice(null)).toBe('Ціну не вказано');
  });
});
