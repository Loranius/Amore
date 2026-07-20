// ============================================================
// useNotifications — зведення pending-пропозицій партнера
// ------------------------------------------------------------
// Дзвіночок показує ЛИШЕ те, що реально потребує підтвердження
// цього користувача: побачення (features/schedule/useDates) і
// спільні цілі (features/budget/useBudget) зі status='pending' і
// proposed_by !== я. Ніякої окремої таблиці notifications — обидва
// джерела вже мають той самий pending/confirmed + proposed_by стан,
// просто зводимо їх в один список для UI.
// ============================================================
import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useDatePlans } from '@/features/schedule/useDates';
import { useGoals, fmtMoney } from '@/features/budget/useBudget';

export interface PendingNotification {
  kind: 'date' | 'goal';
  id: number;
  title: string;
  detail: string;
  proposedBy: string;
}

export function useNotifications() {
  const me = useCurrentUser();
  const { data: dates = [] } = useDatePlans();
  const { data: goals = [] } = useGoals();

  const items = useMemo<PendingNotification[]>(() => {
    const pendingDates: PendingNotification[] = dates
      .filter((d) => d.status === 'pending' && d.proposed_by !== me.name)
      .map((d) => ({
        kind: 'date',
        id: d.id,
        title: d.title,
        detail: `📅 ${d.date}${d.place ? ' · ' + d.place : ''}`,
        proposedBy: d.proposed_by,
      }));

    const pendingGoals: PendingNotification[] = goals
      .filter((g) => g.status === 'pending' && g.proposed_by !== me.name)
      .map((g) => ({
        kind: 'goal',
        id: g.id,
        title: g.name,
        detail: g.target_amount ? `🎯 ${fmtMoney(g.target_amount)}` : '🎯 Спільна ціль',
        proposedBy: g.proposed_by ?? '',
      }));

    return [...pendingDates, ...pendingGoals];
  }, [dates, goals, me.name]);

  return { items, count: items.length };
}
