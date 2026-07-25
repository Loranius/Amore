import { supabase } from '@/lib/supabase';

export interface ManualArchiveGiftPayload {
  requestId: string;
  title: string;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
  price: number | null;
  giftedOn: string;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

export async function createManualArchiveGift(
  payload: ManualArchiveGiftPayload,
): Promise<number> {
  const { data, error } = await rpc('create_manual_wishlist_archive_gift_v1', {
    p_request_id: payload.requestId,
    p_title: payload.title,
    p_gifted_on: payload.giftedOn,
    p_description: payload.description,
    p_link: payload.link,
    p_image_url: payload.imageUrl,
    p_price: payload.price,
  });

  if (error) throw new Error(error.message);
  const value = Number(data);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Manual archive gift RPC returned an invalid payload');
  }
  return value;
}
