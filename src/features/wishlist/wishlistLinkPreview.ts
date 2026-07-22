import { supabase } from '@/lib/supabase';

export interface WishlistLinkPreviewData {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  siteName: string | null;
  resolvedUrl: string;
}

export type WishlistLinkPreviewResult =
  | ({ ok: true } & WishlistLinkPreviewData)
  | {
      ok: false;
      error:
        | 'invalid_url'
        | 'blocked_url'
        | 'fetch_failed'
        | 'unsupported_content'
        | 'response_too_large'
        | 'no_metadata';
    };

export async function fetchWishlistLinkPreview(
  url: string,
): Promise<WishlistLinkPreviewResult> {
  const { data, error } = await supabase.functions.invoke<WishlistLinkPreviewResult>(
    'wishlist-link-preview',
    { body: { url } },
  );

  if (error) throw error;
  if (!data) throw new Error('Wishlist link preview returned an empty payload');
  return data;
}
