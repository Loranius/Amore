// ============================================================
// AddEventModal / AddPlanModal — створення й редагування події та плану
// ------------------------------------------------------------
// План зберігається з типізованою metadata (без тегів у description).
// Одна модалка на обидва режими — патерн вішлиста (`WishFormModal`):
// `event`/`plan` === null означає створення.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { planMetadataOf } from '@/features/_shared/events';
import { PLAN_CATS, PLAN_CAT_ORDER } from './calendarUtils';
import type { NewEventInput, NewPlanInput } from './useCalendar';
import type { EnrichedEvent, EventRow, EventType, PlanCategory } from '@/types';

// Тип `other` тут НАВМИСНО відсутній. Він писав рядок без `metadata`, а
// дошка планів підставляє дефолт для будь-якого `type='other'` — тож
// «Інша подія» мовчки з'являлась серед планів як запланований пункт
// категорії «Інше» і псувала лічильник «N / M планів виконано».
// Плани створюються своєю модалкою, події — цією.
const EVENT_TYPES: { type: EventType; label: string }[] = [
  { type: 'birthday', label: '🎂 День народження' },
  { type: 'anniversary', label: '💕 Річниця' },
  { type: 'holiday', label: '🎉 Свято' },
];

function ModalShell({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ── Подія ────────────────────────────────────────────────────
/** Тип події з БД може бути null або 'other' (легасі) — у формі показуємо
 *  найближчий валідний варіант, а не порожній вибір. */
function editableEventType(value: EventType | null): EventType {
  return value === 'anniversary' || value === 'holiday' ? value : 'birthday';
}

export function AddEventModal({
  event,
  onClose,
  onSubmit,
}: {
  event: EventRow | null;
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
}) {
  const [type, setType] = useState<EventType>(
    event ? editableEventType(event.type) : 'birthday',
  );
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [yearly, setYearly] = useState(event ? Boolean(event.yearly) : true);
  const [isMilestone, setIsMilestone] = useState(event?.is_milestone ?? false);

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({
      title: title.trim(),
      date,
      description: description.trim() || null,
      type,
      yearly,
      is_milestone: isMilestone,
    });
    onClose();
  };

  return (
    <ModalShell title={event ? 'Редагувати подію' : 'Нова подія'} onClose={onClose}>
      <div className="form-field">
        <span>Тип</span>
        <div className="chips">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              className={`chip${type === t.type ? ' active' : ''}`}
              onClick={() => setType(t.type)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="form-field">
        <span>Назва</span>
        <input id="event-title" name="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="form-field">
        <span>Дата</span>
        <input id="event-date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="form-field">
        <span>Опис (необов'язково)</span>
        <textarea
          id="event-description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>
      <label className="cal-yearly-toggle">
        <input id="event-yearly" name="yearly" type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
        <span>Повторюється щороку</span>
      </label>
      <label className="cal-yearly-toggle">
        <input
          id="event-milestone"
          name="is_milestone"
          type="checkbox"
          checked={isMilestone}
          onChange={(e) => setIsMilestone(e.target.checked)}
        />
        <span>💍 Велика подія (заручини, весілля, важлива віха)</span>
      </label>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Скасувати
        </button>
        <button type="button" className="btn" onClick={save} disabled={!title.trim() || !date}>
          Зберегти
        </button>
      </div>
    </ModalShell>
  );
}

// ── План ─────────────────────────────────────────────────────
export function AddPlanModal({
  plan,
  onClose,
  onSubmit,
}: {
  plan: EnrichedEvent | null;
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
}) {
  const existing = plan ? planMetadataOf(plan) : null;
  const [cat, setCat] = useState<PlanCategory>(existing?.cat ?? 'date');
  const [title, setTitle] = useState(plan?.title ?? '');
  const [date, setDate] = useState(plan?.date ?? '');
  const [note, setNote] = useState(plan?.description ?? '');
  // Статус редагується не тут, а кнопками на картці: виконаний план не
  // має повертатись у «Планується» лише тому, що виправили назву. Тому
  // при редагуванні вибір статусу в формі не показується взагалі.
  const [status, setStatus] = useState<'planned' | 'active'>('planned');

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({ title: title.trim(), date, note: note.trim() || null, cat, status });
    onClose();
  };

  return (
    <ModalShell title={plan ? 'Редагувати план 🗺️' : 'Новий план 🗺️'} onClose={onClose}>
      <div className="form-field">
        <span>Категорія</span>
        <div className="chips">
          {PLAN_CAT_ORDER.map((key) => {
            const c = PLAN_CATS[key];
            const active = cat === key;
            return (
              <button
                key={key}
                type="button"
                className={`chip${active ? ' active' : ''}`}
                style={active ? { background: c.gradient, color: '#fff' } : undefined}
                onClick={() => setCat(key)}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="form-field">
        <span>Назва</span>
        <input
          id="plan-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Наприклад, поїхати на море разом"
          autoFocus
        />
      </label>
      <label className="form-field">
        <span>Дата / дедлайн</span>
        <input id="plan-date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="form-field">
        <span>Нотатка (необов'язково)</span>
        <textarea
          id="plan-note"
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>

      {plan === null && (
        <div className="form-field">
          <span>Статус</span>
          <div className="chips">
            <button
              type="button"
              className={`chip${status === 'planned' ? ' active' : ''}`}
              onClick={() => setStatus('planned')}
            >
              ⏳ Планується
            </button>
            <button
              type="button"
              className={`chip${status === 'active' ? ' active' : ''}`}
              onClick={() => setStatus('active')}
            >
              🔥 В процесі
            </button>
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Скасувати
        </button>
        <button type="button" className="btn" onClick={save} disabled={!title.trim() || !date}>
          Зберегти
        </button>
      </div>
    </ModalShell>
  );
}
