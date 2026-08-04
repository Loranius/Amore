// ============================================================
// Hero — привітання + лічильник днів над артефактом
// ------------------------------------------------------------
// Компактніша версія видалених у попередній фазі Greeting/Counter
// (HomeBlocks.tsx) — тепер ділить сторінку з артефактом, не займає
// весь екран.
//
// Рядок найближчого свята звідси прибрано: календар і так має власний
// розділ, а на головній він відсував артефакт нижче — тобто головне на
// цій сторінці поступалось місцем нагадуванню, яке його дублює.
// ============================================================
import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useStartDate } from './useHome';
import { daysBetween, formatSinceDate, nextAnniversaryLabel } from './homeUtils';

const COMMON = ['Хай, бубос 💛', 'Привіт, пупс 🌸', 'Шо ти там, крошка? 😏'];
const PERSONAL: Record<string, string[]> = {
  Лєна: ['Привіт, Лєнок 🌷', 'Привіт, Лєнусік 💕', 'Привіт, Лєнчик ✨'],
  Діма: ['Як справи, Дімасік? 😎', 'Привіт, Дімонич 🤙'],
};

export function Hero() {
  const me = useCurrentUser();
  const startDate = useStartDate();

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
    </section>
  );
}
