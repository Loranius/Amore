// ============================================================
// useNotifications — actionable proposals + persistent event inbox
// ------------------------------------------------------------
// Pending dates/goals remain computed from their domain state. Wishlist events
// are persisted server-side, deduplicated and read through privacy-safe RPCs.
// ============================================================
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useDatePlans } from '@/features/schedule/useDates';
import { useGoals, fmtMoney } from '@/features/budget/useBudget';
import { qk } from '@/lib/queryKeys';
import {
  fetchAppNotifications,
  fetchUnreadNotificationCount,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from './notificationsRpc';

export interface PendingNotification {
  kind: 'date' | 'goal';
  id: number;
  title: string;
  detail: string;
  proposedBy: string;
}

export function useNotifications() {
  const me = useCurrentUser();
  const client = useQueryClient();
  const { data: dates = [] } = useDatePlans();
  const { data: goals = [] } = useGoals();

  const items = useMemo<PendingNotification[]>(() => {
    const pendingDates: PendingNotification[] = dates
      .filter((date) => date.status === 'pending' && date.proposed_by !== me.name)
      .map((date) => ({
        kind: 'date',
        id: date.id,
        title: date.title,
        detail: `📅 ${date.date}${date.place ? ' · ' + date.place : ''}`,
        proposedBy: date.proposed_by,
      }));

    const pendingGoals: PendingNotification[] = goals
      .filter((goal) => goal.status === 'pending' && goal.proposed_by !== me.name)
      .map((goal) => ({
        kind: 'goal',
        id: goal.id,
        title: goal.name,
        detail: goal.target_amount ? `🎯 ${fmtMoney(goal.target_amount)}` : '🎯 Спільна ціль',
        proposedBy: goal.proposed_by ?? '',
      }));

    return [...pendingDates, ...pendingGoals];
  }, [dates, goals, me.name]);

  const feedQuery = useQuery({
    queryKey: qk.notificationsFeed(),
    queryFn: () => fetchAppNotifications(40),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const unreadQuery = useQuery({
    queryKey: qk.notificationsUnread(),
    queryFn: fetchUnreadNotificationCount,
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  const refreshInbox = () =>
    client.invalidateQueries({ queryKey: qk.notifications() });

  const markRead = useMutation({
    mutationFn: markAppNotificationRead,
    onSuccess: refreshInbox,
  });

  const markAllRead = useMutation({
    mutationFn: markAllAppNotificationsRead,
    onSuccess: refreshInbox,
  });

  const unreadCount = unreadQuery.data ?? 0;

  return {
    items,
    events: feedQuery.data ?? [],
    unreadCount,
    count: items.length + unreadCount,
    isEventsPending: feedQuery.isPending,
    isEventsError: feedQuery.isError,
    refetchEvents: feedQuery.refetch,
    markRead,
    markAllRead,
  };
}
