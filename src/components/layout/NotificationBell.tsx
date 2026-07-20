// ============================================================
// NotificationBell — плаваюча кнопка-дзвіночок (правий верхній кут)
// ------------------------------------------------------------
// У застосунку немає окремого топ-бару (лише Sidebar/BottomNav),
// тож дзвіночок — fixed-кнопка поверх контенту, видима на всіх
// сторінках і breakpoint'ах. Бейдж = useNotifications().count.
// ============================================================
import { useNotifications } from '@/features/notifications/useNotifications';

export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { count } = useNotifications();

  return (
    <button
      type="button"
      className="notif-bell"
      onClick={onClick}
      aria-label={count > 0 ? `Сповіщення (${count})` : 'Сповіщення'}
    >
      🔔
      {count > 0 && <span className="notif-bell-badge">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}
