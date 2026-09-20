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

/*
 * Ліниво, а не `const rpc = supabase.rpc.bind(supabase)`.
 *
 * Те прив'язування читало властивість клієнта на ІМПОРТІ модуля, тобто
 * будувало клієнт бази ще до першого запиту — і саме воно тримало
 * CI червоним навіть після того, як сам `lib/supabase.ts` став лінивим
 * (ADR-0199). Чотири файли мали цей рядок слово в слово.
 *
 * Тепер властивість береться в мить виклику. Прив'язування до клієнта
 * робить за нас проксі в `lib/supabase.ts`.
 */
const rpc: RpcCaller = (fn, args) => (supabase.rpc as unknown as RpcCaller)(fn, args);

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
