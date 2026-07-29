import { supabase } from '@/lib/supabase';
import type { WishlistItemRow } from '@/types';

export interface WishlistEvolutionArchiveItem {
  id: number;
  priority: WishlistItemRow['priority'];
  fulfilled_at: string | null;
  completed_at: string | null;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

function normalizeRows(data: unknown, label: string): WishlistEvolutionArchiveItem[] {
  if (!Array.isArray(data)) throw new Error(`${label} RPC returned an invalid payload`);

  return data.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return [];
    const row = value as Record<string, unknown>;
    const id = Number(row['id']);
    if (!Number.isSafeInteger(id) || id < 0) return [];
    const priority = row['priority'];
    const normalizedPriority = priority === 'high' || priority === 'medium' || priority === 'low'
      ? priority
      : null;
    return [{
      id,
      priority: normalizedPriority,
      fulfilled_at: typeof row['fulfilled_at'] === 'string' ? row['fulfilled_at'] : null,
      completed_at: typeof row['completed_at'] === 'string' ? row['completed_at'] : null,
    }];
  });
}

/**
 * Uses the existing role-safe archive RPC but intentionally does not create
 * signed photo/video URLs. Evolution needs only identity, priority and dates.
 */
export async function fetchPersonalWishlistEvolutionArchive(
  ownerId: number,
): Promise<WishlistEvolutionArchiveItem[]> {
  const { data, error } = await rpc('get_fulfilled_wishlist_items_v3', {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return normalizeRows(data, 'Wishlist evolution archive');
}

export async function fetchSharedWishlistEvolutionArchive(): Promise<WishlistEvolutionArchiveItem[]> {
  const { data, error } = await rpc('get_shared_wishlist_archive_v3');
  if (error) throw new Error(error.message);
  return normalizeRows(data, 'Shared wishlist evolution archive');
}
