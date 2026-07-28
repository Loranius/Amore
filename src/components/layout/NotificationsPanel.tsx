// ============================================================
// NotificationsPanel — actionable proposals + event inbox
// ============================================================
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  type PendingNotification,
} from '@/features/notifications/useNotifications';
import { usePlanMutations } from '@/features/plans/usePlans';
import { useGoalMutations } from '@/features/piggybank/useBudget';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { useCurrentUser } from '@/providers/AuthProvider';
import { CalendarIcon, GiftIcon } from '@/components/icons/UiIcon';
import { CameraIcon, HeartIcon, PlansIcon } from '@/components/icons/NavIcon';
import { CheckCircleIcon, TargetIcon } from '@/components/icons/PlanIcon';
import { TogetherIcon } from '@/components/icons/WishIcon';
import type { IconProps } from '@/components/icons/iconBase';
import type { AppNotificationKind } from '@/features/notifications/notificationsRpc';
import type { ReactNode } from 'react';
import '@/features/notifications/notifications.css';

type NotifIcon = (props: IconProps) => ReactNode;

// Значки замість емодзі — того самого набору, що й у розділах, куди
// сповіщення ведуть: план у сповіщенні позначений тим самим, чим
// «Плани» в нижній панелі.
const KIND_ICON: Record<string, NotifIcon> = { plan: PlansIcon, goal: TargetIcon };

const EVENT_ICON: Record<AppNotificationKind, NotifIcon> = {
  wishlist_new_wish: HeartIcon,
  // «Спільне» бажання — ті самі два кільця, що у вкладці вішлиста.
  wishlist_shared_wish: TogetherIcon,
  wishlist_gift_completed: GiftIcon,
  wishlist_gift_memory: CameraIcon,
  // Здійснене СПІЛЬНЕ бажання — окремий значок: інакше воно нічим не
  // відрізнялося б від звичайного подарунка в тому самому списку.
  wishlist_shared_completed: CheckCircleIcon,
  schedule_fill_reminder: CalendarIcon,
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
  const planMutations = usePlanMutations();
  const goalMutations = useGoalMutations();

  if (!open) return null;

  const confirmItem = (item: PendingNotification) => {
    if (item.kind === 'plan') planMutations.confirmPlan.mutate(item.id);
    else goalMutations.confirm.mutate(item.id);
  };

  // Відхилити пропозицію = видалити її. Той самий вибір, що у цілей
  // накопичення: «відхилений план» — це стан, який нікому не потрібен
  // і який довелося б звідусіль відсіювати.
  const rejectItem = (item: PendingNotification) => {
    if (item.kind === 'plan') planMutations.removePlan.mutate(item.id);
    else goalMutations.reject.mutate(item.id);
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
                  onConfirm={() => confirmItem(item)}
                  onReject={() => rejectItem(item)}
                  badge={<span className="goal-status-badge">від {item.proposedBy}</span>}
                  info={
                    <>
                      <span className="notif-item-title">
                        {(() => { const I = KIND_ICON[item.kind]; return I ? <I size={15} /> : null; })()}
                        {item.title}
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
            <div className="notifications-state">Нових подій Wishlist поки немає</div>
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
                      {(() => { const I = EVENT_ICON[event.kind]; return I ? <I size={17} /> : null; })()}
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
