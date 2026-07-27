import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WishlistBubbleCard } from './WishlistBubbleCard';
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

describe('WishlistBubbleCard', () => {
  it('renders the bubble trigger without details-sheet markup', () => {
    const html = renderToStaticMarkup(
      <WishlistBubbleCard
        item={testItem()}
        seed={0x5eed_1234}
        busy={false}
        detailsOpen={false}
        onOpen={() => undefined}
      />,
    );

    expect(html).toContain('wl-cloud-item');
    expect(html).toContain('wl-cloud-bubble');
    expect(html).toContain('data-priority="high"');
    expect(html).toContain('Футболка з Макімою');
    expect(html).not.toContain('wl-cloud-sheet');
  });
});
