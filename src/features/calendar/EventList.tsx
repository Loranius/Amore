// ============================================================
// EventList — банер найближчої + списки майбутніх/минулих (порт renderEvents)
// ------------------------------------------------------------
// Для одного типу подій (крім 'other' — ті йдуть у PlansBoard).
// ============================================================
import { TYPES, daysLabel, formatUaDate } from './calendarUtils';
import type { EnrichedEvent } from '@/types';

interface EventListProps {
  events: EnrichedEvent[]; // вже відфільтровані за типом і відсортовані
  onDelete: (id: number) => void;
}

export function EventList({ events, onDelete }: EventListProps) {
  if (events.length === 0) {
    return <p className="empty-state">У цій категорії поки нічого немає.</p>;
  }

  const nextUp = events.find((e) => !e.passed);
  const upcoming = events.filter((e) => !e.passed);
  const past = events.filter((e) => e.passed);

  return (
    <div>
      {nextUp && <NextBanner ev={nextUp} />}
      {upcoming.length > 0 && (
        <Section events={upcoming} onDelete={onDelete} hideBadgeForId={nextUp?.id ?? null} />
      )}
      {past.length > 0 && <Section title="✓ Минулі" events={past} onDelete={onDelete} muted />}
    </div>
  );
}

function NextBanner({ ev }: { ev: EnrichedEvent }) {
  const t = TYPES[ev.type ?? 'other'];
  return (
    <div className="cal-next-banner" style={{ borderColor: t.color }}>
      <div className="cal-next-icon">{t.icon}</div>
      <div className="cal-next-info">
        <div className="cal-next-label">Найближча</div>
        <div className="cal-next-title">{ev.title}</div>
        <div className="cal-next-when" style={{ color: t.color }}>
          {daysLabel(ev.days)}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title?: string;
  events: EnrichedEvent[];
  muted?: boolean;
  hideBadgeForId?: number | null;
  onDelete: (id: number) => void;
}

function Section({ title, events, muted = false, hideBadgeForId = null, onDelete }: SectionProps) {
  return (
    <div className="cal-section">
      {title && <div className={`cal-section-title${muted ? ' cal-muted' : ''}`}>{title}</div>}
      {events.map((ev) => {
        const t = TYPES[ev.type ?? 'other'];
        return (
          <div key={ev.id} className={`cal-event-item${muted ? ' cal-muted' : ''}`}>
            <div className="cal-event-type-bar" style={{ background: t.color }} />
            <div className="cal-event-icon">{t.icon}</div>
            <div className="cal-event-info">
              <div className="cal-event-title">{ev.title}</div>
              {ev.description && <div className="cal-event-desc">{ev.description}</div>}
              <div className="cal-event-meta">
                <span>{formatUaDate(ev.date)}</span>
                {ev.yearly && <span className="cal-yearly-badge">↻ щороку</span>}
                {!muted && ev.id !== hideBadgeForId && (
                  <span className="cal-days-badge" style={{ color: t.color }}>
                    {daysLabel(ev.days)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="cal-del-btn"
              onClick={() => onDelete(ev.id)}
              aria-label="Видалити"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
