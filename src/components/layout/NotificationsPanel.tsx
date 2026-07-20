// ============================================================
// NotificationsPanel — «Сповіщення» (усі pending-пропозиції партнера)
// ------------------------------------------------------------
// Той самий modal-overlay/modal-sheet патерн, що Settings/AddEventModal.
// Підтвердити/відхилити — напряму через уже наявні мутації
// (useDateMutations, useGoalMutations) — жодної дублікованої логіки.
// ============================================================
import { useNotifications } from '@/features/notifications/useNotifications';
import { useDateMutations } from '@/features/schedule/useDates';
import { useGoalMutations } from '@/features/budget/useBudget';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { useCurrentUser } from '@/providers/AuthProvider';

const KIND_ICON: Record<string, string> = { date: '💗', goal: '🎯' };

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentUser();
  const { items } = useNotifications();
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Сповіщення</h2>

        {items.length === 0 ? (
          <p className="empty-state">Немає нових пропозицій 💗</p>
        ) : (
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
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
