// ============================================================
// ProposalCard — «пропозиція → партнер голосує ✓/✕»
// ------------------------------------------------------------
// Розвиток TintedRow під конкретний повторюваний патерн (спільні
// цілі, побачення, дзвіночок сповіщень): pending/confirmed бейдж +
// кнопки голосування (лише той, кому не належить пропозиція) +
// опційне видалення. info/extraActions — фіче-специфічний вміст
// (назва/опис/прогрес-бар/ціна тощо), решта уніфікована.
// ============================================================
import type { ReactNode } from 'react';
import { TintedRow } from './TintedRow';
import { useConfirm } from '@/providers/ConfirmProvider';

export interface ProposalCardProps {
  pending: boolean;
  info: ReactNode;
  /** Якщо не задано — дефолтний бейдж «⏳ Очікує {партнер}» / «✅ Підтверджено». */
  badge?: ReactNode;
  proposedBy: string;
  meName: string;
  onConfirm: () => void;
  onReject: () => void;
  /** Якщо не задано — кнопки видалення немає (напр. у панелі сповіщень). */
  onDelete?: () => void;
  /** Додатковий вміст у колонці дій ПЕРЕД кнопками голосу (напр. ціна цілі). */
  extraActions?: ReactNode;
  rejectConfirmMessage?: string;
  deleteConfirmMessage?: string;
}

export function ProposalCard({
  pending,
  info,
  badge,
  proposedBy,
  meName,
  onConfirm,
  onReject,
  onDelete,
  extraActions,
  rejectConfirmMessage = 'Відхилити?',
  deleteConfirmMessage = 'Видалити?',
}: ProposalCardProps) {
  const confirmDialog = useConfirm();
  const canVote = pending && proposedBy !== meName;
  const canDelete = !!onDelete && (!pending || proposedBy === meName);
  const partnerGen = meName === 'Діма' ? 'Лєни' : 'Діми';

  return (
    <TintedRow
      pending={pending}
      info={
        <>
          {info}
          {badge ?? (
            pending ? (
              <span className="goal-status-badge">⏳ Очікує {partnerGen}</span>
            ) : (
              <span className="goal-status-badge goal-confirmed">✅ Підтверджено</span>
            )
          )}
        </>
      }
      actions={
        <>
          {extraActions}
          {canVote && (
            <div className="goal-vote-btns">
              <button type="button" className="btn goal-vote-yes" onClick={onConfirm}>
                ✓
              </button>
              <button
                type="button"
                className="btn-secondary goal-vote-no"
                onClick={async () => (await confirmDialog(rejectConfirmMessage)) && onReject()}
              >
                ✕
              </button>
            </div>
          )}
          {canDelete && (
            <button
              type="button"
              className="fin-del-btn"
              onClick={async () => (await confirmDialog(deleteConfirmMessage)) && onDelete!()}
              aria-label="Видалити"
            >
              ×
            </button>
          )}
        </>
      }
    />
  );
}
