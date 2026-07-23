import { supabase } from '@/lib/supabase';

export type AppNotificationKind =
  | 'wishlist_new_wish'
  | 'wishlist_shared_wish'
  | 'wishlist_gift_completed'
  | 'wishlist_gift_memory'
  | 'wishlist_shared_completed';

export interface AppNotification {
  id: number;
  kind: AppNotificationKind;
  title: string;
  body: string | null;
  href: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_name: string | null;
  read_at: string | null;
  created_at: string;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

function notificationRows(data: unknown): AppNotification[] {
  if (!Array.isArray(data)) throw new Error('Notifications RPC returned an invalid payload');
  return data as AppNotification[];
}

export async function fetchAppNotifications(limit = 40): Promise<AppNotification[]> {
  const { data, error } = await rpc('get_app_notifications', { p_limit: limit });
  if (error) throw new Error(error.message);
  return notificationRows(data);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data, error } = await rpc('get_app_notification_unread_count');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function markAppNotificationRead(id: number): Promise<void> {
  const { error } = await rpc('mark_app_notification_read', { p_notification_id: id });
  if (error) throw new Error(error.message);
}

export async function markAllAppNotificationsRead(): Promise<void> {
  const { error } = await rpc('mark_all_app_notifications_read');
  if (error) throw new Error(error.message);
}
