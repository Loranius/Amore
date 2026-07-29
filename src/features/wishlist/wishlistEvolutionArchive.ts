import { supabase } from '@/lib/supabase';
import type { WishlistItemRow } from '@/types';

export interface WishlistEvolutionArchiveItem {
  id: number;
  priority: WishlistItemRow['priority'];
  fulfilled_at: string | null;
  completed_at: string | null;
  is_shared: boolean;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

function normalizeRows(data: unknown): WishlistEvolutionArchiveItem[] {
  if (!Array.isArray(data)) throw new Error('Evolution wishlist RPC returned an invalid payload');

  const byId = new Map<number, WishlistEvolutionArchiveItem>();
  for (const value of data) {
    if (typeof value !== 'object' || value === null) continue;
    const row = value as Record<string, unknown>;
    const id = Number(row['id']);
    if (!Number.isSafeInteger(id) || id < 0) continue;
    const priority = row['priority'];
    const normalizedPriority = priority === 'high' || priority === 'medium' || priority === 'low'
      ? priority
      : null;
    byId.set(id, {
      id,
      priority: normalizedPriority,
      fulfilled_at: typeof row['fulfilled_at'] === 'string' ? row['fulfilled_at'] : null,
      completed_at: typeof row['completed_at'] === 'string' ? row['completed_at'] : null,
      is_shared: row['is_shared'] === true,
    });
  }

  return [...byId.values()].sort((left, right) => left.id - right.id);
}

/**
 * Returns the same minimal fulfilled-wishlist event envelope to either member
 * of the current couple. The RPC exposes no titles, descriptions, prices,
 * links, media or private gift-reaction fields.
 */
export async function fetchPairWishlistEvolutionArchive(): Promise<WishlistEvolutionArchiveItem[]> {
  const { data, error } = await rpc('get_evolution_wishlist_archive_v1');
  if (error) throw new Error(error.message);
  return normalizeRows(data);
}
