// ============================================================
// Hero — привітання + лічильник днів + найближча подія над кристалом
// ------------------------------------------------------------
// Компактніша версія видалених у попередній фазі Greeting/Counter/
// NextEvent (HomeBlocks.tsx) — тепер ділить сторінку з кристалом,
// не займає весь екран.
// ============================================================
import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useEvents, planMetadataOf } from '@/features/_shared/events';
import { useStartDate } from './useHome';
import { daysBetween, formatSinceDate, nextAnniversaryLabel } from './homeUtils';
import type { EventRow } from '@/types';

const COMMON = ['Хай, бубос 💛', 'Привіт, пупс 🌸', 'Шо ти там, крошка? 😏'];
const PERSONAL: Record<string, string[]> = {
  Лєна: ['Привіт, Лєнок 🌷', 'Привіт, Лєнусік 💕', 'Привіт, Лєнчик ✨'],
  Діма: ['Як справи, Дімасік? 😎', 'Привіт, Дімонич 🤙'],
};

function isArchivedPlan(ev: EventRow): boolean {
  if ((ev.type ?? 'other') !== 'other') return false;
  return planMetadataOf(ev).status === 'done';
}

function useNextEventLabel(): string | null {
  const { data: events = [] } = useEvents();
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ev = events.find((e) => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= today && !isArchivedPlan(e);
    });
    if (!ev) return null;

    const eventDate = new Date(ev.date + 'T00:00:00');
    const diffDays = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
    const dateStr = eventDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    const when = diffDays === 0 ? 'сьогодні! 🎉' : diffDays === 1 ? 'завтра' : `через ${diffDays} дн.`;
    return `${ev.title} — ${dateStr} (${when})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);
}

export function Hero() {
  const me = useCurrentUser();
  const startDate = useStartDate();
  const nextEvent = useNextEventLabel();

  const greeting = useMemo(() => {
    const pool = [...COMMON, ...(PERSONAL[me.name] ?? [])];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }, [me.name]);

  return (
    <section className="home-hero">
      <p className="home-hero-greeting">{greeting}</p>
      {startDate && (
        <div className="home-hero-counter">
          <span className="home-hero-counter-number">
            {daysBetween(startDate).toLocaleString('uk-UA')}
          </span>
          <span className="home-hero-counter-label">днів разом · з {formatSinceDate(startDate)}</span>
          <span className="home-hero-anniversary">{nextAnniversaryLabel(startDate)}</span>
        </div>
      )}
      {nextEvent && (
        <p className="home-hero-next-event">
          <span aria-hidden="true">📅</span> {nextEvent}
        </p>
      )}
    </section>
  );
}
