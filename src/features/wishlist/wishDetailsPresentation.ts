import type { WishCardContext } from './wishCardPresentation';
import type { WishlistItemV3 } from './wishlistRpc';

export function wishlistProductHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

export function resolveWishDetailsContext(
  item: WishlistItemV3,
  isOwn: boolean,
  context?: WishCardContext,
): WishCardContext {
  return context
    ?? (item.completion_mode === 'shared' ? 'shared' : isOwn ? 'me' : 'partner');
}
