import { supabase } from '@/lib/supabase';
import { createGiftMemorySignedUrl } from './giftMemory';
import { isAmbiguousWishlistTransportError } from './wishlistFailurePolicy';
import { WishlistCreateRequestTracker } from './wishlistCreateIdempotency';
import { WishlistQuickCompletionTracker } from './wishlistQuickCompletion';
import { registerWishlistProcessedRows } from './wishlistProcessedImageRegistry';
import type { WishlistImageDisplayMode } from './wishlistImageModes';
import type { WishlistImagePreference } from './wishlistImagePreference';
import type { WishlistItemRow } from '@/types';

export type WishlistStatus =
  | 'created'
  | 'visible'
  | 'reserved'
  | 'purchased'
  | 'preparing_surprise'
  | 'gifted'
  | 'archived';

export type WishlistCompletionMode = 'gift' | 'shared';
export type WishlistArchiveScope = 'personal' | 'shared';

export interface WishlistItemV3 extends WishlistItemRow {
  processed_image_url: string | null;
  image_mode: WishlistImageDisplayMode | null;
  image_preference: WishlistImagePreference;
  image_processing_revision: number;
  status: WishlistStatus;
  archived_at: string | null;
  version: number;
  can_edit: boolean;
  can_delete: boolean;
  can_move: boolean;
  can_reserve: boolean;
  can_complete: boolean;
  completion_mode: WishlistCompletionMode;
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
  image_preference: WishlistImagePreference;
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
const quickCompletionTracker = new WishlistQuickCompletionTracker();

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

async function callNumber(fn: string, args: Record<string, unknown>): Promise<number> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  const value = Number(data);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fn} RPC returned an invalid numeric payload`);
  }
  return value;
}

function mutationArgs(payload: WishlistMutationPayload): Record<string, unknown> {
  return {
    p_title: payload.title,
    p_description: payload.description,
    p_link: payload.link,
    p_image_url: payload.image_url,
    p_price: payload.price,
    p_priority: payload.priority,
    p_image_preference: payload.image_preference,
  };
}

async function hydrateArchiveRows(
  data: unknown,
  label: string,
): Promise<GiftMemoryArchiveItem[]> {
  const rows = assertRows<GiftMemoryArchiveRpcRow>(data, label);
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
  const rows = assertRows<WishlistItemV3>(data, 'Wishlist');
  registerWishlistProcessedRows(rows);
  return rows;
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
  return hydrateArchiveRows(data, 'Wishlist archive');
}

export async function fetchSharedWishlistArchiveV3(): Promise<GiftMemoryArchiveItem[]> {
  const { data, error } = await rpc('get_shared_wishlist_archive_v3');
  if (error) throw new Error(error.message);
  return hydrateArchiveRows(data, 'Shared Wishlist archive');
}

export async function createWishlistItem(input: {
  payload: WishlistMutationPayload;
  ownerId: number;
  shared: boolean;
}): Promise<number> {
  const tracked = createRequestTracker.acquire(input);

  try {
    const wishId = await callNumber('create_wishlist_item_idempotent_v4', {
      p_request_id: tracked.requestId,
      ...mutationArgs(input.payload),
      p_owner_id: input.ownerId,
      p_is_shared: input.shared,
    });
    createRequestTracker.release(tracked.key);
    return wishId;
  } catch (error) {
    if (isAmbiguousWishlistTransportError(error)) {
      throw new Error('wishlist_create_retry_safe');
    }

    createRequestTracker.release(tracked.key);
    throw error;
  }
}

export async function updateWishlistItem(
  wishId: number,
  expectedVersion: number,
  payload: WishlistMutationPayload,
): Promise<void> {
  await callVoid('update_wishlist_item_collaborative_v4', {
    p_wish_id: wishId,
    p_expected_version: expectedVersion,
    ...mutationArgs(payload),
  });
}

export async function setWishlistImagePreference(input: {
  wishId: number;
  sourceImageUrl: string;
  imagePreference: WishlistImagePreference;
  forceReprocess?: boolean;
}): Promise<number> {
  return callNumber('set_wishlist_image_preference_v3', {
    p_wish_id: input.wishId,
    p_source_image_url: input.sourceImageUrl,
    p_image_preference: input.imagePreference,
    p_force_reprocess: input.forceReprocess ?? false,
  });
}

export async function setWishlistProcessedImage(input: {
  wishId: number;
  sourceImageUrl: string;
  processedImageUrl: string | null;
  imageMode: WishlistImageDisplayMode;
}): Promise<void> {
  await callVoid('set_wishlist_processed_image_v3', {
    p_wish_id: input.wishId,
    p_source_image_url: input.sourceImageUrl,
    p_processed_image_url: input.processedImageUrl,
    p_image_mode: input.imageMode,
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

/** Legacy compatibility. New UI completes directly from purchased. */
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

export async function completeWishlistGiftWithoutMemory(wishId: number): Promise<void> {
  const idempotencyKey = quickCompletionTracker.acquire(wishId);

  try {
    await completeWishlistGift({
      wishId,
      idempotencyKey,
      reactionPhotoPath: null,
      reactionVideoPath: null,
      comment: null,
    });
    quickCompletionTracker.release(wishId);
  } catch (error) {
    if (!isAmbiguousWishlistTransportError(error)) {
      quickCompletionTracker.release(wishId);
    }
    throw error;
  }
}
