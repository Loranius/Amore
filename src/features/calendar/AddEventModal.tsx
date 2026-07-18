// ============================================================
// AddEventModal / AddPlanModal — створення події та плану
// ------------------------------------------------------------
// План зберігається з типізованою metadata (без тегів у description).
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PLAN_CATS, PLAN_CAT_ORDER } from './calendarUtils';
import type { NewEventInput, NewPlanInput } from './useCalendar';
import type { EventType, PlanCategory } from '@/types';

const EVENT_TYPES: { type: EventType; label: string }[] = [
  { type: 'birthday', label: '🎂 День народження' },
  { type: 'anniversary', label: '💕 Річниця' },
  { type: 'holiday', label: '🎉 Свято' },
  { type: 'other', label: '📅 Інше' },
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
export function AddEventModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
}) {
  const [type, setType] = useState<EventType>('birthday');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [yearly, setYearly] = useState(true);

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({ title: title.trim(), date, description: description.trim() || null, type, yearly });
    onClose();
  };

  return (
    <ModalShell title="Нова подія" onClose={onClose}>
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
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="form-field">
        <span>Дата</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="form-field">
        <span>Опис (необов'язково)</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>
      <label className="cal-yearly-toggle">
        <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
        <span>Повторюється щороку</span>
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
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
}) {
  const [cat, setCat] = useState<PlanCategory>('date');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'planned' | 'active'>('planned');

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({ title: title.trim(), date, note: note.trim() || null, cat, status });
    onClose();
  };

  return (
    <ModalShell title="Новий план 🗺️" onClose={onClose}>
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
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Наприклад, поїхати на море разом"
          autoFocus
        />
      </label>
      <label className="form-field">
        <span>Дата / дедлайн</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="form-field">
        <span>Нотатка (необов'язково)</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>

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
