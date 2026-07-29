// ============================================================
// AddEventModal — контекстна форма особистого календаря.
// ------------------------------------------------------------
// Розділ уже визначає призначення запису. У «Наших святах» користувач
// обирає лише вагу моменту: звичайна подія або велика подія. У «Днях
// народження» форма одразу працює як день народження без зайвого вибору.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { BellIcon } from '@/components/icons/UiIcon';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventType } from '@/types';
import './calendarEventForm.css';

type CalendarEntryType = Extract<EventType, 'anniversary' | 'birthday'>;

function ModalShell({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet cal-entry-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function entryType(event: EventRow | null, initialType: CalendarEntryType): CalendarEntryType {
  if (event?.type === 'birthday') return 'birthday';
  return initialType;
}

export function AddEventModal({
  event,
  initialDate,
  initialType = 'anniversary',
  onClose,
  onSubmit,
}: {
  event: EventRow | null;
  initialDate?: string | undefined;
  initialType?: CalendarEntryType | undefined;
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
}) {
  const type = entryType(event, initialType);
  const relationshipEvent = type === 'anniversary';
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [yearly, setYearly] = useState(event ? Boolean(event.yearly) : type === 'birthday');
  const [isMilestone, setIsMilestone] = useState(event?.is_milestone ?? false);
  const [personId, setPersonId] = useState<number | null>(event?.person_user_id ?? null);
  const { data: users = [] } = useUsers();

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({
      title: title.trim(),
      date,
      description: description.trim() || null,
      type,
      yearly,
      is_milestone: relationshipEvent ? isMilestone : false,
      person_user_id: type === 'birthday' ? personId : null,
    });
    onClose();
  };

  const modalTitle = event
    ? relationshipEvent ? 'Редагувати подію нашого шляху' : 'Редагувати день народження'
    : relationshipEvent ? 'Нова подія нашого шляху' : 'Новий день народження';

  return (
    <ModalShell title={modalTitle} onClose={onClose}>
      <div className="cal-entry-context" aria-hidden="true">
        <span><EventIcon type={type} size={19} /></span>
        <div>
          <strong>{relationshipEvent ? 'Наші свята' : 'Дні народження'}</strong>
          <small>
            {relationshipEvent
              ? 'Запис одразу з’явиться на дорожній карті стосунків.'
              : 'Запис залишиться у списку днів народження.'}
          </small>
        </div>
      </div>

      {relationshipEvent && (
        <fieldset className="cal-significance">
          <legend>Яка це подія?</legend>
          <div className="cal-significance-grid">
            <button
              type="button"
              className={`cal-significance-option${!isMilestone ? ' active' : ''}`}
              aria-pressed={!isMilestone}
              onClick={() => setIsMilestone(false)}
            >
              <span className="cal-significance-icon"><EventIcon type="anniversary" size={20} /></span>
              <span>
                <strong>Подія</strong>
                <small>Новий важливий момент, який хочеться залишити у вашій історії.</small>
              </span>
            </button>
            <button
              type="button"
              className={`cal-significance-option cal-significance-option--major${isMilestone ? ' active' : ''}`}
              aria-pressed={isMilestone}
              onClick={() => setIsMilestone(true)}
            >
              <span className="cal-significance-icon"><SparkIcon size={20} /></span>
              <span>
                <strong>Велика подія</strong>
                <small>Пропозиція, весілля або інша ключова віха ваших стосунків.</small>
              </span>
            </button>
          </div>
        </fieldset>
      )}

      {type === 'birthday' && users.length > 0 && (
        <div className="form-field">
          <span>Чий день народження</span>
          <div className="chips">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`chip${personId === user.id ? ' active' : ''}`}
                onClick={() => setPersonId(personId === user.id ? null : user.id)}
              >
                {user.name}
              </button>
            ))}
            <button
              type="button"
              className={`chip${personId === null ? ' active' : ''}`}
              onClick={() => setPersonId(null)}
            >
              Родич або близька людина
            </button>
          </div>
          <p className="cal-field-hint">
            Вибір потрібен лише для вас двох. Для родичів і друзів залиште останній варіант.
          </p>
        </div>
      )}

      <label className="form-field">
        <span>{relationshipEvent ? 'Що сталося?' : 'Ім’я або назва'}</span>
        <input
          id="event-title"
          name="title"
          type="text"
          value={title}
          onChange={(inputEvent) => setTitle(inputEvent.target.value)}
          placeholder={relationshipEvent ? 'Наприклад, уперше поїхали разом у подорож' : 'Наприклад, день народження мами'}
          autoFocus
        />
      </label>
      <label className="form-field">
        <span>Дата</span>
        <input
          id="event-date"
          name="date"
          type="date"
          value={date}
          onChange={(inputEvent) => setDate(inputEvent.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Короткий опис <small>необов’язково</small></span>
        <textarea
          id="event-description"
          name="description"
          rows={2}
          value={description}
          onChange={(inputEvent) => setDescription(inputEvent.target.value)}
          placeholder={relationshipEvent ? 'Чому цей момент важливий для вас?' : 'Додаткова примітка'}
          style={{ resize: 'vertical' }}
        />
      </label>
      <label className="cal-yearly-toggle">
        <input
          id="event-yearly"
          name="yearly"
          type="checkbox"
          checked={yearly}
          onChange={(inputEvent) => setYearly(inputEvent.target.checked)}
        />
        <span>{relationshipEvent ? 'Відзначати цю дату щороку' : 'Нагадувати щороку'}</span>
      </label>

      <p className="cal-reminder-note">
        <BellIcon size={15} /> Нагадаємо в Telegram за 3 дні, за день і зранку в сам день.
      </p>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Скасувати</button>
        <button type="button" className="btn" onClick={save} disabled={!title.trim() || !date}>Зберегти</button>
      </div>
    </ModalShell>
  );
}
