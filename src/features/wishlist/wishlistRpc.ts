import { supabase } from '@/lib/supabase';
import { createGiftMemorySignedUrl } from './giftMemory';
import { isAmbiguousWishlistTransportError } from './wishlistFailurePolicy';
import { WishlistCreateRequestTracker } from './wishlistCreateIdempotency';
import type { WishlistItemRow } from '@/types';

export type WishlistStatus =
  | 'created'
  | 'visible'
  | 'reserved'
  | 'purchased'
  | 'preparing_surprise'
  | 'gifted'
  | 'archived';

export interface WishlistItemV3 extends WishlistItemRow {
  status: WishlistStatus;
  archived_at: string | null;
}

export interface WishlistStatsV3 {
  total: number;
  done: number;
  doneThisYear: number;
  doneThisMonth: number;
}

export interface WishlistMutationPayload {
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  price: number | null;
  priority: WishlistItemRow['priority'];
}

interface GiftMemoryArchiveRpcRow {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  price: number | null;
  priority: WishlistItemRow['priority'];
  fulfilled_at: string | null;
  fulfilled_by: number | null;
  completion_id: number | null;
  completed_at: string | null;
  reaction_photo_path: string | null;
  reaction_video_path: string | null;
  memory_comment: string | null;
}

export interface GiftMemoryArchiveItem extends GiftMemoryArchiveRpcRow {
  reaction_photo_url: string | null;
  reaction_video_url: string | null;
}

export interface CompleteWishlistGiftPayload {
  wishId: number;
  idempotencyKey: string;
  reactionPhotoPath: string | null;
  reactionVideoPath: string | null;
  comment: string | null;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;
const createRequestTracker = new WishlistCreateRequestTracker();

function assertRows<T>(data: unknown, label: string): T[] {
  if (!Array.isArray(data)) throw new Error(`${label} RPC returned an invalid payload`);
  return data as T[];
}

function assertStats(data: unknown): WishlistStatsV3 {
  if (!Array.isArray(data) || data.length !== 1 || typeof data[0] !== 'object' || data[0] === null) {
    throw new Error('Wishlist stats RPC returned an invalid payload');
  }

  const row = data[0] as Record<string, unknown>;
  return {
    total: Number(row.total ?? 0),
    done: Number(row.done ?? 0),
    doneThisYear: Number(row.done_this_year ?? 0),
    doneThisMonth: Number(row.done_this_month ?? 0),
  };
}

async function callVoid(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
}

function mutationArgs(payload: WishlistMutationPayload): Record<string, unknown> {
  return {
    p_title: payload.title,
    p_description: payload.description,
    p_link: payload.link,
    p_image_url: payload.image_url,
    p_price: payload.price,
    p_priority: payload.priority,
  };
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
  return assertRows<WishlistItemV3>(data, 'Wishlist');
}

export async function fetchWishlistStatsV3(): Promise<WishlistStatsV3> {
  const { data, error } = await rpc('get_wishlist_stats_v3');
  if (error) throw new Error(error.message);
  return assertStats(data);
}

export async function fetchFulfilledWishlistV3(
  ownerId: number,
): Promise<GiftMemoryArchiveItem[]> {
  const { data, error } = await rpc('get_fulfilled_wishlist_items_v3', {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);

  const rows = assertRows<GiftMemoryArchiveRpcRow>(data, 'Wishlist archive');
  return Promise.all(
    rows.map(async (row) => {
      const [reactionPhotoUrl, reactionVideoUrl] = await Promise.all([
        createGiftMemorySignedUrl(row.reaction_photo_path),
        createGiftMemorySignedUrl(row.reaction_video_path),
      ]);
      return {
        ...row,
        reaction_photo_url: reactionPhotoUrl,
        reaction_video_url: reactionVideoUrl,
      };
    }),
  );
}

export async function createWishlistItem(input: {
  payload: WishlistMutationPayload;
  ownerId: number;
  shared: boolean;
}): Promise<void> {
  const tracked = createRequestTracker.acquire(input);

  try {
    await callVoid('create_wishlist_item_idempotent_v3', {
      p_request_id: tracked.requestId,
      ...mutationArgs(input.payload),
      p_owner_id: input.ownerId,
      p_is_shared: input.shared,
    });
    createRequestTracker.release(tracked.key);
  } catch (error) {
    // A transport failure may have happened after commit. Keep the same request
    // UUID so the next retry safely returns the already-created wish.
    if (!isAmbiguousWishlistTransportError(error)) {
      createRequestTracker.release(tracked.key);
    }
    throw error;
  }
}

export async function updateWishlistItem(
  wishId: number,
  payload: WishlistMutationPayload,
): Promise<void> {
  await callVoid('update_wishlist_item_v3', {
    p_wish_id: wishId,
    ...mutationArgs(payload),
  });
}

export async function moveWishlistItem(
  wishId: number,
  ownerId: number,
  shared: boolean,
): Promise<void> {
  await callVoid('move_wishlist_item_v3', {
    p_wish_id: wishId,
    p_owner_id: ownerId,
    p_is_shared: shared,
  });
}

export async function softDeleteWishlistItem(wishId: number): Promise<void> {
  await callVoid('soft_delete_wishlist_item_v3', { p_wish_id: wishId });
}

export async function reserveWishlistItem(wishId: number): Promise<void> {
  await callVoid('reserve_wishlist_item', { p_wish_id: wishId });
}

export async function cancelWishlistReservation(wishId: number): Promise<void> {
  await callVoid('cancel_wishlist_reservation', { p_wish_id: wishId });
}

export async function markWishlistPurchased(wishId: number): Promise<void> {
  await callVoid('mark_wishlist_purchased', { p_wish_id: wishId });
}

export async function markWishlistPreparing(wishId: number): Promise<void> {
  await callVoid('mark_wishlist_preparing', { p_wish_id: wishId });
}

export async function completeWishlistGift(payload: CompleteWishlistGiftPayload): Promise<void> {
  const { error } = await rpc('complete_wishlist_gift', {
    p_wish_id: payload.wishId,
    p_idempotency_key: payload.idempotencyKey,
    p_reaction_photo: payload.reactionPhotoPath,
    p_reaction_video: payload.reactionVideoPath,
    p_comment: payload.comment,
  });
  if (error) throw new Error(error.message);
}
