// ============================================================
// PlanArchiveModal — деталі виконаного плану (порт openPlanArchiveModal)
// ------------------------------------------------------------
// Читає metadata напряму (без регулярок). Тривалість рахується від
// дати плану до done_at.
// ============================================================
import { useEffect } from 'react';
import { PLAN_CATS, planMetadataOf, formatUaDate, MONTHS } from './calendarUtils';
import type { EventRow } from '@/types';

function durationLabel(fromISO: string, toISO: string): string {
  const diffDay = Math.max(
    0,
    Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000),
  );
  if (diffDay === 0) return 'Виконано в той самий день';
  if (diffDay === 1) return 'Виконано за 1 день';
  if (diffDay < 30) return `Виконано за ${diffDay} днів`;
  if (diffDay < 365) return `Виконано за ${Math.floor(diffDay / 30)} міс.`;
  return `Виконано за ${Math.floor(diffDay / 365)} р. ${Math.floor((diffDay % 365) / 30)} міс.`;
}

export function PlanArchiveModal({ ev, onClose }: { ev: EventRow; onClose: () => void }) {
  const meta = planMetadataOf(ev);
  const cat = PLAN_CATS[meta.cat];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doneStr = meta.done_at
    ? `${new Date(meta.done_at).getDate()} ${MONTHS[new Date(meta.done_at).getMonth()]} ${new Date(meta.done_at).getFullYear()} р.`
    : '—';

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet plan-archive-modal" role="dialog" aria-modal="true">
        <div className="plan-archive-header" style={{ background: cat.gradient }}>
          <span className="plan-archive-cat-icon">{cat.icon}</span>
          <div>
            <div className="plan-archive-cat-label">{cat.label}</div>
            <div className="plan-archive-title">{ev.title}</div>
          </div>
          <span className="plan-archive-done-badge">✅ Виконано</span>
        </div>

        <div className="plan-archive-body">
          {ev.description && <div className="plan-archive-note">{ev.description}</div>}
          <div className="plan-archive-meta-row">
            <div className="plan-archive-meta-item">
              <div className="plan-archive-meta-label">📅 Дата плану</div>
              <div className="plan-archive-meta-val">{formatUaDate(ev.date)}</div>
            </div>
            <div className="plan-archive-meta-item">
              <div className="plan-archive-meta-label">🏁 Виконано</div>
              <div className="plan-archive-meta-val">{doneStr}</div>
            </div>
          </div>
          {meta.done_at && (
            <div className="plan-archive-duration">{durationLabel(ev.date, meta.done_at)}</div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
