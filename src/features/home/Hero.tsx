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
//
// Лічильник — двері в «Наш шлях» (ADR-0037 §переїзд). Модуль планів мав
// окрему вкладку «Події» з рядком-входом у це саме сузір'я; власник
// попросив прибрати проміжну зупинку — дотик по днях розгортає небо
// напряму. Це не рефакторинг, а зникнення другого шляху: після переїзду
// «Наш шлях» відкривається ЛИШЕ звідси.
// ============================================================
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePartner } from '@/features/_shared/useUsers';
import { useWorldGrowth } from '@/features/world/growthChannel';
import { useStartDate } from './useHome';
import { growthCaption } from './growthSinceLastVisit';
import { daysBetween, formatSinceDate, nextAnniversaryLabel } from './homeUtils';

const COMMON = ['Хай, бубос 💛', 'Привіт, пупс 🌸', 'Шо ти там, крошка? 😏'];
const PERSONAL: Record<string, string[]> = {
  Лєна: ['Привіт, Лєнок 🌷', 'Привіт, Лєнусік 💕', 'Привіт, Лєнчик ✨'],
  Діма: ['Як справи, Дімасік? 😎', 'Привіт, Дімонич 🤙'],
};

export function Hero() {
  const me = useCurrentUser();
  const startDate = useStartDate();
  const growth = useWorldGrowth();
  const partner = usePartner();

  /*
   * Рядок про приріст стоїть у ШАПЦІ, а не в сцені, і це вимога, а не
   * смак: `.artifact-world` має `aria-hidden="true"` (§48), тож текст
   * усередині полотна для читача просто не існує. Сцена рахує, шапка
   * говорить — див. `growthChannel.ts`.
   *
   * `null` тут звичайний стан: перший візит, нічого нового, або
   * артефакт, чий конвеєр іще не звітує. У всіх трьох випадках шапка
   * мовчить, замість писати «+0».
   */
  const growthLine = growth === null ? null : growthCaption(growth, partner);

  const greeting = useMemo(() => {
    const pool = [...COMMON, ...(PERSONAL[me.name] ?? [])];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }, [me.name]);

  return (
    <section className="home-hero">
      <p className="home-hero-greeting">{greeting}</p>
      {startDate && (
        <Link
          to="/journey"
          className="home-hero-counter"
          aria-label="Відкрити «Наш шлях» — карту подій вашого стосунку"
        >
          <span className="home-hero-counter-number">
            {daysBetween(startDate).toLocaleString('uk-UA')}
          </span>
          <span className="home-hero-counter-label">днів разом · з {formatSinceDate(startDate)}</span>
          <span className="home-hero-anniversary">{nextAnniversaryLabel(startDate)}</span>
        </Link>
      )}
      {growthLine && <p className="home-hero-growth">{growthLine}</p>}
    </section>
  );
}
