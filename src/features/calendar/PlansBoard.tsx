// ============================================================
// PlansBoard — вкладка «Плани» (порт renderPlans/renderPlanCards)
// ------------------------------------------------------------
// Активні / архів, прогрес, групування за категорією. Категорія й
// статус читаються з metadata (planMetadataOf), без парсингу тегів.
// ============================================================
import { useMemo, useState } from 'react';
import {
  PLAN_CATS,
  PLAN_STATUS,
  PLAN_CAT_ORDER,
  planMetadataOf,
  daysLabel,
  formatUaDate,
} from './calendarUtils';
import { PlanArchiveModal } from './PlanArchiveModal';
import type { EnrichedEvent, PlanMetadata } from '@/types';

type PlansTab = 'active' | 'archive';

interface PlansBoardProps {
  plans: EnrichedEvent[]; // events типу 'other'
  onSetStatus: (id: number, metadata: PlanMetadata) => void;
  onDelete: (id: number) => void;
}

export function PlansBoard({ plans, onSetStatus, onDelete }: PlansBoardProps) {
  const [tab, setTab] = useState<PlansTab>('active');
  const [viewing, setViewing] = useState<EnrichedEvent | null>(null);

  const withMeta = useMemo(
    () => plans.map((ev) => ({ ev, meta: planMetadataOf(ev) })),
    [plans],
  );
  const active = withMeta.filter((p) => p.meta.status !== 'done');
  const archive = withMeta.filter((p) => p.meta.status === 'done');

  const total = plans.length;
  const done = archive.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const markDone = (ev: EnrichedEvent, meta: PlanMetadata) => {
    onSetStatus(ev.id, { ...meta, status: 'done', done_at: new Date().toISOString() });
    setTab('archive');
  };
  const undo = (ev: EnrichedEvent, meta: PlanMetadata) =>
    onSetStatus(ev.id, { ...meta, status: 'planned', done_at: null });

  const shown = tab === 'archive' ? archive : active;

  return (
    <div className="plans">
      <div className="plans-tab-bar">
        <button
          type="button"
          className={`plans-tab-btn${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          🗺️ Активні <span className="plans-tab-count">{active.length}</span>
        </button>
        <button
          type="button"
          className={`plans-tab-btn${tab === 'archive' ? ' active' : ''}`}
          onClick={() => setTab('archive')}
        >
          ✅ Архів <span className="plans-tab-count">{archive.length}</span>
        </button>
      </div>

      <div className="plans-stat-banner">
        <div className="plans-stat-row">
          <div className="plans-stat-info">
            <span className="plans-stat-num">{done}</span>
            <span className="plans-stat-sep">/</span>
            <span className="plans-stat-total">{total}</span>
            <span className="plans-stat-label">планів виконано</span>
          </div>
          <div className="plans-stat-pct">{pct}%</div>
        </div>
        <div className="plans-progress-bar">
          <div className="plans-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="plans-empty">
          <div className="plans-empty-icon">{tab === 'archive' ? '📦' : '🗺️'}</div>
          <p className="plans-empty-title">
            {tab === 'archive' ? 'Архів порожній' : 'Тут живуть ваші плани'}
          </p>
          <p className="plans-empty-sub">
            {tab === 'archive'
              ? 'Виконані плани зберігатимуться тут'
              : 'Побачення, мрії, подорожі — додай перший!'}
          </p>
        </div>
      ) : (
        PLAN_CAT_ORDER.map((catKey) => {
          const items = shown.filter((p) => p.meta.cat === catKey);
          if (items.length === 0) return null;
          const cat = PLAN_CATS[catKey];
          return (
            <div key={catKey} className="plans-section">
              <div className="plans-section-hdr">
                <span className="plans-section-icon" style={{ background: cat.gradient }}>
                  {cat.icon}
                </span>
                <span className="plans-section-title">{cat.label}</span>
                <span className="plans-section-count">{items.length}</span>
              </div>
              <div className="plans-grid">
                {items.map(({ ev, meta }) => (
                  <PlanCard
                    key={ev.id}
                    ev={ev}
                    meta={meta}
                    isArchive={tab === 'archive'}
                    onMarkDone={() => markDone(ev, meta)}
                    onUndo={() => undo(ev, meta)}
                    onDelete={() => onDelete(ev.id)}
                    onView={() => setViewing(ev)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {viewing && (
        <PlanArchiveModal ev={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

interface PlanCardProps {
  ev: EnrichedEvent;
  meta: PlanMetadata;
  isArchive: boolean;
  onMarkDone: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onView: () => void;
}

function PlanCard({ ev, meta, isArchive, onMarkDone, onUndo, onDelete, onView }: PlanCardProps) {
  const cat = PLAN_CATS[meta.cat];
  const st = PLAN_STATUS[meta.status];

  let doneInfo: string | null = null;
  if (isArchive && meta.done_at) {
    const doneDate = new Date(meta.done_at);
    const diffDay = Math.max(
      0,
      Math.round((doneDate.getTime() - new Date(ev.date).getTime()) / 86_400_000),
    );
    doneInfo = `✅ ${formatUaDate(meta.done_at)} · ${diffDay} дн.`;
  }

  return (
    <div className={`plans-card${isArchive ? ' plans-card--done' : ''}`}>
      <div className="plans-card-top" style={{ background: cat.gradient }}>
        <span className="plans-card-cat-icon">{cat.icon}</span>
        <span className={`plans-card-status ${st.cls}`}>
          {st.icon} {st.label}
        </span>
      </div>
      <div className="plans-card-body">
        <div className="plans-card-title">{ev.title}</div>
        {ev.description && <div className="plans-card-note">{ev.description}</div>}
        <div className="plans-card-footer">
          <span className="plans-card-date">📅 {formatUaDate(ev.date)}</span>
          {!isArchive && ev.days >= 0 ? (
            <span className="plans-card-countdown" style={{ color: cat.color }}>
              {daysLabel(ev.days)}
            </span>
          ) : (
            doneInfo && <span className="plans-card-done-time">{doneInfo}</span>
          )}
        </div>
      </div>
      <div className="plans-card-actions">
        {isArchive ? (
          <>
            <button type="button" className="plans-action-btn" onClick={onView} title="Переглянути">
              👁
            </button>
            <button type="button" className="plans-action-btn" onClick={onUndo} title="Повернути">
              ↩️
            </button>
          </>
        ) : (
          <button
            type="button"
            className="plans-action-btn plans-done-big"
            onClick={onMarkDone}
          >
            ✅ Позначити виконано
          </button>
        )}
        <button type="button" className="plans-action-btn" onClick={onDelete} title="Видалити">
          🗑
        </button>
      </div>
    </div>
  );
}
