import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WishlistPolaroidCard } from './WishlistPolaroidCard';
import type { WishlistItemV3 } from './wishlistRpc';

function testItem(overrides: Partial<WishlistItemV3> = {}): WishlistItemV3 {
  return {
    id: 17,
    owner: 1,
    title: 'Футболка з Макімою',
    description: 'Опис бажання',
    link: null,
    image_url: null,
    processed_image_url: null,
    image_mode: null,
    image_preference: 'auto',
    image_processing_revision: 0,
    price: 1200,
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

describe('WishlistPolaroidCard', () => {
  it('renders real caption text without legacy bubble classes or data text attributes', () => {
    const html = renderToStaticMarkup(
      <WishlistPolaroidCard
        item={testItem()}
        index={0}
        seed={42}
        busy={false}
        detailsOpen={false}
        onOpen={() => undefined}
      />,
    );

    expect(html).toContain('wl-polaroid-card');
    expect(html).toContain('wl-polaroid-card__title');
    expect(html).toContain('Футболка з Макімою');
    expect(html).toContain('Жадане');
    expect(html).not.toContain('wl-cloud-bubble');
    expect(html).not.toContain('wl-board-view-item');
    expect(html).not.toContain('data-wish-title');
  });
});
