// ============================================================
// AddEventModal — контекстна форма особистого календаря.
// ------------------------------------------------------------
// Візуально наслідує AddPlanModal: великий вступ, акцентне поле назви,
// компактні акордеони й однакова нижня панель дій. Дані та семантика
// лишаються розділеними: anniversary — «Наш шлях», birthday / holiday —
// лише календар.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { useEvents } from '@/features/_shared/events';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { BellIcon, ChevronDownIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventSignificance, EventType } from '@/types';
import { KEY_EVENT_TEMPLATES, takenKeySignificance } from './keyEvents';
import './calendarEventForm.css';

type CalendarEntryType = Extract<EventType, 'anniversary' | 'birthday' | 'holiday'>;

const SIGNIFICANCE_LABEL: Record<EventSignificance, string> = {
  regular: 'Звичайна',
  important: 'Важлива',
  relationship_start: 'Початок відносин',
  marriage: 'Одруження',
};

function ModalShell({ children, onClose }: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay cal-entry-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet cal-entry-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-entry-title"
      >
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
  const [significance, setSignificance] = useState<EventSignificance>(
    event?.significance ?? 'regular',
  );
  const [personId, setPersonId] = useState<number | null>(event?.person_user_id ?? null);
  /*
   * Колір зірки поки лише ПЕРЕНОСИТЬСЯ, а не обирається: вибір з'явиться
   * разом із переробкою модалки. Тримати його тут уже зараз обов'язково —
   * інакше правка назви події тихо стирала б колір, який пара вибрала.
   */
  const [starColor] = useState<string | null>(event?.star_color ?? null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [significanceOpen, setSignificanceOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(event?.description));
  const { data: users = [] } = useUsers();
  const { data: allEvents = [] } = useEvents();
  const takenKeys = takenKeySignificance(allEvents, event);

  const selectCalendarType = (next: Extract<CalendarEntryType, 'birthday' | 'holiday'>) => {
    setType(next);
    setTypeOpen(false);
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
      significance: relationshipEvent ? significance : 'regular',
      person_user_id: birthdayEvent ? personId : null,
      star_color: starColor,
    });
    onClose();
  };

  const contextHint = relationshipEvent
    ? 'Подія з’явиться на вашому шляху й у календарі.'
    : birthdayEvent
      ? 'Дата залишиться в календарі й отримає щорічні нагадування.'
      : 'Позначка залишиться тільки в календарі й не потрапить у список планів.';

  const eyebrow = event
    ? 'Редагування події'
    : relationshipEvent
      ? 'Нова подія нашого шляху'
      : 'Нова подія календаря';

  const headline = event
    ? relationshipEvent
      ? 'Оновити важливий момент'
      : 'Оновити календарну подію'
    : relationshipEvent
      ? 'Що сталося у вашій історії?'
      : 'Що хочете не забути?';

  const titlePlaceholder = relationshipEvent
    ? 'Наприклад, уперше поїхали разом у подорож'
    : birthdayEvent
      ? 'Наприклад, день народження мами'
      : 'Наприклад, наша маленька дата або забронювати столик';

  const calendarTypeLabel = birthdayEvent ? 'День народження' : 'Дата / нагадування';
  const significanceLabel = SIGNIFICANCE_LABEL[significance];

  return (
    <ModalShell onClose={onClose}>
      <form
        className="cal-entry-form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          save();
        }}
      >
        <header className="cal-entry-head">
          <span className="cal-entry-eyebrow">{eyebrow}</span>
          <h2 id="cal-entry-title">{headline}</h2>
          <p>{contextHint}</p>
        </header>

        <label className="cal-entry-title-field">
          <textarea
            id="event-title"
            name="title"
            rows={2}
            maxLength={120}
            value={title}
            onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            placeholder={titlePlaceholder}
            autoFocus
          />
          <small>{title.trim().length}/120</small>
        </label>

        {!event && !relationshipEvent && (
          <section className="cal-entry-accordion" aria-labelledby="cal-entry-type-title">
            <button
              type="button"
              className={`cal-entry-accordion-toggle${typeOpen ? ' open' : ''}`}
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen((current) => !current)}
            >
              <span className="cal-entry-accordion-icon" aria-hidden="true">
                <EventIcon type={type} size={18} />
              </span>
              <span className="cal-entry-accordion-copy">
                <small id="cal-entry-type-title">Тип події</small>
                <strong>{calendarTypeLabel}</strong>
              </span>
              <ChevronDownIcon size={17} />
            </button>

            {typeOpen && (
              <div className="cal-entry-type-grid" aria-label="Типи календарних подій">
                <button
                  type="button"
                  className={`cal-entry-type-option${type === 'holiday' ? ' active' : ''}`}
                  aria-pressed={type === 'holiday'}
                  onClick={() => selectCalendarType('holiday')}
                >
                  <EventIcon type="holiday" size={18} />
                  <span>
                    <strong>Дата / нагадування</strong>
                    <small>Свято, маленька дата або нагадування</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`cal-entry-type-option${type === 'birthday' ? ' active' : ''}`}
                  aria-pressed={type === 'birthday'}
                  onClick={() => selectCalendarType('birthday')}
                >
                  <EventIcon type="birthday" size={18} />
                  <span>
                    <strong>День народження</strong>
                    <small>Дата з щорічним нагадуванням</small>
                  </span>
                </button>
              </div>
            )}
          </section>
        )}

        {relationshipEvent && (
          <section className="cal-entry-accordion" aria-labelledby="cal-entry-significance-title">
            <button
              type="button"
              className={`cal-entry-accordion-toggle${significanceOpen ? ' open' : ''}`}
              aria-expanded={significanceOpen}
              onClick={() => setSignificanceOpen((current) => !current)}
            >
              <span className="cal-entry-accordion-icon" aria-hidden="true">
                {significance === 'regular'
                  ? <EventIcon type="anniversary" size={18} />
                  : significance === 'important'
                    ? <SparkIcon size={18} />
                    : <HeartIcon size={18} />}
              </span>
              <span className="cal-entry-accordion-copy">
                <small id="cal-entry-significance-title">Значення події</small>
                <strong>{significanceLabel}</strong>
              </span>
              <ChevronDownIcon size={17} />
            </button>

            {significanceOpen && (
              <>
                <div className="cal-entry-type-grid" aria-label="Значення події">
                  <button
                    type="button"
                    className={`cal-entry-type-option${significance === 'regular' ? ' active' : ''}`}
                    aria-pressed={significance === 'regular'}
                    onClick={() => {
                      setSignificance('regular');
                      setSignificanceOpen(false);
                    }}
                  >
                    <EventIcon type="anniversary" size={18} />
                    <span>
                      <strong>Звичайна</strong>
                      <small>Момент, який хочеться пам’ятати</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`cal-entry-type-option cal-entry-type-option--major${significance === 'important' ? ' active' : ''}`}
                    aria-pressed={significance === 'important'}
                    onClick={() => {
                      setSignificance('important');
                      setSignificanceOpen(false);
                    }}
                  >
                    <SparkIcon size={18} />
                    <span>
                      <strong>Важлива</strong>
                      <small>Велика віха: заручини, переїзд, подорож</small>
                    </span>
                  </button>
                </div>

                {/*
                  Ключових видів рівно два, і вибираються вони не рівнем, а
                  шаблоном: назва підставляється разом зі значенням. Уже
                  створений ключ вимкнений — як товар, що вже в полиці покупок.
                */}
                <div className="cal-entry-keys" aria-label="Ключові події">
                  <small>Ключові події</small>
                  {KEY_EVENT_TEMPLATES.map((template) => {
                    const active = significance === template.significance;
                    const taken = takenKeys.has(template.significance);
                    return (
                      <button
                        key={template.significance}
                        type="button"
                        className={`cal-entry-key-option${active ? ' active' : ''}`}
                        aria-pressed={active}
                        disabled={taken}
                        onClick={() => {
                          setSignificance(template.significance);
                          if (!title.trim()) setTitle(template.title);
                          setSignificanceOpen(false);
                        }}
                      >
                        <HeartIcon size={17} />
                        <span>
                          <strong>{template.title}</strong>
                          <small>{taken ? 'Вже є у вашій історії' : template.hint}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {birthdayEvent && users.length > 0 && (
          <section className="cal-entry-people-card">
            <span className="cal-entry-field-label">Чий день народження</span>
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
          </section>
        )}

        <label className="cal-entry-field-card cal-entry-date-card">
          <span className="cal-entry-field-label">Дата</span>
          <input
            id="event-date"
            name="date"
            type="date"
            value={date}
            onChange={(inputEvent) => setDate(inputEvent.target.value)}
          />
        </label>

        <section className="cal-entry-accordion">
          <button
            type="button"
            className={`cal-entry-accordion-toggle cal-entry-accordion-toggle--note${noteOpen ? ' open' : ''}`}
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((current) => !current)}
          >
            <span className="cal-entry-accordion-copy">
              <small>Додаткова деталь</small>
              <strong>{description.trim() ? 'Нотатку додано' : 'Додати нотатку'}</strong>
            </span>
            <span className="cal-entry-accordion-optional">необов’язково</span>
            <ChevronDownIcon size={17} />
          </button>

          {noteOpen && (
            <label className="cal-entry-note">
              <textarea
                id="event-description"
                name="description"
                rows={3}
                value={description}
                onChange={(inputEvent) => setDescription(inputEvent.target.value)}
                placeholder={relationshipEvent ? 'Чому цей момент важливий для вас?' : 'Додаткова примітка'}
              />
            </label>
          )}
        </section>

        <label className="cal-entry-toggle-card">
          <input
            id="event-yearly"
            name="yearly"
            type="checkbox"
            checked={yearly}
            onChange={(inputEvent) => setYearly(inputEvent.target.checked)}
          />
          <span>
            <strong>
              {relationshipEvent
                ? 'Відзначати щороку'
                : birthdayEvent
                  ? 'Нагадувати щороку'
                  : 'Повторювати щороку'}
            </strong>
            <small>Подія автоматично з’являтиметься в календарі наступних років.</small>
          </span>
        </label>

        <p className="cal-entry-reminder-note">
          <BellIcon size={15} />
          Нагадаємо в Telegram за 3 дні, за день і зранку в сам день.
        </p>

        <div className="cal-entry-actions">
          <button type="button" className="cal-entry-cancel" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn cal-entry-save" disabled={!title.trim() || !date}>Зберегти</button>
        </div>
      </form>
    </ModalShell>
  );
}
