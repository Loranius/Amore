// ============================================================
// PlansBoard — вкладка «Плани» (порт renderPlans/renderPlanCards)
// ------------------------------------------------------------
// Активні / архів, прогрес, групування за категорією. Категорія й
// статус читаються з metadata (planMetadataOf), без парсингу тегів.
// ============================================================
import { useMemo, useState } from 'react';
import { planMetadataOf } from '@/features/_shared/events';
import { localDateFromISO } from '@/lib/utils';
import {
  PLAN_CATS,
  PLAN_STATUS,
  PLAN_CAT_ORDER,
  daysLabel,
  formatUaDate,
} from './calendarUtils';
import { PlanCatIcon, PlanStatusIcon } from '@/components/icons/PlanIcon';
import {
  BoxIcon, CalendarIcon, CheckIcon, EyeIcon, PencilIcon, TrashIcon, UndoIcon, WarningIcon,
} from '@/components/icons/UiIcon';
import { FlagIcon } from '@/components/icons/EventIcon';
import { PlanArchiveModal } from './PlanArchiveModal';
import type { EnrichedEvent, PlanMetadata } from '@/types';

type PlansTab = 'active' | 'archive';

interface PlansBoardProps {
  plans: EnrichedEvent[]; // events типу 'other'
  onSetStatus: (id: number, metadata: PlanMetadata) => void;
  onEdit: (plan: EnrichedEvent) => void;
  onDelete: (id: number) => void;
}

export function PlansBoard({ plans, onSetStatus, onEdit, onDelete }: PlansBoardProps) {
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
  // «В процесі» досі можна було поставити ЛИШЕ при створенні плану — на
  // картці кнопки не було, тож статус був наполовину мертвий.
  const toggleActive = (ev: EnrichedEvent, meta: PlanMetadata) =>
    onSetStatus(ev.id, { ...meta, status: meta.status === 'active' ? 'planned' : 'active' });

  const shown = tab === 'archive' ? archive : active;

  return (
    <div className="plans">
      <div className="plans-tab-bar">
        <button
          type="button"
          className={`plans-tab-btn${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          <FlagIcon size={15} /> Активні <span className="plans-tab-count">{active.length}</span>
        </button>
        <button
          type="button"
          className={`plans-tab-btn${tab === 'archive' ? ' active' : ''}`}
          onClick={() => setTab('archive')}
        >
          <CheckIcon size={15} /> Архів <span className="plans-tab-count">{archive.length}</span>
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
          <div className="plans-empty-icon">
            {tab === 'archive' ? <BoxIcon size={44} /> : <FlagIcon size={44} />}
          </div>
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
                  <PlanCatIcon cat={catKey} size={17} />
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
                    onToggleActive={() => toggleActive(ev, meta)}
                    onEdit={() => onEdit(ev)}
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
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}

function PlanCard({
  ev, meta, isArchive, onMarkDone, onUndo, onToggleActive, onEdit, onDelete, onView,
}: PlanCardProps) {
  const cat = PLAN_CATS[meta.cat];
  const st = PLAN_STATUS[meta.status];

  let doneInfo: string | null = null;
  if (isArchive && meta.done_at) {
    const doneDate = new Date(meta.done_at);
    const diffDay = Math.max(
      0,
      Math.round((doneDate.getTime() - localDateFromISO(ev.date).getTime()) / 86_400_000),
    );
    doneInfo = `${formatUaDate(meta.done_at)} · ${diffDay} дн.`;
  }

  // Прострочений активний план раніше не показував НІЧОГО: умова була
  // «якщо днів ≥ 0 — відлік, інакше інформація про виконання», а для
  // невиконаного плану другої гілки не існує. На дошці власника так стояв
  // план із дедлайном тиждень тому — без єдиної позначки дати.
  const overdueDays = !isArchive && ev.days < 0 ? Math.abs(ev.days) : 0;

  return (
    <div
      className={`plans-card${isArchive ? ' plans-card--done' : ''}${overdueDays ? ' plans-card--overdue' : ''}`}
    >
      <div className="plans-card-top" style={{ background: cat.gradient }}>
        <span className="plans-card-cat-icon"><PlanCatIcon cat={meta.cat} size={19} /></span>
        <span className={`plans-card-status ${st.cls}`}>
          <PlanStatusIcon status={meta.status} size={13} /> {st.label}
        </span>
      </div>
      <div className="plans-card-body">
        <div className="plans-card-title">{ev.title}</div>
        {ev.description && <div className="plans-card-note">{ev.description}</div>}
        <div className="plans-card-footer">
          <span className="plans-card-date"><CalendarIcon size={13} /> {formatUaDate(ev.date)}</span>
          {overdueDays > 0 ? (
            <span className="plans-card-overdue">
              <WarningIcon size={13} /> прострочено на {overdueDays} дн.
            </span>
          ) : !isArchive ? (
            <span className="plans-card-countdown" style={{ color: cat.color }}>
              {daysLabel(ev.days)}
            </span>
          ) : (
            doneInfo && (
              <span className="plans-card-done-time"><CheckIcon size={13} /> {doneInfo}</span>
            )
          )}
        </div>
      </div>
      <div className="plans-card-actions">
        {isArchive ? (
          <>
            <button type="button" className="plans-action-btn" onClick={onView} title="Переглянути" aria-label="Переглянути">
              <EyeIcon size={17} />
            </button>
            <button type="button" className="plans-action-btn" onClick={onUndo} title="Повернути" aria-label="Повернути">
              <UndoIcon size={17} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="plans-action-btn plans-done-big"
              onClick={onMarkDone}
            >
              <CheckIcon size={16} /> Позначити виконано
            </button>
            <button
              type="button"
              className="plans-action-btn"
              onClick={onToggleActive}
              title={meta.status === 'active' ? 'Повернути в «Планується»' : 'Позначити «В процесі»'}
              aria-label={meta.status === 'active' ? 'Повернути в «Планується»' : 'Позначити «В процесі»'}
            >
              <PlanStatusIcon status={meta.status === 'active' ? 'planned' : 'active'} size={17} />
            </button>
          </>
        )}
        <button type="button" className="plans-action-btn" onClick={onEdit} title="Редагувати" aria-label="Редагувати">
          <PencilIcon size={17} />
        </button>
        <button type="button" className="plans-action-btn" onClick={onDelete} title="Видалити" aria-label="Видалити">
          <TrashIcon size={17} />
        </button>
      </div>
    </div>
  );
}
