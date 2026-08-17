// ============================================================
// Вхід у «Наш шлях» із вкладки «Події».
// ------------------------------------------------------------
// Раніше тут жила ціла карта: пласке сузір'я, промені й підписи всередині
// картки. Відколи «Наш шлях» став справжньою 3D-сценою на весь екран, друга
// подача перестала мати сенс — і не з міркувань економії коду.
//
// Дві причини, і обидві про зміст. Перша: сузір'я в кадрі 100×168 і сузір'я в
// просторі — це РІЗНІ сузір'я, бо в другому працює глибина; показати обидва
// означало б сказати парі, що в них дві карти. Друга: картка ділила увагу з
// рештою вкладки, а сцена її забирає цілком — саме цього власник і просив.
//
// Тому тут лишився рядок: скільки зірок уже світиться і як туди потрапити.
// ============================================================
import { Link } from 'react-router-dom';
import { HeartIcon } from '@/components/icons/NavIcon';
import { ArrowUpIcon, PlusIcon } from '@/components/icons/UiIcon';
import type { EventRow } from '@/types';
import './relationshipJourney.css';

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

export function RelationshipJourney({
  events,
  onAdd,
}: {
  events: EventRow[];
  onAdd: () => void;
}) {
  const moments = events.filter(isJourneyEvent);

  if (moments.length === 0) {
    return (
      <section className="relationship-journey relationship-journey--empty">
        <span className="relationship-journey-icon" aria-hidden="true"><HeartIcon size={22} /></span>
        <span className="relationship-journey-copy">
          <strong>Наш шлях</strong>
          <small>Початок стосунків, перша поїздка, пропозиція — кожна подія стане зіркою.</small>
        </span>
        <button type="button" className="btn" onClick={onAdd}>
          <PlusIcon size={14} /> Додати
        </button>
      </section>
    );
  }

  return (
    <Link to="/journey" className="relationship-journey" aria-label="Відкрити карту «Наш шлях»">
      <span className="relationship-journey-icon" aria-hidden="true"><HeartIcon size={22} /></span>
      <span className="relationship-journey-copy">
        <strong>Наш шлях</strong>
        <small>{moments.length} {plural(moments.length)} на вашому небі</small>
      </span>
      <span className="relationship-journey-go" aria-hidden="true"><ArrowUpIcon size={16} /></span>
    </Link>
  );
}

/** Українська множина: 1 зірка, 2–4 зірки, 5+ зірок. */
function plural(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return 'зірок';
  switch (count % 10) {
    case 1: return 'зірка';
    case 2:
    case 3:
    case 4: return 'зірки';
    default: return 'зірок';
  }
}
