// ============================================================
// AddEventModal — створення й редагування події календаря.
// ------------------------------------------------------------
// Активна вкладка передає початковий тип: у «Наших святах» форма одразу
// відкриває річницю, у днях народження — день народження, у святах — свято.
// ============================================================
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { EventIcon } from '@/components/icons/EventIcon';
import { BellIcon } from '@/components/icons/UiIcon';
import type { NewEventInput } from './useCalendar';
import type { EventRow, EventType } from '@/types';

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function editableEventType(value: EventType | null | undefined): EventType {
  if (value === 'anniversary' || value === 'holiday' || value === 'birthday') return value;
  return 'birthday';
}

export function AddEventModal({
  event,
  initialDate,
  initialType,
  onClose,
  onSubmit,
}: {
  event: EventRow | null;
  initialDate?: string | undefined;
  initialType?: EventType | undefined;
  onClose: () => void;
  onSubmit: (input: NewEventInput) => void;
}) {
  const [type, setType] = useState<EventType>(
    event ? editableEventType(event.type) : editableEventType(initialType),
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
      person_user_id: type === 'birthday' ? personId : null,
    });
    onClose();
  };

  return (
    <ModalShell title={event ? 'Редагувати подію' : 'Нова подія'} onClose={onClose}>
      <div className="form-field">
        <span>Тип</span>
        <div className="chips">
          {EVENT_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              className={`chip${type === item.type ? ' active' : ''}`}
              onClick={() => setType(item.type)}
            >
              <EventIcon type={item.type} size={15} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

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
              Хтось інший
            </button>
          </div>
          <p className="cal-field-hint">
            Потрібно лише для вас двох — щоб застосунок не нагадував людині про її ж день народження.
          </p>
        </div>
      )}

      <label className="form-field">
        <span>Назва</span>
        <input id="event-title" name="title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </label>
      <label className="form-field">
        <span>Дата</span>
        <input id="event-date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="form-field">
        <span>Опис (необов’язково)</span>
        <textarea
          id="event-description"
          name="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>
      <label className="cal-yearly-toggle">
        <input id="event-yearly" name="yearly" type="checkbox" checked={yearly} onChange={(event) => setYearly(event.target.checked)} />
        <span>Повторюється щороку</span>
      </label>
      <label className="cal-yearly-toggle">
        <input
          id="event-milestone"
          name="is_milestone"
          type="checkbox"
          checked={isMilestone}
          onChange={(event) => setIsMilestone(event.target.checked)}
        />
        <span>Велика подія — заручини, весілля, важлива віха</span>
      </label>
      <p className="cal-field-hint">
        Річниці автоматично з’являються у «Нашому шляху». Позначка великої події додає сильніший акцент.
      </p>
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
