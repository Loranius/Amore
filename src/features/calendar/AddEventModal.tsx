// ============================================================
// AddEventModal — форма події календаря й «Нашого шляху».
// ------------------------------------------------------------
// **Одна спокійна поверхня, а не форма з вкладеними картками.** До переробки
// тут було три акордеони (тип, значення, нотатка), кожен у власній «скляній»
// картці, і `textarea` на дві строки під назву. Власник назвав це прямо:
// адміністративна форма посеред атмосферної сцени. Тепер усе видно одразу,
// вибір іде сегментами, а поверхня одна.
//
// **Модалка обслуговує ТРИ типи** — `anniversary` (подія шляху), `birthday`
// і `holiday` (лише календар), — і кожен має свою гілку: вибір людини, вибір
// типу, шаблони ключових подій, `yearly` за замовчуванням. Переробка чіпає
// подачу; жодне поле `NewEventInput` від неї не змінилось. Це найдорожче місце
// для тихої поломки, і саме тому всі три перевіряються на живому екрані.
//
// **Колір зірки пропонується лише подіям шляху.** Календарна позначка зіркою
// не стає, і давати їй вибір кольору означало б обіцяти те, чого не буде.
//
// Згадки про Telegram-нагадування тут більше немає — рішення власника. Самі
// нагадування працюють як працювали: їх шле бек за `yearly` й типом, а рядок
// у формі був лише обіцянкою, яку форма не виконує.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { useEvents } from '@/features/_shared/events';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import { levelOf } from '@/features/journey/constellationRules';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventSignificance, EventType } from '@/types';
import { KEY_EVENT_TEMPLATES, takenKeySignificance } from './keyEvents';
import { StarColourPicker } from './StarColourPicker';
import './calendarEventForm.css';

type CalendarEntryType = Extract<EventType, 'anniversary' | 'birthday' | 'holiday'>;

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

/** Сегмент вибору. Мова взята з `.pm-tabs` планів, але стилі свої. */
function Segment({ active, onClick, icon, children }: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`cal-entry-segment${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
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
  const [starColor, setStarColor] = useState<string | null>(event?.star_color ?? null);
  const { data: users = [] } = useUsers();
  const { data: allEvents = [] } = useEvents();
  const takenKeys = takenKeySignificance(allEvents, event);

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
      significance: relationshipEvent ? significance : 'regular',
      person_user_id: birthdayEvent ? personId : null,
      // Колір належить лише зірці. Календарна позначка забирає його з собою в
      // базу порожнім, щоб зміна типу не лишала за собою мертвого значення.
      star_color: relationshipEvent ? starColor : null,
    });
    onClose();
  };

  const contextHint = relationshipEvent
    ? 'Подія з’явиться на вашому шляху й у календарі.'
    : birthdayEvent
      ? 'Дата залишиться в календарі й отримає щорічні нагадування.'
      : 'Позначка залишиться тільки в календарі й не потрапить у список планів.';

  const titlePlaceholder = relationshipEvent
    ? 'Уперше поїхали разом у подорож'
    : birthdayEvent
      ? 'День народження мами'
      : 'Забронювати столик';

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
          <h2 id="cal-entry-title">{event ? 'Редагувати подію' : 'Нова подія'}</h2>
          {/*
            Підзаголовок лишається контекстним: він єдине, що каже парі, чи
            подія потрапить на шлях, чи залишиться позначкою в календарі.
          */}
          <p>{contextHint}</p>
        </header>

        <label className="cal-entry-name">
          <span className="cal-entry-field-label">Назва</span>
          <input
            id="event-title"
            name="title"
            type="text"
            maxLength={120}
            value={title}
            onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            placeholder={titlePlaceholder}
            autoFocus
          />
          <small>{title.trim().length}/120</small>
        </label>

        {/*
          Тип обирається лише для НОВОЇ календарної події. Змінити тип уже
          створеної не можна й не було можна: подія шляху й позначка календаря
          живуть за різними правилами, і мовчазний перехід між ними забрав би
          в пари зірку.
        */}
        {!event && !relationshipEvent && (
          <fieldset className="cal-entry-choice">
            <legend className="cal-entry-field-label">Тип події</legend>
            <div className="cal-entry-segments">
              <Segment
                active={type === 'holiday'}
                onClick={() => selectCalendarType('holiday')}
                icon={<EventIcon type="holiday" size={17} />}
              >
                Дата
              </Segment>
              <Segment
                active={birthdayEvent}
                onClick={() => selectCalendarType('birthday')}
                icon={<EventIcon type="birthday" size={17} />}
              >
                День народження
              </Segment>
            </div>
          </fieldset>
        )}

        {relationshipEvent && (
          <fieldset className="cal-entry-choice">
            <legend className="cal-entry-field-label">Значення</legend>
            <div className="cal-entry-segments">
              <Segment
                active={significance === 'regular'}
                onClick={() => setSignificance('regular')}
                icon={<EventIcon type="anniversary" size={17} />}
              >
                Звичайна
              </Segment>
              <Segment
                active={significance === 'important'}
                onClick={() => setSignificance('important')}
                icon={<SparkIcon size={17} />}
              >
                Важлива
              </Segment>
            </div>

            {/*
              Ключових видів рівно два, і вони НЕ сегменти того самого вибору,
              хоч і задають те саме поле. Поведінка в них інша: вони
              підставляють назву й вимикаються, коли ключ у парі вже є. Чотири
              сегменти з такими підписами до того ж не влазять у телефон.
            */}
            <div className="cal-entry-keys" aria-label="Ключові події">
              {KEY_EVENT_TEMPLATES.map((template) => {
                const active = significance === template.significance;
                const taken = takenKeys.has(template.significance);
                return (
                  <button
                    key={template.significance}
                    type="button"
                    className={`cal-entry-key${active ? ' active' : ''}`}
                    aria-pressed={active}
                    disabled={taken}
                    onClick={() => {
                      setSignificance(template.significance);
                      if (!title.trim()) setTitle(template.title);
                    }}
                  >
                    <HeartIcon size={15} />
                    <span>
                      <strong>{template.title}</strong>
                      <small>{taken ? 'Вже є у вашій історії' : template.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {relationshipEvent && (
          <StarColourPicker
            /*
             * У нової події `id` ще немає, і нуль тут не заглушка: `starSeed`
             * від нього дає такий самий стабільний відтінок, як від будь-якого
             * іншого числа. Пара побачить не той відтінок, який дістанеться
             * події після збереження, — але лише поки не обере колір сама, і
             * саме тому чип підписаний «Авто», а не назвою кольору.
             */
            eventId={event?.id ?? 0}
            level={levelOf({ significance })}
            value={starColor}
            onChange={setStarColor}
          />
        )}

        {birthdayEvent && users.length > 0 && (
          <fieldset className="cal-entry-choice">
            <legend className="cal-entry-field-label">Чий день народження</legend>
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
          </fieldset>
        )}

        <label className="cal-entry-date">
          <span className="cal-entry-field-label">Дата</span>
          <input
            id="event-date"
            name="date"
            type="date"
            value={date}
            onChange={(inputEvent) => setDate(inputEvent.target.value)}
          />
        </label>

        {/*
          Нотатка видима завжди. Акордеон економив 90 пікселів і коштував
          дотику й здогадки — а причина, з якої пара сюди прийшла, часто саме
          в ній.
        */}
        <label className="cal-entry-note">
          <span className="cal-entry-field-label">
            Нотатка <em>необов’язково</em>
          </span>
          <textarea
            id="event-description"
            name="description"
            rows={2}
            value={description}
            onChange={(inputEvent) => setDescription(inputEvent.target.value)}
            placeholder={relationshipEvent ? 'Чому цей момент важливий для вас?' : 'Додаткова примітка'}
          />
        </label>

        <label className="cal-entry-yearly">
          <input
            id="event-yearly"
            name="yearly"
            type="checkbox"
            checked={yearly}
            onChange={(inputEvent) => setYearly(inputEvent.target.checked)}
          />
          <span>
            {relationshipEvent
              ? 'Відзначати щороку'
              : birthdayEvent
                ? 'Нагадувати щороку'
                : 'Повторювати щороку'}
          </span>
        </label>

        <div className="cal-entry-actions">
          <button type="button" className="cal-entry-cancel" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn cal-entry-save" disabled={!title.trim() || !date}>Зберегти</button>
        </div>
      </form>
    </ModalShell>
  );
}
