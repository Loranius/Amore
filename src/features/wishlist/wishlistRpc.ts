import { supabase } from '@/lib/supabase';
import type { WishlistItemRow } from '@/types';

export type WishlistStatus =
  | 'created'
  | 'visible'
  | 'reserved'
  | 'preparing_surprise'
  | 'gifted'
  | 'archived';

export interface WishlistItemV3 extends WishlistItemRow {
  status: WishlistStatus;
  archived_at: string | null;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

function assertRows(data: unknown): WishlistItemV3[] {
  if (!Array.isArray(data)) throw new Error('Wishlist RPC returned an invalid payload');
  return data as WishlistItemV3[];
}

async function callVoid(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
}

export async function fetchWishlistV3(input: {
  ownerId: number | null;
  shared: boolean;
  includeArchived?: boolean;
}): Promise<WishlistItemV3[]> {
  const { data, error } = await rpc('get_wishlist_items_v3', {
    p_owner_id: input.ownerId,
    p_shared: input.shared,
    p_include_archived: input.includeArchived ?? false,
  });
  if (error) throw new Error(error.message);
  return assertRows(data);
}

export async function reserveWishlistItem(wishId: number): Promise<void> {
  await callVoid('reserve_wishlist_item', { p_wish_id: wishId });
}

export async function cancelWishlistReservation(wishId: number): Promise<void> {
  await callVoid('cancel_wishlist_reservation', { p_wish_id: wishId });
}

export async function completeWishlistGift(wishId: number): Promise<void> {
  await callVoid('mark_wishlist_preparing', { p_wish_id: wishId });

  const { error } = await rpc('complete_wishlist_gift', {
    p_wish_id: wishId,
    p_idempotency_key: crypto.randomUUID(),
    p_reaction_photo: null,
    p_reaction_video: null,
    p_comment: null,
  });
  if (error) throw new Error(error.message);
}
