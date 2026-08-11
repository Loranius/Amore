// ============================================================
// AddEventModal — контекстна форма особистого календаря.
// ------------------------------------------------------------
// Розділ визначає призначення запису:
//   anniversary — подія «Нашого шляху»;
//   birthday    — день народження, тільки календар;
//   holiday     — звичайна дата / свято / нагадування, тільки календар.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { BellIcon } from '@/components/icons/UiIcon';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventType } from '@/types';
import './calendarEventForm.css';

type CalendarEntryType = Extract<EventType, 'anniversary' | 'birthday' | 'holiday'>;

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
  if (event?.type === 'anniversary' || event?.type === 'birthday' || event?.type === 'holiday') {
    return event.type;
  }
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
  const [type, setType] = useState<CalendarEntryType>(() => entryType(event, initialType));
  const relationshipEvent = type === 'anniversary';
  const birthdayEvent = type === 'birthday';
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [yearly, setYearly] = useState(event ? Boolean(event.yearly) : type === 'birthday');
  const [isMilestone, setIsMilestone] = useState(event?.is_milestone ?? false);
  const [personId, setPersonId] = useState<number | null>(event?.person_user_id ?? null);
  const { data: users = [] } = useUsers();

  const selectCalendarType = (next: Extract<CalendarEntryType, 'birthday' | 'holiday'>) => {
    setType(next);
    if (next === 'birthday') {
      setYearly(true);
      return;
    }
    setYearly(false);
    setPersonId(null);
  };

  const save = () => {
    if (!title.trim() || !date) return;
    onSubmit({
      title: title.trim(),
      date,
      description: description.trim() || null,
      type,
      yearly,
      is_milestone: relationshipEvent ? isMilestone : false,
      person_user_id: birthdayEvent ? personId : null,
    });
    onClose();
  };

  const modalTitle = event
    ? relationshipEvent
      ? 'Редагувати подію нашого шляху'
      : birthdayEvent
        ? 'Редагувати день народження'
        : 'Редагувати подію календаря'
    : relationshipEvent
      ? 'Нова подія нашого шляху'
      : birthdayEvent
        ? 'Новий день народження'
        : 'Нова подія календаря';

  const contextTitle = relationshipEvent
    ? 'Наш шлях'
    : birthdayEvent
      ? 'День народження'
      : 'Тільки календар';

  const contextHint = relationshipEvent
    ? 'Запис з’явиться на дорожній карті стосунків і в календарі.'
    : birthdayEvent
      ? 'Дата залишиться в календарі й не стане окремим планом.'
      : 'Позначка залишиться тільки в календарі й не потрапить у список планів.';

  return (
    <ModalShell title={modalTitle} onClose={onClose}>
      <div className="cal-entry-context" aria-hidden="true">
        <span><EventIcon type={type} size={19} /></span>
        <div>
          <strong>{contextTitle}</strong>
          <small>{contextHint}</small>
        </div>
      </div>

      {!event && !relationshipEvent && (
        <fieldset className="cal-significance">
          <legend>Що додаємо?</legend>
          <div className="cal-significance-grid">
            <button
              type="button"
              className={`cal-significance-option${type === 'holiday' ? ' active' : ''}`}
              aria-pressed={type === 'holiday'}
              onClick={() => selectCalendarType('holiday')}
            >
              <span className="cal-significance-icon"><EventIcon type="holiday" size={20} /></span>
              <span>
                <strong>Дата / нагадування</strong>
                <small>Свято, ваша маленька дата або просто те, що треба не забути.</small>
              </span>
            </button>
            <button
              type="button"
              className={`cal-significance-option${type === 'birthday' ? ' active' : ''}`}
              aria-pressed={type === 'birthday'}
              onClick={() => selectCalendarType('birthday')}
            >
              <span className="cal-significance-icon"><EventIcon type="birthday" size={20} /></span>
              <span>
                <strong>День народження</strong>
                <small>Окрема дата з щорічним нагадуванням.</small>
              </span>
            </button>
          </div>
        </fieldset>
      )}

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

      {birthdayEvent && users.length > 0 && (
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
        <span>{relationshipEvent ? 'Що сталося?' : birthdayEvent ? 'Ім’я або назва' : 'Назва'}</span>
        <input
          id="event-title"
          name="title"
          type="text"
          value={title}
          onChange={(inputEvent) => setTitle(inputEvent.target.value)}
          placeholder={
            relationshipEvent
              ? 'Наприклад, уперше поїхали разом у подорож'
              : birthdayEvent
                ? 'Наприклад, день народження мами'
                : 'Наприклад, наша маленька дата або забронювати столик'
          }
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
        <span>
          {relationshipEvent
            ? 'Відзначати цю дату щороку'
            : birthdayEvent
              ? 'Нагадувати щороку'
              : 'Повторювати щороку'}
        </span>
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
