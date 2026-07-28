// ============================================================
// AddEventModal — створення й редагування події календаря
// ------------------------------------------------------------
// План зберігається з типізованою metadata (без тегів у description).
// Одна модалка на обидва режими — патерн вішлиста (`WishFormModal`):
// `event`/`plan` === null означає створення.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { EventIcon } from '@/components/icons/EventIcon';
import { BellIcon } from '@/components/icons/UiIcon';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventType } from '@/types';

// Тип `other` тут НАВМИСНО відсутній. Він писав рядок без `metadata`, а
// дошка планів підставляє дефолт для будь-якого `type='other'` — тож
// «Інша подія» мовчки з'являлась серед планів як запланований пункт
// категорії «Інше» і псувала лічильник «N / M планів виконано».
// Плани створюються своєю модалкою, події — цією.
const EVENT_TYPES: { type: EventType; label: string }[] = [
  { type: 'birthday', label: 'День народження' },
  { type: 'anniversary', label: 'Річниця' },
  { type: 'holiday', label: 'Свято' },
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
  initialDate,
  onClose,
  onSubmit,
}: {
  event: EventRow | null;
  /** Дата, вибрана в сітці місяця: форма відкривається вже на ній. */
  initialDate?: string | undefined;
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
}) {
  const [type, setType] = useState<EventType>(
    event ? editableEventType(event.type) : 'birthday',
  );
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? initialDate ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [yearly, setYearly] = useState(event ? Boolean(event.yearly) : true);
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
      is_milestone: isMilestone,
      // Прив'язка має сенс лише для дня народження: річниця й свято — не
      // про одну людину. Зміна типу не тягне за собою чужий id.
      person_user_id: type === 'birthday' ? personId : null,
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
              <EventIcon type={t.type} size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'birthday' && users.length > 0 && (
        <div className="form-field">
          <span>Чий день народження</span>
          <div className="chips">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`chip${personId === u.id ? ' active' : ''}`}
                onClick={() => setPersonId(personId === u.id ? null : u.id)}
              >
                {u.name}
              </button>
            ))}
            <button
              type="button"
              className={`chip${personId === null ? ' active' : ''}`}
              onClick={() => setPersonId(null)}
            >
              Хтось інший
            </button>
          </div>
          {/* «Хтось інший» — не відмовка, а звичайний випадок: батьки,
              діти й друзі в застосунку не заведені. */}
          <p className="cal-field-hint">
            Потрібно лише для вас двох — щоб застосунок не нагадував людині про її ж день народження.
          </p>
        </div>
      )}

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
        <span>Велика подія — заручини, весілля, важлива віха</span>
      </label>
      {/* Галочка не косметична: `is_milestone` читає useCrystal і вирощує
          з неї вузол на головній. Досі про цей наслідок не було сказано
          ніде, і позначку ставили (чи не ставили) наосліп. */}
      <p className="cal-field-hint">Велика подія проростає окремою гранню кристала на головній.</p>

      {/* Нагадування шле крон event-reminders о 8:00 за Києвом за 3 дні,
          за день і в сам день. Працює давно — і досі про це не було
          сказано ніде, тож людина не знала, чи взагалі щось прийде. */}
      <p className="cal-reminder-note">
        <BellIcon size={15} /> Нагадаємо в Telegram за 3 дні, за день і зранку в сам день.
      </p>

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
