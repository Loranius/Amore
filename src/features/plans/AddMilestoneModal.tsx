// ============================================================
// Швидке створення або редагування віхи спільного шляху.
// ------------------------------------------------------------
// Віха лишається звичайною календарною подією: карта тільки дає їй
// емоційне представлення. Так дата, нагадування й редагування не
// дублюються у двох незалежних моделях.
// ============================================================
import { useState } from 'react';
import { HeartIcon } from '@/components/icons/NavIcon';
import { TrashIcon } from '@/components/icons/UiIcon';
import type { EventRow } from '@/types';
import type { NewEventInput } from '@/features/calendar/useCalendar';

export function AddMilestoneModal({
  event,
  busy,
  deleting,
  onClose,
  onSubmit,
  onDelete,
}: {
  event: EventRow | null;
  busy: boolean;
  deleting: boolean;
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
  onDelete?: (() => void) | undefined;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [yearly, setYearly] = useState(Boolean(event?.yearly));
  const [important, setImportant] = useState(event?.is_milestone ?? true);

  const locked = busy || deleting;
  const valid = title.trim().length > 0 && date.length > 0;

  const save = () => {
    if (!valid || locked) return;
    onSubmit({
      title: title.trim(),
      date,
      description: description.trim() || null,
      type: 'anniversary',
      yearly,
      is_milestone: important,
      person_user_id: null,
    });
  };

  return (
    <div
      className="modal-overlay plan-milestone-overlay"
      onClick={(eventClick) => {
        if (eventClick.target === eventClick.currentTarget && !locked) onClose();
      }}
    >
      <div
        className="modal-sheet plan-milestone-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-milestone-title"
      >
        <header className="plan-milestone-head">
          <span className="plan-milestone-head-icon" aria-hidden="true">
            <HeartIcon size={22} />
          </span>
          <div>
            <small>{event ? 'Точка на вашому шляху' : 'Нова точка історії'}</small>
            <h2 id="plan-milestone-title">{event ? 'Редагувати віху' : 'Додати віху'}</h2>
            <p>Подія з’явиться на карті у своєму місці за датою.</p>
          </div>
        </header>

        <label className="form-field plan-milestone-title-field">
          <span>Що сталося</span>
          <input
            id="milestone-title"
            name="milestone_title"
            type="text"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value.slice(0, 120))}
            placeholder="Наприклад, познайомилися з батьками"
            autoFocus
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Коли</span>
          <input
            id="milestone-date"
            name="milestone_date"
            type="date"
            value={date}
            onChange={(changeEvent) => setDate(changeEvent.target.value)}
            disabled={locked}
          />
        </label>

        <label className="form-field">
          <span>Короткий підпис <small>необов’язково</small></span>
          <textarea
            id="milestone-description"
            name="milestone_description"
            rows={2}
            value={description}
            onChange={(changeEvent) => setDescription(changeEvent.target.value.slice(0, 500))}
            placeholder="Деталь, яку хочеться пам’ятати…"
            disabled={locked}
          />
        </label>

        <div className="plan-milestone-options">
          <label className="plan-milestone-option">
            <input
              type="checkbox"
              checked={yearly}
              onChange={(changeEvent) => setYearly(changeEvent.target.checked)}
              disabled={locked}
            />
            <span>
              <b>Згадувати щороку</b>
              <small>Дата залишиться в календарі як річниця</small>
            </span>
          </label>

          <label className="plan-milestone-option">
            <input
              type="checkbox"
              checked={important}
              onChange={(changeEvent) => setImportant(changeEvent.target.checked)}
              disabled={locked}
            />
            <span>
              <b>Велика віха</b>
              <small>Отримає сильніший акцент на карті та в кристалі</small>
            </span>
          </label>
        </div>

        <div className="plan-milestone-actions">
          {event && onDelete ? (
            <button
              type="button"
              className="plan-milestone-delete"
              onClick={onDelete}
              disabled={locked}
            >
              <TrashIcon size={15} /> {deleting ? 'Видаляю…' : 'Видалити'}
            </button>
          ) : <span />}

          <div className="plan-milestone-actions-main">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={locked}>
              Скасувати
            </button>
            <button type="button" className="btn" onClick={save} disabled={!valid || locked}>
              {busy ? 'Зберігаю…' : event ? 'Зберегти' : 'Додати на карту'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
