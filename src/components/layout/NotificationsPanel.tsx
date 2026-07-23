// ============================================================
// NotificationsPanel — actionable proposals + event inbox
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/features/notifications/useNotifications';
import { useDateMutations } from '@/features/schedule/useDates';
import { useGoalMutations } from '@/features/budget/useBudget';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { AppNotificationKind } from '@/features/notifications/notificationsRpc';
import '@/features/notifications/notifications.css';

const KIND_ICON: Record<string, string> = { date: '💗', goal: '🎯' };

const EVENT_ICON: Record<AppNotificationKind, string> = {
  wishlist_new_wish: '♡',
  wishlist_shared_wish: '🎁',
  wishlist_gift_completed: '✨',
  wishlist_gift_memory: '📸',
};

function eventTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function notificationHref(href: string, id: number, entityId: number | null): string {
  const separator = href.includes('?') ? '&' : '?';
  const params = [`notification=${id}`];
  if (entityId !== null) params.push(`wish=${entityId}`);
  return `${href}${separator}${params.join('&')}`;
}

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const {
    items,
    events,
    unreadCount,
    isEventsPending,
    isEventsError,
    refetchEvents,
    markRead,
    markAllRead,
  } = useNotifications();
  const dateMutations = useDateMutations();
  const goalMutations = useGoalMutations();

  if (!open) return null;

  const confirmItem = (kind: string, id: number) => {
    if (kind === 'date') dateMutations.confirm.mutate(id);
    else goalMutations.confirm.mutate(id);
  };

  const rejectItem = (kind: string, id: number) => {
    if (kind === 'date') dateMutations.remove.mutate(id);
    else goalMutations.remove.mutate(id);
  };

  const openEvent = (
    id: number,
    href: string,
    entityId: number | null,
    unread: boolean,
  ) => {
    if (unread) markRead.mutate(id);
    onClose();
    if (href.startsWith('/')) navigate(notificationHref(href, id, entityId));
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-sheet notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <div className="notifications-heading">
          <div>
            <h2 id="notifications-title" className="modal-title">Сповіщення</h2>
            <p>Пропозиції партнера та важливі оновлення Wishlist.</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="notifications-mark-all"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Прочитати всі
            </button>
          )}
        </div>

        {items.length > 0 && (
          <section className="notifications-section">
            <div className="notifications-section-head">
              <h3>Потребують відповіді</h3>
              <span>{items.length}</span>
            </div>
            <div className="notif-list">
              {items.map((item) => (
                <ProposalCard
                  key={`${item.kind}-${item.id}`}
                  pending
                  proposedBy={item.proposedBy}
                  meName={me.name}
                  onConfirm={() => confirmItem(item.kind, item.id)}
                  onReject={() => rejectItem(item.kind, item.id)}
                  badge={<span className="goal-status-badge">від {item.proposedBy}</span>}
                  info={
                    <>
                      <span className="notif-item-title">
                        {KIND_ICON[item.kind]} {item.title}
                      </span>
                      <span className="notif-item-detail">{item.detail}</span>
                    </>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section className="notifications-section">
          <div className="notifications-section-head">
            <h3>Оновлення Wishlist</h3>
            {unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </div>

          {isEventsPending ? (
            <div className="notifications-state">Завантажуємо оновлення…</div>
          ) : isEventsError ? (
            <div className="notifications-state">
              Не вдалося відкрити сповіщення.
              <br />
              <button type="button" className="btn-secondary" onClick={() => void refetchEvents()}>
                Спробувати ще
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="notifications-state">Нових подій Wishlist поки немає ✨</div>
          ) : (
            <div className="notification-event-list">
              {events.map((event) => {
                const unread = event.read_at === null;
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`notification-event${unread ? ' notification-event--unread' : ''}`}
                    onClick={() => openEvent(event.id, event.href, event.entity_id, unread)}
                  >
                    <span className="notification-event-icon" aria-hidden="true">
                      {EVENT_ICON[event.kind]}
                    </span>
                    <span className="notification-event-content">
                      <strong>{event.title}</strong>
                      {event.body && <small>{event.body}</small>}
                      <span className="notification-event-meta">
                        {event.actor_name && <span>від {event.actor_name}</span>}
                        <time dateTime={event.created_at}>{eventTime(event.created_at)}</time>
                      </span>
                    </span>
                    {unread && <span className="notification-event-dot" aria-label="Непрочитане" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
