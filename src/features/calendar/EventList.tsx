// ============================================================
// EventList — банер найближчої + списки майбутніх/минулих.
// ------------------------------------------------------------
// Для одного типу подій (крім 'other' — ті йдуть у PlansBoard).
//
// Дата в рядку — НАЙБЛИЖЧЕ настання, а не вихідна: для щорічної події
// друкувати рік народження було рівно тим, що змушувало рахувати в
// голові. Поруч — роковини («виповниться 64», «5 років разом»), які весь
// цей час випливали з даних і ніде не показувались.
// ============================================================
import { useUsersMap } from '@/features/_shared/useUsers';
import { formatDateUA } from '@/features/_shared/month';
import {
  TYPES, daysLabel, occurrenceISO, occurrenceLabel,
} from './calendarUtils';
import type { EnrichedEvent } from '@/types';

interface EventListProps {
  events: EnrichedEvent[]; // вже відфільтровані за типом і відсортовані
  onEdit: (ev: EnrichedEvent) => void;
  onDelete: (id: number) => void;
}

export function EventList({ events, onEdit, onDelete }: EventListProps) {
  if (events.length === 0) {
    return <p className="empty-state">У цій категорії поки нічого немає.</p>;
  }

  const nextUp = events.find((e) => !e.passed);
  // Найближча подія показується у банері — і НЕ повторюється списком
  // нижче. Раніше вона стояла двічі поспіль, лише без бейджа днів у
  // другій копії; на списку з чотирьох подій це половина екрана про одне
  // й те саме.
  const upcoming = events.filter((e) => !e.passed && e.id !== nextUp?.id);
  const past = events.filter((e) => e.passed);

  return (
    <div>
      {nextUp && <NextBanner ev={nextUp} onEdit={onEdit} />}
      {upcoming.length > 0 && (
        <Section events={upcoming} onEdit={onEdit} onDelete={onDelete} />
      )}
      {past.length > 0 && (
        <Section title="✓ Минулі" events={past} onEdit={onEdit} onDelete={onDelete} muted />
      )}
    </div>
  );
}

function NextBanner({ ev, onEdit }: { ev: EnrichedEvent; onEdit: (ev: EnrichedEvent) => void }) {
  const t = TYPES[ev.type ?? 'other'];
  const years = occurrenceLabel(ev);
  return (
    <button
      type="button"
      className="cal-next-banner"
      style={{ borderColor: t.mark }}
      onClick={() => onEdit(ev)}
    >
      <div className="cal-next-icon">{t.icon}</div>
      <div className="cal-next-info">
        <div className="cal-next-label">Найближча</div>
        <div className="cal-next-title">{ev.title}</div>
        <div className="cal-next-when" style={{ color: t.ink }}>
          {daysLabel(ev.days)}
        </div>
        <div className="cal-next-years">
          {formatDateUA(occurrenceISO(ev))}
          {years && <> · {years}</>}
        </div>
      </div>
    </button>
  );
}

interface SectionProps {
  title?: string;
  events: EnrichedEvent[];
  muted?: boolean;
  onEdit: (ev: EnrichedEvent) => void;
  onDelete: (id: number) => void;
}

function Section({ title, events, muted = false, onEdit, onDelete }: SectionProps) {
  return (
    <div className="cal-section">
      {title && <div className={`cal-section-title${muted ? ' cal-muted' : ''}`}>{title}</div>}
      {events.map((ev) => (
        <EventRow key={ev.id} ev={ev} muted={muted} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

/**
 * Рядок події.
 *
 * Редагування — тап по всьому рядку, а не по олівцю 22 на 22 пікселі,
 * який стояв упритул до хрестика видалення: промах пальцем коштував
 * діалогу видалення. Кнопка-накладка дає і велику ціль, і фокус із
 * клавіатури; хрестик лишається окремо, шаром вище й на відстані.
 */
function EventRow({
  ev, muted, onEdit, onDelete,
}: {
  ev: EnrichedEvent;
  muted: boolean;
  onEdit: (ev: EnrichedEvent) => void;
  onDelete: (id: number) => void;
}) {
  const t = TYPES[ev.type ?? 'other'];
  const years = occurrenceLabel(ev);
  const users = useUsersMap();
  // Ім'я показуємо лише коли подія прив'язана до людини з застосунку:
  // для батьків і друзів прив'язки немає й бути не мусить.
  const person = ev.person_user_id ? users[ev.person_user_id] : null;

  return (
    <div className={`cal-event-item${muted ? ' cal-muted' : ''}`}>
      <button
        type="button"
        className="cal-event-open"
        onClick={() => onEdit(ev)}
        aria-label={`Редагувати «${ev.title}»`}
      />
      <div className="cal-event-type-bar" style={{ background: t.mark }} />
      <div className="cal-event-icon">{t.icon}</div>
      <div className="cal-event-info">
        <div className="cal-event-title">
          {ev.title}
          {person && <span className="cal-person-chip">{person}</span>}
        </div>
        {ev.description && <div className="cal-event-desc">{ev.description}</div>}
        {/* Одне головне число й один тихий підрядок замість п'яти
            рівновагових шматочків, які регулярно ламались на два рядки.
            Око шукає «коли» — воно й найпомітніше. */}
        {!muted && (
          <div className="cal-event-when" style={{ color: t.ink }}>
            {daysLabel(ev.days)}
          </div>
        )}
        <div className="cal-event-meta">
          <span>{formatDateUA(occurrenceISO(ev))}</span>
          {years && <span>{years}</span>}
          {/* «↻ щороку» лише коли роковин немає: підпис роковин буває
              виключно в щорічної події, тож поруч вони дублювали одне одного. */}
          {ev.yearly && !years && <span>↻ щороку</span>}
        </div>
      </div>
      <button
        type="button"
        className="cal-del-btn"
        onClick={() => onDelete(ev.id)}
        aria-label={`Видалити «${ev.title}»`}
      >
        ×
      </button>
    </div>
  );
}
