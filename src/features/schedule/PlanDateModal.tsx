// ============================================================
// PlanDateModal — «Запланувати побачення»
// ------------------------------------------------------------
// Дата — лише з переданого списку майбутніх спільних вихідних
// (sharedDates, з useSharedDaysOff). Той самий ModalShell-патерн,
// що в calendar/AddEventModal.tsx.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { NewDateInput } from './useDates';

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

/** 'YYYY-MM-DD' → «26 липня, нд». */
function fmtSharedDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const label = dt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'short' });
  return label;
}

export function PlanDateModal({
  sharedDates,
  onClose,
  onSubmit,
}: {
  sharedDates: string[];
  onClose: () => void;
  onSubmit: (input: NewDateInput) => void;
}) {
  const [date, setDate] = useState(sharedDates[0] ?? '');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({
      title: title.trim(),
      place: place.trim() || null,
      date,
      time: time || null,
      description: description.trim() || null,
      url: url.trim() || null,
    });
    onClose();
  };

  return (
    <ModalShell title="Запланувати побачення 💗" onClose={onClose}>
      <label className="form-field">
        <span>Дата (лише спільні вихідні)</span>
        <select id="date-plan-date" name="date" value={date} onChange={(e) => setDate(e.target.value)}>
          {sharedDates.map((d) => (
            <option key={d} value={d}>
              {fmtSharedDate(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Назва</span>
        <input
          id="date-plan-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Що плануємо?"
          autoFocus
        />
      </label>
      <label className="form-field">
        <span>Місце</span>
        <input
          id="date-plan-place"
          name="place"
          type="text"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Куди підемо?"
        />
      </label>
      <label className="form-field">
        <span>Час</span>
        <input id="date-plan-time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="form-field">
        <span>Опис</span>
        <textarea
          id="date-plan-description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>
      <label className="form-field">
        <span>Посилання (необов'язково)</span>
        <input
          id="date-plan-url"
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Скасувати
        </button>
        <button type="button" className="btn" onClick={save} disabled={!title.trim() || !date}>
          Запропонувати →
        </button>
      </div>
    </ModalShell>
  );
}
