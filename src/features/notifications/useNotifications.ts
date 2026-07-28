// ============================================================
// useNotifications — actionable proposals + persistent event inbox
// ------------------------------------------------------------
// Пропозиції, що чекають відповіді, рахуються зі стану самих модулів;
// події вішлиста живуть на сервері й читаються через privacy-safe RPC.
//
// Побачення переїхали в «Плани» разом із власною механікою пропозиції
// (`proposed_by` + `confirmed`), тож звідси читається `plans`, а не
// таблиця `dates`. Її екран прибрано, і лишити тут старе джерело
// означало б показувати кнопки, які ведуть у розділ, якого немає.
// ============================================================
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsersMap } from '@/features/_shared/useUsers';
import { usePlans } from '@/features/plans/usePlans';
import { planDateLabel } from '@/features/plans/planModel';
import { useGoals, fmtMoney } from '@/features/piggybank/useBudget';
import { qk } from '@/lib/queryKeys';
import {
  fetchAppNotifications,
  fetchUnreadNotificationCount,
  markAllAppNotificationsRead,
  markAppNotificationRead,
} from './notificationsRpc';

interface PendingNotificationBase {
  title: string;
  detail: string;
  proposedBy: string;
}

export type PendingNotification =
  | (PendingNotificationBase & { kind: 'plan'; id: number })
  | (PendingNotificationBase & { kind: 'goal'; id: string });

export function useNotifications() {
  const me = useCurrentUser();
  const client = useQueryClient();
  const users = useUsersMap();
  const { data: plans = [] } = usePlans();
  const { data: goals = [] } = useGoals();

  const items = useMemo<PendingNotification[]>(() => {
    const pendingPlans: PendingNotification[] = plans
      // Пропозиція — це план, який ХТОСЬ запропонував і який ще не
      // підтверджено. План без `proposed_by` створений спільно й
      // нікого ні про що не питає, тому сюди не потрапляє.
      .filter((plan) => !plan.confirmed && plan.proposed_by !== null && plan.proposed_by !== me.id)
      .map((plan) => {
        const date = planDateLabel(plan);
        return {
          kind: 'plan' as const,
          id: plan.id,
          title: plan.title,
          detail: [date, plan.location_name].filter(Boolean).join(' · ') || 'Без дати',
          proposedBy: users[plan.proposed_by!] ?? '',
        };
      });

    const pendingGoals: PendingNotification[] = goals
      .filter((goal) => goal.status === 'pending' && goal.proposed_by !== me.name)
      .map((goal) => ({
        kind: 'goal',
        id: goal.id,
        title: goal.name,
        detail: goal.target_amount ? fmtMoney(goal.target_amount) : 'Спільна ціль',
        proposedBy: goal.proposed_by ?? '',
      }));

    return [...pendingPlans, ...pendingGoals];
  }, [plans, goals, users, me.id, me.name]);

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
