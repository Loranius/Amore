// ============================================================
// Greeting / Counter / NextEvent — блоки головної
// ============================================================
import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { daysBetween, formatSinceDate, nextAnniversaryLabel, todayStr } from './homeUtils';
import { planMetadataOf } from '@/features/_shared/events';
import type { EventRow } from '@/types';

// ── Привітання ───────────────────────────────────────────────
const COMMON = ['Хай, бубос 💛', 'Привіт, пупс 🌸', 'Шо ти там, крошка? 😏'];
const PERSONAL: Record<string, string[]> = {
  Лєна: ['Привіт, Лєнок 🌷', 'Привіт, Лєнусік 💕', 'Привіт, Лєнчик ✨'],
  Діма: ['Як справи, Дімасік? 😎', 'Привіт, Дімонич 🤙'],
};

export function Greeting() {
  const me = useCurrentUser();
  // Обираємо фразу один раз на монтування.
  const phrase = useMemo(() => {
    const pool = [...COMMON, ...(PERSONAL[me.name] ?? [])];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }, [me.name]);
  return <p className="greeting-text">{phrase}</p>;
}

// ── Лічильник днів разом ─────────────────────────────────────
export function Counter({ startDate }: { startDate: string | null }) {
  if (!startDate) {
    return (
      <div className="counter">
        <div className="counter-number">?</div>
        <div className="counter-since">дата ще не вказана</div>
      </div>
    );
  }
  return (
    <div className="counter">
      <div className="counter-number">{daysBetween(startDate).toLocaleString('uk-UA')}</div>
      <div className="counter-since">з {formatSinceDate(startDate)}</div>
      <div className="counter-next-anniversary">{nextAnniversaryLabel(startDate)}</div>
    </div>
  );
}

// ── Найближча подія ──────────────────────────────────────────
function isArchivedPlan(ev: EventRow): boolean {
  if ((ev.type ?? 'other') !== 'other') return false;
  return planMetadataOf(ev).status === 'done';
}

export function NextEvent({ events }: { events: EventRow[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ts = todayStr();

  // events відсортовані за датою; беремо першу майбутню не-архівну.
  const ev = events.find((e) => e.date >= ts && !isArchivedPlan(e));
  if (!ev) {
    return <div className="next-event-empty">📅 Найближчих подій немає</div>;
  }

  const eventDate = new Date(ev.date + 'T00:00:00');
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  const dateStr = eventDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const when = diffDays === 0 ? 'сьогодні! 🎉' : diffDays === 1 ? 'завтра' : `через ${diffDays} дн.`;

  return (
    <div className="next-event-widget">
      <span className="next-event-icon">📅</span>
      <div className="next-event-info">
        <p className="next-event-label">Найближча подія</p>
        <p className="next-event-title">{ev.title}</p>
        <p className="next-event-date">
          {dateStr} — {when}
        </p>
      </div>
    </div>
  );
}
